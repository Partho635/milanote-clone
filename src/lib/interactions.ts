"use client";
import { S, vpOf } from "./store";
import { cardEl, cardRect, dragState, hitTest, overViewport, screenToWorld, viewportCenterWorld } from "./canvas";
import { cancelViewportAnim, sendToUnsorted, buildPayload, createCard, createLine, deleteSelection, dropIntoColumn, freeSpot, insertPayload, moveCardsToBoard, openFilePicker, topZ } from "./actions";
import type { CardType, Endpoint, Workspace } from "./types";
import { isTypingTarget } from "./utils";

let lastDragEnd = 0;
/** True right after a drag finished — click handlers use it to ignore the trailing click. */
export const justDragged = () => Date.now() - lastDragEnd < 250;

const THRESH = 4;

function snapV(v: number) {
  return S().ws.settings.snap ? Math.round(v / 20) * 20 : v;
}

function track(onMove: (e: PointerEvent) => void, onUp: (e: PointerEvent) => void) {
  const move = (e: PointerEvent) => onMove(e);
  const up = (e: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    onUp(e);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

/* ---------------- panning ---------------- */

export function startPan(e: React.PointerEvent | PointerEvent) {
  cancelViewportAnim();
  const s = S();
  const vp0 = vpOf(s);
  const sx = e.clientX, sy = e.clientY;
  document.body.classList.add("is-panning");
  let last: PointerEvent | null = null;
  let raf = 0;
  track(
    (ev) => {
      last = ev;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (last) s.setViewport({ x: vp0.x + last.clientX - sx, y: vp0.y + last.clientY - sy });
        });
    },
    (ev) => {
      cancelAnimationFrame(raf);
      s.setViewport({ x: vp0.x + ev.clientX - sx, y: vp0.y + ev.clientY - sy });
      document.body.classList.remove("is-panning");
    }
  );
}

/* ---------------- marquee ---------------- */

export function startMarquee(e: React.PointerEvent) {
  const s = S();
  const p0 = screenToWorld(e.clientX, e.clientY);
  const additive = e.shiftKey || e.metaKey || e.ctrlKey;
  const base = additive ? s.selection : [];
  const baseLines = additive ? s.selectedLines : [];
  let moved = false;
  const sx = e.clientX, sy = e.clientY;
  let rects: { id: string; r: { x: number; y: number; w: number; h: number } }[] | null = null;
  let lastEv: PointerEvent | null = null;
  let raf = 0;
  const update = () => {
    raf = 0;
    const ev = lastEv;
    if (!ev) return;
    {
      const p1 = screenToWorld(ev.clientX, ev.clientY);
      const x0 = Math.min(p0.x, p1.x), y0 = Math.min(p0.y, p1.y), x1 = Math.max(p0.x, p1.x), y1 = Math.max(p0.y, p1.y);
      const st = S();
      if (!rects) {
        rects = [];
        for (const c of Object.values(st.ws.cards)) {
          if (c.boardId !== st.currentBoardId || c.deleted || c.parentId || c.unsorted) continue;
          const r = cardRect(c.id);
          if (r) rects.push({ id: c.id, r });
        }
      }
      const hits: string[] = [];
      for (const { id, r } of rects) if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) hits.push(id);
      const lineHits: string[] = [];
      for (const l of Object.values(st.ws.lines)) {
        if (l.boardId !== st.currentBoardId) continue;
        const inside = (ep: Endpoint) => {
          if (ep.cardId) return hits.includes(ep.cardId);
          return ep.x >= x0 && ep.x <= x1 && ep.y >= y0 && ep.y <= y1;
        };
        if (inside(l.from) && inside(l.to)) lineHits.push(l.id);
      }
      const nextSel = Array.from(new Set([...base, ...hits]));
      const nextLines = Array.from(new Set([...baseLines, ...lineHits]));
      const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
      st.set({
        marquee: { x0, y0, x1, y1 },
        ...(same(nextSel, st.selection) ? {} : { selection: nextSel }),
        ...(same(nextLines, st.selectedLines) ? {} : { selectedLines: nextLines }),
      });
    }
  };
  track(
    (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESH) return;
      moved = true;
      lastEv = ev;
      if (!raf) raf = requestAnimationFrame(update);
    },
    () => {
      cancelAnimationFrame(raf);
      S().set({ marquee: null });
      if (!moved) {
        if (!additive) S().set({ selection: [], selectedLines: [], drawingId: null, activeItem: null, tableSel: null, commentOpen: null });
        (document.activeElement as HTMLElement | null)?.blur?.();
      } else lastDragEnd = Date.now();
    }
  );
}

