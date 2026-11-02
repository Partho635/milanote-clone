"use client";
import { useEffect, useRef, useState } from "react";
import type { Card, Cell } from "@/lib/types";
import { updateCard } from "@/lib/actions";
import { S, useStore } from "@/lib/store";
import { normalizeCells } from "../LeftToolbar";

const colName = (i: number) => {
  let s = "";
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
};

function parseRef(ref: string) {
  const m = /^([A-Z]+)(\d+)$/.exec(ref.toUpperCase());
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: parseInt(m[2], 10) - 1, c: c - 1 };
}

/** Tiny spreadsheet formula engine: refs, ranges, + - * / ( ), SUM AVERAGE MIN MAX COUNT. */
export function evaluate(v: string, cells: Cell[][], depth = 0): string {
  if (!v.startsWith("=")) return v;
  if (depth > 20) return "#CYCLE";
  const num = (ref: string): number => {
    const p = parseRef(ref);
    if (!p) return NaN;
    const raw = cells[p.r]?.[p.c]?.v ?? "";
    const val = raw.startsWith("=") ? evaluate(raw, cells, depth + 1) : raw;
    const n = parseFloat(String(val).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  };
  const rangeVals = (a: string, b: string) => {
    const p = parseRef(a), q = parseRef(b);
    if (!p || !q) return [];
    const out: number[] = [];
    for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++)
      for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) {
        const raw = cells[r]?.[c]?.v ?? "";
        if (raw === "") continue;
        const val = raw.startsWith("=") ? evaluate(raw, cells, depth + 1) : raw;
        const n = parseFloat(String(val).replace(/,/g, ""));
        if (!isNaN(n)) out.push(n);
      }
    return out;
  };
  try {
    let expr = v.slice(1).toUpperCase();
    expr = expr.replace(/(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(\s*([A-Z]+\d+)\s*:\s*([A-Z]+\d+)\s*\)/g, (_, fn, a, b) => {
      const vals = rangeVals(a, b);
      if (fn === "SUM") return String(vals.reduce((x, y) => x + y, 0));
      if (fn === "AVERAGE" || fn === "AVG") return String(vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0);
      if (fn === "MIN") return String(vals.length ? Math.min(...vals) : 0);
      if (fn === "MAX") return String(vals.length ? Math.max(...vals) : 0);
      return String(vals.length);
    });
    expr = expr.replace(/[A-Z]+\d+/g, (ref) => `(${num(ref)})`);
    if (!/^[\d+\-*/().\s%]+$/.test(expr)) return "#ERR";
    const res = Function(`"use strict"; return (${expr});`)();
    if (typeof res !== "number" || !isFinite(res)) return "#ERR";
    return String(Math.round(res * 1e8) / 1e8);
  } catch {
    return "#ERR";
  }
}

