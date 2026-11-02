"use client";
import { useEffect, useMemo, useRef } from "react";
import { useStore, vpOf, S } from "@/lib/store";
import { hitTest, refs, screenToWorld } from "@/lib/canvas";
import { cancelViewportAnim, createCard, uploadFiles, zoomTo } from "@/lib/actions";
import { startMarquee, startPan } from "@/lib/interactions";
import { isUrl, normalizeUrl, textToHtml } from "@/lib/utils";
import { CardView } from "./CardView";
import { LinesLayer } from "./LinesLayer";

export function Canvas() {
  const vpEl = useRef<HTMLDivElement>(null);
  const worldEl = useRef<HTMLDivElement>(null);
  const boardId = useStore((s) => s.currentBoardId);
  const cards = useStore((s) => s.ws.cards);
  const tool = useStore((s) => s.tool);
  const spaceDown = useStore((s) => s.spaceDown);
  const showGrid = useStore((s) => s.ws.settings.showGrid);
  const loaded = useStore((s) => s.loaded);

  const topIds = useMemo(
    () =>
      Object.values(cards)
        .filter((c) => c.boardId === boardId && !c.deleted && !c.parentId && !c.unsorted)
        .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
        .map((c) => c.id),
    [cards, boardId]
  );

  useEffect(() => {
    refs.viewport = vpEl.current;
    refs.world = worldEl.current;
  });

  // Apply pan/zoom straight to the DOM (no React re-render), snapped to device pixels so text stays crisp.
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      raf = 0;
      const s = S();
      const v = vpOf(s);
      const dpr = window.devicePixelRatio || 1;
      const x = Math.round(v.x * dpr) / dpr;
      const y = Math.round(v.y * dpr) / dpr;
      if (worldEl.current) worldEl.current.style.transform = `translate(${x}px, ${y}px) scale(${v.zoom})`;
      const el = vpEl.current;
      if (el) {
        let g = 24 * v.zoom;
        while (g < 12) g *= 2;
        el.style.backgroundSize = `${g}px ${g}px`;
        el.style.backgroundPosition = `${x}px ${y}px`;
        el.style.setProperty("--zoom", String(v.zoom));
      }
    };
    apply();
    const unsub = useStore.subscribe((s, p) => {
      if (s.viewports !== p.viewports || s.currentBoardId !== p.currentBoardId) {
        if (!raf) raf = requestAnimationFrame(apply);
      }
    });
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);

  // wheel: pan, ctrl/cmd + wheel (or pinch): zoom
  useEffect(() => {
    const el = vpEl.current!;
    let pan = { dx: 0, dy: 0 };
    let zoomAcc: { f: number; x: number; y: number } | null = null;
    let raf = 0;
    const flush = () => {
      raf = 0;
      cancelViewportAnim();
      const s = S();
      const v = vpOf(s);
      if (zoomAcc) {
        zoomTo(v.zoom * zoomAcc.f, { x: zoomAcc.x, y: zoomAcc.y });
        zoomAcc = null;
      }
      if (pan.dx || pan.dy) {
        const v2 = vpOf(S());
        S().setViewport({ x: v2.x - pan.dx, y: v2.y - pan.dy });
        pan = { dx: 0, dy: 0 };
      }
    };
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement;
      const scroller = t.closest<HTMLElement>("[data-scroll]");
      if (scroller && !e.ctrlKey && !e.metaKey && (scroller.scrollHeight > scroller.clientHeight + 1 || scroller.scrollWidth > scroller.clientWidth + 1)) return;
      if (t.closest(".embed, .modal")) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const k = Math.abs(e.deltaY) < 40 ? 0.012 : 0.0022;
        const f = Math.exp(-e.deltaY * k);
        zoomAcc = { f: (zoomAcc?.f || 1) * f, x: e.clientX, y: e.clientY };
      } else {
        const m = e.deltaMode === 1 ? 24 : 1;
        let dx = e.deltaX * m, dy = e.deltaY * m;
        if (e.shiftKey && !dx) {
          dx = dy;
          dy = 0;
        }
        pan.dx += dx;
        pan.dy += dy;
      }
      if (!raf) raf = requestAnimationFrame(flush);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(raf);
    };
  }, []);

  const isBg = (t: EventTarget) => t === vpEl.current || t === worldEl.current || (t as HTMLElement).classList?.contains("lines-overlay");

  const panning = tool === "hand" || spaceDown;

  return (
    <div
      ref={vpEl}
      className={"viewport" + (panning ? " hand" : "") + (showGrid ? " grid" : "")}
      onPointerDown={(e) => {
        S().set({ contextMenu: null });
        if (e.button === 1 || (e.button === 0 && panning)) {
          e.preventDefault();
          startPan(e);
          return;
        }
        if (e.button === 0 && isBg(e.target)) {
          (document.activeElement as HTMLElement | null)?.blur?.();
          startMarquee(e);
        }
      }}
      onDoubleClick={(e) => {
        if (!isBg(e.target) || panning) return;
        createCard("note", screenToWorld(e.clientX, e.clientY), { focus: true });
      }}
      onContextMenu={(e) => {
        if (!isBg(e.target)) return;
        e.preventDefault();
        S().set({ contextMenu: { x: e.clientX, y: e.clientY, kind: "canvas", world: screenToWorld(e.clientX, e.clientY) }, selection: [], selectedLines: [] });
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files") || e.dataTransfer.types.includes("text/uri-list") || e.dataTransfer.types.includes("text/plain")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          const t = hitTest(e.clientX, e.clientY, new Set(), true);
          const tt = t && t.kind === "column" ? t : null;
          if (JSON.stringify(S().dropTarget) !== JSON.stringify(tt)) S().set({ dropTarget: tt });
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) S().set({ dropTarget: null });
      }}
      onDrop={(e) => {
        e.preventDefault();
        const t = S().dropTarget;
        S().set({ dropTarget: null });
        const at = screenToWorld(e.clientX, e.clientY);
        const col = t && t.kind === "column" ? t : null;
        const files = Array.from(e.dataTransfer.files);
        if (files.length) {
          uploadFiles(files, at, col?.id, col?.index);
          return;
        }
        const uri = e.dataTransfer.getData("text/uri-list").split("\n").find((l) => l && !l.startsWith("#"));
        const text = e.dataTransfer.getData("text/plain");
        const url = uri || (isUrl(text) ? text : "");
        if (url) createCard("link", at, { data: { url: normalizeUrl(url), status: "idle" }, parentId: col?.id, index: col?.index });
        else if (text.trim()) createCard("note", at, { data: { html: textToHtml(text) }, parentId: col?.id, index: col?.index });
      }}
    >
      <div ref={worldEl} className="world">
        {topIds.map((id) => (
          <CardView key={id} id={id} />
        ))}
        <LinesLayer />
        <Marquee />
      </div>
      {loaded && topIds.length === 0 && (
        <div className="empty-board">
          <div className="empty-emoji">✨</div>
          <h2>This board is empty</h2>
          <p>Drag a card from the toolbar, double-click anywhere to write a note, or drop images and files here.</p>
        </div>
      )}
    </div>
  );
}

function Marquee() {
  const m = useStore((s) => s.marquee);
  if (!m) return null;
  return <div className="marquee no-export" style={{ left: m.x0, top: m.y0, width: m.x1 - m.x0, height: m.y1 - m.y0 }} />;
}