/* ---------------- card dragging ---------------- */

export function onCardPointerDown(e: React.PointerEvent, id: string) {
  if (e.button !== 0) return;
  const s = S();
  const target = e.target as HTMLElement;
  if (s.tool === "hand" || s.spaceDown) {
    e.stopPropagation();
    startPan(e);
    return;
  }
  if (target.closest("[data-nodrag]")) {
    e.stopPropagation();
    return;
  }
  // allow text selection inside a field that is already focused
  const editable = target.closest<HTMLElement>("input, textarea, [contenteditable='true']");
  if (editable && (document.activeElement === editable || editable.contains(document.activeElement))) {
    e.stopPropagation();
    return;
  }
  e.stopPropagation();
  const card = s.ws.cards[id];
  if (!card) return;

  let sel = s.selection;
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
  } else if (!sel.includes(id)) sel = [id];
  const patch: Partial<ReturnType<typeof S>> = { selection: sel, selectedLines: e.shiftKey ? s.selectedLines : [], contextMenu: null };
  if (s.activeItem && s.activeItem.cardId !== id) patch.activeItem = null;
  if (s.tableSel && s.tableSel.cardId !== id) patch.tableSel = null;
  if (s.commentOpen && s.commentOpen !== id) patch.commentOpen = null;
  if (s.drawingId && s.drawingId !== id) patch.drawingId = null;
  s.set(patch);
  if (card.locked) return;
  startCardDrag(e.clientX, e.clientY, id, { duplicate: e.altKey });
}

/**
 * Smooth drag: cards are moved with GPU transforms (CSS variables) while dragging and
 * the store is written once on drop. Lines follow through `dragState`.
 */