export function TableCard({ card }: { card: Card }) {
  const cells = normalizeCells(card);
  const rows = cells.length;
  const cols = cells[0]?.length || 1;
  const sel = useStore((s) => (s.tableSel?.cardId === card.id ? s.tableSel : null));
  const wantFocus = useStore((s) => s.focusRequest === card.id);
  const [editing, setEditing] = useState<{ r: number; c: number; v: string } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wantFocus) {
      S().set({ focusRequest: null, tableSel: { cardId: card.id, r0: 0, c0: 0, r1: 0, c1: 0 }, selection: [card.id] });
      setEditing({ r: 0, c: 0, v: cells[0]?.[0]?.v || "" });
    }
  }, [wantFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sel && !editing) grid.current?.focus({ preventScroll: true });
    if (!sel) setEditing(null);
  }, [sel?.r1, sel?.c1, !!sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (next: Cell[][]) => updateCard(card.id, { cells: next });
  const commit = (move?: [number, number], refocus = !!move) => {
    if (!editing) return;
    const next = cells.map((r) => r.map((c) => ({ ...c })));
    if (next[editing.r]?.[editing.c] && next[editing.r][editing.c].v !== editing.v) {
      next[editing.r][editing.c].v = editing.v;
      save(next);
    }
    const r = editing.r, c = editing.c;
    setEditing(null);
    if (move) {
      let nr = r + move[0], nc = c + move[1];
      if (nc >= cols) {
        nc = 0;
        nr++;
      }
      nr = Math.max(0, nr);
      nc = Math.max(0, nc);
      if (nr >= rows) save([...next, next[0].map(() => ({ v: "" }))]);
      S().set({ tableSel: { cardId: card.id, r0: nr, c0: nc, r1: nr, c1: nc } });
    }
    if (refocus) grid.current?.focus({ preventScroll: true });
  };

  const inSel = (r: number, c: number) =>
    !!sel && r >= Math.min(sel.r0, sel.r1) && r <= Math.max(sel.r0, sel.r1) && c >= Math.min(sel.c0, sel.c1) && c <= Math.max(sel.c0, sel.c1);

  const onCellDown = (e: React.PointerEvent, r: number, c: number) => {
    if (e.button !== 0) return;
    if (editing && editing.r === r && editing.c === c) return;
    if (editing) commit();
    e.preventDefault();
    const s = S();
    const anchor = e.shiftKey && sel ? { r0: sel.r0, c0: sel.c0 } : { r0: r, c0: c };
    s.set({ tableSel: { cardId: card.id, ...anchor, r1: r, c1: c }, selection: [card.id], selectedLines: [] });
    const move = (ev: PointerEvent) => {
      const el = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-cell]");
      if (!el || !grid.current?.contains(el)) return;
      const [rr, cc] = el.dataset.cell!.split("-").map(Number);
      const cur = S().tableSel;
      if (cur && (cur.r1 !== rr || cur.c1 !== cc)) S().set({ tableSel: { ...cur, r1: rr, c1: cc } });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!sel || editing) return;
    e.stopPropagation();
    const r = sel.r1, c = sel.c1;
    const go = (nr: number, nc: number) => {
      nr = Math.max(0, Math.min(rows - 1, nr));
      nc = Math.max(0, Math.min(cols - 1, nc));
      S().set({ tableSel: e.shiftKey ? { ...sel, r1: nr, c1: nc } : { cardId: card.id, r0: nr, c0: nc, r1: nr, c1: nc } });
    };
    if (e.key === "ArrowUp") (e.preventDefault(), go(r - 1, c));
    else if (e.key === "ArrowDown") (e.preventDefault(), go(r + 1, c));
    else if (e.key === "ArrowLeft") (e.preventDefault(), go(r, c - 1));
    else if (e.key === "ArrowRight" || e.key === "Tab") (e.preventDefault(), go(r, c + 1));
    else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      setEditing({ r, c, v: cells[r]?.[c]?.v || "" });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const next = cells.map((row, ri) => row.map((cell, ci) => (inSel(ri, ci) ? { ...cell, v: "" } : cell)));
      save(next);
    } else if (e.key === "Escape") {
      S().set({ tableSel: null });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      const bold = !cells[r]?.[c]?.bold;
      save(cells.map((row, ri) => row.map((cell, ci) => (inSel(ri, ci) ? { ...cell, bold } : cell))));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setEditing({ r, c, v: e.key });
    }
  };

  return (
    <div className="sheet" style={{ gridTemplateColumns: `30px repeat(${cols}, minmax(56px, 1fr))` }}>
      <div className="sheet-corner" />
      {Array.from({ length: cols }, (_, c) => (
        <div key={"h" + c} className={"sheet-colh" + (sel && c >= Math.min(sel.c0, sel.c1) && c <= Math.max(sel.c0, sel.c1) ? " on" : "")}>
          {colName(c)}
        </div>
      ))}
      <div
        ref={grid}
        className="sheet-body"
        style={{ gridColumn: `1 / span ${cols + 1}`, gridTemplateColumns: `30px repeat(${cols}, minmax(56px, 1fr))` }}
        tabIndex={-1}
        data-keys
        onKeyDown={onKey}
      >
        {cells.map((row, r) => (
          <div key={r} className="sheet-row" style={{ display: "contents" }}>
            <div className={"sheet-rowh" + (sel && r >= Math.min(sel.r0, sel.r1) && r <= Math.max(sel.r0, sel.r1) ? " on" : "")}>{r + 1}</div>
            {row.map((cell, c) => {
              const isEd = editing && editing.r === r && editing.c === c;
              const shown = evaluate(cell.v, cells);
              const numeric = shown !== "" && !isNaN(Number(shown));
              return (
                <div
                  key={c}
                  data-cell={`${r}-${c}`}
                  data-nodrag
                  className={"sheet-cell" + (r === 0 ? " head" : "") + (inSel(r, c) ? " sel" : "") + (sel && sel.r1 === r && sel.c1 === c ? " cursor" : "")}
                  style={{
                    background: cell.bg,
                    color: cell.color,
                    textAlign: cell.align || (numeric && r > 0 ? "right" : "left"),
                    fontWeight: cell.bold || r === 0 ? 700 : undefined,
                  }}
                  onPointerDown={(e) => onCellDown(e, r, c)}
                  onDoubleClick={() => setEditing({ r, c, v: cell.v })}
                  title={cell.v.startsWith("=") ? cell.v : undefined}
                >
                  {isEd ? (
                    <input
                      ref={(el) => {
                        input.current = el;
                        if (el && document.activeElement !== el) {
                          el.focus({ preventScroll: true });
                          el.setSelectionRange(el.value.length, el.value.length);
                        }
                      }}
                      value={editing.v}
                      onChange={(e) => setEditing({ ...editing, v: e.target.value })}
                      onBlur={() => commit()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") (e.preventDefault(), commit([1, 0]));
                        else if (e.key === "Tab") (e.preventDefault(), commit([0, e.shiftKey ? -1 : 1]));
                        else if (e.key === "Escape") {
                          setEditing(null);
                          grid.current?.focus({ preventScroll: true });
                        }
                      }}
                    />
                  ) : (
                    <span className={shown.startsWith("#") && cell.v.startsWith("=") ? "err" : ""}>{shown}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
