"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Trash } from "lucide-react";
import { useStore, vpOf, S } from "@/lib/store";
import { cardRect, type Rect } from "@/lib/canvas";
import type { Line } from "@/lib/types";
import { patchLine } from "@/lib/actions";
import { startCurveDrag, startEndpointDrag, startLineBodyDrag } from "@/lib/interactions";

const LINE_COLORS = ["#5b6573", "#1f2328", "#e25563", "#f5a623", "#2bb39a", "#4f7cff", "#8b5cf6"];

type P = { x: number; y: number };

function edgePoint(r: Rect, toward: P, gap = 6): P {
  const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  const dx = toward.x - c.x, dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const tx = dx ? r.w / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? r.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty, 1);
  const len = Math.hypot(dx, dy);
  return { x: c.x + dx * t + (dx / len) * gap, y: c.y + dy * t + (dy / len) * gap };
}

export function lineGeometry(l: Line, rects: Record<string, Rect>) {
  const ra = l.from.cardId ? rects[l.from.cardId] : null;
  const rb = l.to.cardId ? rects[l.to.cardId] : null;
  if ((l.from.cardId && !ra) || (l.to.cardId && !rb)) return null;
  const aRef = ra ? { x: ra.x + ra.w / 2, y: ra.y + ra.h / 2 } : { x: l.from.x, y: l.from.y };
  const bRef = rb ? { x: rb.x + rb.w / 2, y: rb.y + rb.h / 2 } : { x: l.to.x, y: l.to.y };
  const bx = (aRef.x + bRef.x) / 2, by = (aRef.y + bRef.y) / 2;
  const C = { x: bx + l.cx, y: by + l.cy };
  const s = ra ? edgePoint(ra, l.cx || l.cy ? C : bRef) : aRef;
  const e = rb ? edgePoint(rb, l.cx || l.cy ? C : aRef) : bRef;
  const M = { x: 0.25 * s.x + 0.5 * C.x + 0.25 * e.x, y: 0.25 * s.y + 0.5 * C.y + 0.25 * e.y };
  return { s, e, C, M, bx, by };
}

function arrow(tip: P, from: P, size: number) {
  let dx = tip.x - from.x, dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const bx = tip.x - dx * size, by = tip.y - dy * size;
  const px = -dy * size * 0.55, py = dx * size * 0.55;
  return `M${tip.x} ${tip.y} L${bx + px} ${by + py} L${bx - px} ${by - py} Z`;
}