export function startCardDrag(sx: number, sy: number, id: string, opts: { duplicate?: boolean; preStarted?: boolean } = {}) {
  let started = false;
  let origins: Record<string, { x: number; y: number }> = {};
  let lineOrigins: Record<string, { from?: { x: number; y: number }; to?: { x: number; y: number } }> = {};
  let ids: string[] = [];
  const els = new Map<string, HTMLElement>();
  let lastEv: { x: number; y: number } | null = null;
  let raf = 0;

  const begin = () => {
    started = true;
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.getSelection()?.removeAllRanges();
    document.body.classList.add("is-dragging");
    let st = S();
    ids = st.selection.filter((x) => st.ws.cards[x] && !st.ws.cards[x].deleted && !st.ws.cards[x].locked);
    if (!ids.includes(id) && st.ws.cards[id]) ids.push(id);
    if (opts.duplicate) {
      const copies = insertPayload(buildPayload(ids), st.currentBoardId, 0, 0);
      if (copies.length) {
        ids = copies;
        S().toast("Copy created — drop it anywhere");
      }
      st = S();
    }
    // measure before detaching from columns
    const rects = Object.fromEntries(ids.map((x) => [x, cardRect(x)]));
    const needsDetach = ids.some((x) => st.ws.cards[x]?.parentId);
    st.mutate(
      (d) => {
        let z = topZ(d as Workspace, st.currentBoardId);
        for (const x of ids) {
          const c = d.cards[x];
          if (!c) continue;
          if (c.parentId) {
            const r = rects[x];
            c.parentId = null;
            if (r) {
              c.x = r.x;
              c.y = r.y;
              c.w = Math.max(r.w, 160);
            }
          }
          c.z = z++;
        }
      },
      { history: !opts.duplicate || needsDetach }
    );
    const ws = S().ws;
    origins = Object.fromEntries(ids.filter((x) => ws.cards[x]).map((x) => [x, { x: ws.cards[x].x, y: ws.cards[x].y }]));
    lineOrigins = {};
    for (const lid of S().selectedLines) {
      const l = ws.lines[lid];
      if (!l) continue;
      lineOrigins[lid] = {
        from: l.from.cardId ? undefined : { x: l.from.x, y: l.from.y },
        to: l.to.cardId ? undefined : { x: l.to.x, y: l.to.y },
      };
    }
    dragState.ids = new Set(ids);
    dragState.dx = 0;
    dragState.dy = 0;
    S().set({ dragging: true, selection: ids, activeItem: null, tableSel: null });
  };

  const delta = (cx: number, cy: number) => {
    const z = vpOf(S()).zoom;
    let dx = (cx - sx) / z, dy = (cy - sy) / z;
    if (S().ws.settings.snap && origins[id]) {
      dx = snapV(origins[id].x + dx) - origins[id].x;
      dy = snapV(origins[id].y + dy) - origins[id].y;
    }
    return { dx, dy };
  };

  const apply = () => {
    raf = 0;
    if (!lastEv) return;
    const { dx, dy } = delta(lastEv.x, lastEv.y);
    dragState.dx = dx;
    dragState.dy = dy;
    for (const x of ids) {
      let el = els.get(x);
      if (!el || !el.isConnected) {
        el = cardEl(x) || undefined;
        if (el) els.set(x, el);
      }
      if (el) {
        el.style.setProperty("--dx", dx + "px");
        el.style.setProperty("--dy", dy + "px");
      }
    }
    if (Object.keys(lineOrigins).length)
      S().mutate((d) => {
        for (const [lid, o] of Object.entries(lineOrigins)) {
          const l = d.lines[lid];
          if (!l) continue;
          if (o.from) l.from = { cardId: null, x: o.from.x + dx, y: o.from.y + dy };
          if (o.to) l.to = { cardId: null, x: o.to.x + dx, y: o.to.y + dy };
        }
      });
    const hasColumn = ids.some((x) => S().ws.cards[x]?.type === "column");
    const t = hitTest(lastEv.x, lastEv.y, new Set(ids), !hasColumn);
    const cur = S().dropTarget;
    if (JSON.stringify(cur) !== JSON.stringify(t)) S().set({ dropTarget: t });
  };

  if (opts.preStarted) begin();

  track(
    (ev) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESH) return;
        begin();
      }
      window.getSelection()?.removeAllRanges();
      lastEv = { x: ev.clientX, y: ev.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    },
    (ev) => {
      document.body.classList.remove("is-dragging");
      if (!started) return;
      if (raf) cancelAnimationFrame(raf);
      lastEv = { x: ev.clientX, y: ev.clientY };
      apply();
      lastDragEnd = Date.now();
      const { dx, dy } = delta(ev.clientX, ev.clientY);
      const t = S().dropTarget;
      // commit final positions once
      S().mutate((d) => {
        for (const x of ids) {
          const c = d.cards[x];
          if (!c || !origins[x]) continue;
          c.x = Math.round(origins[x].x + dx);
          c.y = Math.round(origins[x].y + dy);
        }
      });
      dragState.ids = new Set();
      dragState.dx = 0;
      dragState.dy = 0;
      S().set({ dragging: false, dropTarget: null });
      const clear = () => {
        for (const el of els.values()) {
          el.style.removeProperty("--dx");
          el.style.removeProperty("--dy");
        }
      };
      requestAnimationFrame(clear);
      if (!t) return;
      if (t.kind === "column") dropIntoColumn(ids, t.id, t.index);
      else if (t.kind === "board") {
        const target = S().ws.cards[t.id];
        if (target?.data.boardId) moveCardsToBoard(ids, target.data.boardId);
      } else if (t.kind === "trash") {
        S().set({ selection: ids });
        deleteSelection();
      } else if (t.kind === "unsorted") {
        sendToUnsorted(ids);
      }
    }
  );
}

/** Drag a card out of the Unsorted drawer onto the board. */
export function startUnsortedDrag(e: React.PointerEvent, id: string) {
  if (e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  let done = false;
  const move = (ev: PointerEvent) => {
    if (done || Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESH) return;
    done = true;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    const p = screenToWorld(ev.clientX, ev.clientY);
    const s = S();
    const c = s.ws.cards[id];
    if (!c) return;
    s.mutate(
      (d) => {
        const cc = d.cards[id];
        cc.unsorted = false;
        cc.parentId = null;
        cc.x = p.x - Math.min(cc.w, 240) / 2;
        cc.y = p.y - 20;
        cc.z = topZ(d as Workspace, s.currentBoardId);
      },
      { history: true }
    );
    s.set({ selection: [id], selectedLines: [] });
    startCardDrag(ev.clientX, ev.clientY, id, { preStarted: true });
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    if (!done) S().set({ selection: [id] });
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/* ---------------- resizing ---------------- */

export function startResize(e: React.PointerEvent, id: string, both: boolean) {
  e.stopPropagation();
  e.preventDefault();
  const s = S();
  const c = s.ws.cards[id];
  if (!c) return;
  s.checkpoint();
  const sx = e.clientX, sy = e.clientY;
  const w0 = c.w;
  const h0 = c.h || cardRect(id)?.h || 200;
  const minW = c.type === "board" ? 100 : c.type === "swatch" ? 90 : 140;
  document.body.classList.add("is-resizing");
  let lastEv: PointerEvent | null = null;
  let raf = 0;
  const apply = () => {
    raf = 0;
    const ev = lastEv;
    if (!ev) return;
    const z = vpOf(S()).zoom;
    S().mutate((d) => {
      const cc = d.cards[id];
      if (!cc) return;
      cc.w = Math.round(Math.max(minW, snapV(w0 + (ev.clientX - sx) / z)));
      if (both) cc.h = Math.round(Math.max(100, snapV(h0 + (ev.clientY - sy) / z)));
    });
  };
  track(
    (ev) => {
      lastEv = ev;
      if (!raf) raf = requestAnimationFrame(apply);
    },
    (ev) => {
      cancelAnimationFrame(raf);
      lastEv = ev;
      apply();
      document.body.classList.remove("is-resizing");
      lastDragEnd = Date.now();
    }
  );
}

/* ---------------- lines ---------------- */

function cardUnder(cx: number, cy: number, exclude?: string | null) {
  for (const el of document.elementsFromPoint(cx, cy) as HTMLElement[]) {
    const n = el.closest<HTMLElement>("[data-card-id]");
    if (n && n.dataset.cardId !== exclude) return n.dataset.cardId!;
  }
  return null;
}

export function startEndpointDrag(e: React.PointerEvent | PointerEvent, lineId: string, which: "from" | "to", isNew = false) {
  e.stopPropagation();
  const s = S();
  if (!isNew) s.checkpoint();
  const sx = e.clientX, sy = e.clientY;
  document.body.classList.add("is-dragging-line");
  track(
    (ev) => {
      const p = screenToWorld(ev.clientX, ev.clientY);
      S().mutate((d) => {
        const l = d.lines[lineId];
        if (l) l[which] = { cardId: null, x: p.x, y: p.y };
      });
      const other = S().ws.lines[lineId]?.[which === "from" ? "to" : "from"].cardId;
      const hover = cardUnder(ev.clientX, ev.clientY, other);
      S().set({ flashId: hover });
    },
    (ev) => {
      document.body.classList.remove("is-dragging-line");
      lastDragEnd = Date.now();
      S().set({ flashId: null });
      const l = S().ws.lines[lineId];
      if (!l) return;
      const other = l[which === "from" ? "to" : "from"].cardId;
      const hit = cardUnder(ev.clientX, ev.clientY, other);
      if (isNew && !hit && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 12) {
        S().mutate((d) => {
          delete d.lines[lineId];
        });
        return;
      }
      if (hit) {
        S().mutate((d) => {
          const ln = d.lines[lineId];
          if (ln) ln[which] = { cardId: hit, x: ln[which].x, y: ln[which].y };
        });
      }
    }
  );
}

export function startConnector(e: React.PointerEvent, cardId: string) {
  e.stopPropagation();
  e.preventDefault();
  const p = screenToWorld(e.clientX, e.clientY);
  const id = createLine({ cardId, x: p.x, y: p.y }, { cardId: null, x: p.x, y: p.y });
  startEndpointDrag(e, id, "to", true);
}

export function startCurveDrag(
  e: React.PointerEvent,
  lineId: string,
  geo: { sx: number; sy: number; ex: number; ey: number; bx: number; by: number }
) {
  e.stopPropagation();
  S().checkpoint();
  track(
    (ev) => {
      const m = screenToWorld(ev.clientX, ev.clientY);
      // control point so that the curve passes through m at t = .5
      const cx = 2 * m.x - (geo.sx + geo.ex) / 2;
      const cy = 2 * m.y - (geo.sy + geo.ey) / 2;
      S().mutate((d) => {
        const l = d.lines[lineId];
        if (l) {
          l.cx = cx - geo.bx;
          l.cy = cy - geo.by;
        }
      });
    },
    () => (lastDragEnd = Date.now())
  );
}

export function startLineBodyDrag(e: React.PointerEvent, lineId: string) {
  e.stopPropagation();
  const s = S();
  if (!(e.shiftKey && s.selectedLines.includes(lineId))) s.set({ selectedLines: e.shiftKey ? [...s.selectedLines, lineId] : [lineId], selection: e.shiftKey ? s.selection : [] });
  const l0 = s.ws.lines[lineId];
  if (!l0 || (l0.from.cardId && l0.to.cardId)) return;
  const sx = e.clientX, sy = e.clientY;
  const f0 = { ...l0.from }, t0 = { ...l0.to };
  let started = false;
  track(
    (ev) => {
      if (!started) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESH) return;
        started = true;
        S().checkpoint();
      }
      const z = vpOf(S()).zoom;
      const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z;
      S().mutate((d) => {
        const l = d.lines[lineId];
        if (!l) return;
        if (!f0.cardId) l.from = { cardId: null, x: f0.x + dx, y: f0.y + dy };
        if (!t0.cardId) l.to = { cardId: null, x: t0.x + dx, y: t0.y + dy };
      });
    },
    () => {
      if (started) lastDragEnd = Date.now();
    }
  );
}

/* ---------------- toolbar drag-to-create ---------------- */

export type ToolKind = CardType | "line" | "upload-image" | "upload-file" | "upload-audio" | "video";

export function createFromTool(kind: ToolKind, at?: { x: number; y: number }, parentId?: string | null, index?: number) {
  if (kind === "line") {
    const s = S();
    const p = at || viewportCenterWorld();
    createLine({ cardId: null, x: p.x - 90, y: p.y }, { cardId: null, x: p.x + 90, y: p.y });
    s.set({ selection: [] });
    return;
  }
  if (kind === "upload-image") return openFilePicker("image/*", at, parentId, index);
  if (kind === "upload-file") return openFilePicker("*/*", at, parentId, index);
  if (kind === "upload-audio") return openFilePicker("audio/*", at, parentId, index);
  if (kind === "video") {
    createCard("link", at, { parentId: parentId || null, index, focus: true, data: { url: "", status: "idle", description: "video" } });
    return;
  }
  const focus = ["note", "todo", "link", "column", "comment", "table", "sketch", "document", "board", "heading", "map"].includes(kind);
  const id = createCard(kind, at, { parentId: parentId || null, index, focus: focus && kind !== "document" && kind !== "board" });
  if (kind === "board") S().set({ focusRequest: id });
  if (kind === "document") S().set({ modal: { type: "document", id } });
}

export function startToolDrag(e: React.PointerEvent, kind: ToolKind, label: string) {
  if (e.button !== 0) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY;
  let ghost: HTMLDivElement | null = null;
  track(
    (ev) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESH) return;
        ghost = document.createElement("div");
        ghost.className = "tool-ghost";
        ghost.textContent = label;
        document.body.appendChild(ghost);
        document.body.classList.add("is-dragging");
      }
      ghost.style.transform = `translate(${ev.clientX - 60}px, ${ev.clientY - 20}px)`;
      const t = kind === "column" || kind === "line" ? null : hitTest(ev.clientX, ev.clientY, new Set(), true);
      const tt = t && t.kind === "column" ? t : null;
      if (JSON.stringify(S().dropTarget) !== JSON.stringify(tt)) S().set({ dropTarget: tt });
    },
    (ev) => {
      document.body.classList.remove("is-dragging");
      const t = S().dropTarget;
      S().set({ dropTarget: null });
      if (!ghost) {
        // simple click: create in a free spot near the middle of the view
        createFromTool(kind, kind === "line" ? undefined : freeSpot(kind));
        return;
      }
      ghost.remove();
      if (t && t.kind === "column") {
        createFromTool(kind, undefined, t.id, t.index);
        return;
      }
      if (!overViewport(ev.clientX, ev.clientY)) return;
      createFromTool(kind, screenToWorld(ev.clientX, ev.clientY));
    }
  );
}

export function isTyping() {
  return isTypingTarget(document.activeElement);
}