export function LinesLayer() {
  const boardId = useStore((s) => s.currentBoardId);
  const linesMap = useStore((s) => s.ws.lines);
  const selected = useStore((s) => s.selectedLines);
  const zoom = useStore((s) => vpOf(s).zoom);
  const lines = useMemo(() => Object.values(linesMap).filter((l) => l.boardId === boardId), [linesMap, boardId]);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [rects, setRects] = useState<Record<string, Rect>>({});

  // Track positions of connected cards every frame (cheap: only connected cards are measured).
  useEffect(() => {
    let raf = 0;
    let prev = "";
    const loop = () => {
      const out: Record<string, Rect> = {};
      let sig = "";
      for (const l of linesRef.current) {
        for (const id of [l.from.cardId, l.to.cardId]) {
          if (!id || out[id]) continue;
          const r = cardRect(id);
          if (r) {
            out[id] = r;
            sig += `${id}:${r.x},${r.y},${r.w},${r.h};`;
          }
        }
      }
      if (sig !== prev) {
        prev = sig;
        setRects(out);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const items = lines.map((l) => ({ l, g: lineGeometry(l, rects) })).filter((x) => x.g) as { l: Line; g: NonNullable<ReturnType<typeof lineGeometry>> }[];
  const inv = 1 / zoom;

  return (
    <>
      <svg className="lines-layer">
        {items.map(({ l, g }) => {
          const d = `M${g.s.x} ${g.s.y} Q${g.C.x} ${g.C.y} ${g.e.x} ${g.e.y}`;
          const isSel = selected.includes(l.id);
          const size = 9 + l.width * 1.6;
          return (
            <g key={l.id}>
              {isSel && <path d={d} stroke="var(--accent)" strokeOpacity={0.25} strokeWidth={l.width + 8} fill="none" strokeLinecap="round" />}
              <path d={d} stroke={l.color} strokeWidth={l.width} strokeDasharray={l.dashed ? `${l.width * 3} ${l.width * 3}` : undefined} fill="none" strokeLinecap="round" />
              {l.arrowEnd && <path d={arrow(g.e, g.C.x === g.e.x && g.C.y === g.e.y ? g.s : g.C, size)} fill={l.color} />}
              {l.arrowStart && <path d={arrow(g.s, g.C.x === g.s.x && g.C.y === g.s.y ? g.e : g.C, size)} fill={l.color} />}
              <path
                d={d}
                className="line-hit"
                stroke="transparent"
                strokeWidth={Math.max(14, 14 * inv)}
                fill="none"
                onPointerDown={(e) => startLineBodyDrag(e, l.id)}
                onDoubleClick={() => {
                  S().set({ selectedLines: [l.id] });
                  setTimeout(() => document.querySelector<HTMLInputElement>(".line-toolbar input")?.focus(), 30);
                }}
              />
            </g>
          );
        })}
      </svg>
      <div className="lines-labels">
        {items.map(({ l, g }) =>
          l.label ? (
            <div
              key={"lb" + l.id}
              className="line-label"
              style={{ left: g.M.x, top: g.M.y, color: l.color }}
              onPointerDown={(e) => startLineBodyDrag(e, l.id)}
            >
              {l.label}
            </div>
          ) : null
        )}
      </div>
      <div className="lines-overlay">
        {items
          .filter(({ l }) => selected.includes(l.id) && selected.length === 1)
          .map(({ l, g }) => (
            <div key={"h" + l.id} className="no-export">
              <div
                className="line-handle end"
                style={{ left: g.s.x, top: g.s.y, transform: `translate(-50%,-50%) scale(${inv})` }}
                onPointerDown={(e) => startEndpointDrag(e, l.id, "from")}
              />
              <div
                className="line-handle end"
                style={{ left: g.e.x, top: g.e.y, transform: `translate(-50%,-50%) scale(${inv})` }}
                onPointerDown={(e) => startEndpointDrag(e, l.id, "to")}
              />
              <div
                className="line-handle mid"
                style={{ left: g.M.x, top: g.M.y, transform: `translate(-50%,-50%) scale(${inv})` }}
                onPointerDown={(e) => startCurveDrag(e, l.id, { sx: g.s.x, sy: g.s.y, ex: g.e.x, ey: g.e.y, bx: g.bx, by: g.by })}
                onDoubleClick={() => patchLine(l.id, { cx: 0, cy: 0 })}
                title="Drag to curve · double-click to straighten"
              />
              <LineToolbar line={l} x={g.M.x} y={g.M.y - 22 * inv} inv={inv} />
            </div>
          ))}
      </div>
    </>
  );
}

function LineToolbar({ line, x, y, inv }: { line: Line; x: number; y: number; inv: number }) {
  return (
    <div
      className="line-toolbar"
      style={{ left: x, top: y, transform: `translate(-50%,-100%) scale(${inv})`, transformOrigin: "50% 100%" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {LINE_COLORS.map((c) => (
        <button key={c} className={"dot" + (line.color === c ? " on" : "")} style={{ background: c }} onClick={() => patchLine(line.id, { color: c })} aria-label={c} />
      ))}
      <span className="sep" />
      <button className={"tb" + (line.arrowStart ? " on" : "")} onClick={() => patchLine(line.id, { arrowStart: !line.arrowStart })} title="Arrow at start">
        <ArrowLeft size={14} />
      </button>
      <button className={"tb" + (line.arrowEnd ? " on" : "")} onClick={() => patchLine(line.id, { arrowEnd: !line.arrowEnd })} title="Arrow at end">
        <ArrowRight size={14} />
      </button>
      <button className={"tb" + (line.dashed ? " on" : "")} onClick={() => patchLine(line.id, { dashed: !line.dashed })} title="Dashed">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M1 8h3M6.5 8h3M12 8h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button className="tb" onClick={() => patchLine(line.id, { width: line.width >= 6 ? 1.5 : line.width < 2 ? 2 : line.width < 4 ? 4 : 6 })} title="Thickness">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path d="M2 8h12" stroke="currentColor" strokeWidth={Math.min(line.width, 5)} strokeLinecap="round" />
        </svg>
      </button>
      <input
        placeholder="Label"
        value={line.label}
        onChange={(e) => patchLine(line.id, { label: e.target.value }, "label-" + line.id)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
        }}
      />
      <button
        className="tb danger"
        onClick={() => {
          S().mutate((d) => {
            delete d.lines[line.id];
          }, { history: true });
          S().set({ selectedLines: [] });
        }}
        title="Delete line"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}
