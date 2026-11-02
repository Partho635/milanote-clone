"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser, Trash, Undo2, X } from "lucide-react";
import type { Card, Stroke } from "@/lib/types";
import { updateCard } from "@/lib/actions";
import { S, useStore } from "@/lib/store";
import { justDragged } from "@/lib/interactions";
import { timeAgo, uid } from "@/lib/utils";
import { colorName, readableOn } from "@/lib/data";
import { AutoTextarea } from "../AutoTextarea";

/* ---------------- comment ---------------- */

const avatarColor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 60% 52%)`;
};

export function CommentCard({ card }: { card: Card }) {
  const comments = card.data.comments || [];
  const user = useStore((s) => s.ws.settings.userName || "Me");
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const wantFocus = useStore((s) => s.focusRequest === card.id);
  useEffect(() => {
    if (wantFocus) {
      ref.current?.focus();
      S().set({ focusRequest: null });
    }
  }, [wantFocus]);
  const post = () => {
    if (!text.trim()) return;
    updateCard(card.id, { comments: [...comments, { id: uid(), author: user, text: text.trim(), at: Date.now() }] });
    setText("");
  };
  return (
    <div className="comment-body">
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <div className="avatar" style={{ background: avatarColor(c.author) }}>
            {c.author.slice(0, 1).toUpperCase()}
          </div>
          <div className="comment-main">
            <div className="comment-meta">
              <b>{c.author}</b>
              <span>{timeAgo(c.at)}</span>
              <button data-nodrag className="comment-del" onClick={() => updateCard(card.id, { comments: comments.filter((x) => x.id !== c.id) })} aria-label="Delete comment">
                <X size={12} />
              </button>
            </div>
            <div className="comment-text">{c.text}</div>
          </div>
        </div>
      ))}
      <div className="comment-input">
        <div className="avatar small" style={{ background: avatarColor(user) }}>
          {user.slice(0, 1).toUpperCase()}
        </div>
        <AutoTextarea
          ref={ref}
          placeholder={comments.length ? "Reply…" : "Write a comment…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              post();
            }
          }}
        />
      </div>
    </div>
  );
}

/* ---------------- colour swatch ---------------- */

export function SwatchCard({ card }: { card: Card }) {
  const color = card.data.color || "#f5a623";
  const picker = useRef<HTMLInputElement>(null);
  const [hex, setHex] = useState(color);
  useEffect(() => setHex(color), [color]);
  const auto = colorName(color);
  return (
    <div className="swatch-body">
      <div className="swatch-color" style={{ background: color, color: readableOn(color) }} onDoubleClick={() => picker.current?.click()} title="Double-click to change colour">
        <input
          className="swatch-hex"
          value={hex.toUpperCase()}
          data-nodrag
          onChange={(e) => {
            setHex(e.target.value);
            const v = e.target.value.trim();
            if (/^#?[\da-f]{6}$/i.test(v)) updateCard(card.id, { color: v.startsWith("#") ? v.toLowerCase() : "#" + v.toLowerCase() }, "swatch-" + card.id);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onBlur={() => setHex(color)}
        />
        <input ref={picker} type="color" value={/^#[\da-f]{6}$/i.test(color) ? color : "#000000"} onChange={(e) => updateCard(card.id, { color: e.target.value }, "swatch-" + card.id)} tabIndex={-1} />
      </div>
      <input
        className="swatch-name"
        placeholder={auto || "Name"}
        value={card.data.name || ""}
        onChange={(e) => updateCard(card.id, { name: e.target.value }, "swname-" + card.id)}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/* ---------------- sketch ---------------- */

const PEN_COLORS = ["#1f2328", "#e25563", "#f5a623", "#2bb39a", "#4f7cff", "#8b5cf6", "#ffffff"];

function pathFor(pts: [number, number][]) {
  if (!pts.length) return "";
  if (pts.length < 3) {
    const [x, y] = pts[0];
    const [x2, y2] = pts[pts.length - 1];
    return `M${x} ${y} L${x2 + 0.01} ${y2}`;
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

export function SketchCard({ card }: { card: Card }) {
  const d = card.data;
  const strokes = d.strokes || [];
  const vbW = d.vbW || 340;
  const vbH = d.vbH || 260;
  const drawing = useStore((s) => s.drawingId === card.id);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(3);
  const [eraser, setEraser] = useState(false);
  const [live, setLive] = useState<Stroke | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const toLocal = (e: React.PointerEvent | PointerEvent): [number, number] => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = el.getScreenCTM();
    const p = m ? pt.matrixTransform(m.inverse()) : pt;
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
  };

  const onDown = (e: React.PointerEvent) => {
    if (!drawing) return;
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (eraser) {
      S().checkpoint();
      const erase = (ev: PointerEvent | React.PointerEvent) => {
        const [x, y] = toLocal(ev);
        const cur = S().ws.cards[card.id]?.data.strokes || [];
        const r = 10;
        const keep = cur.filter((s) => !s.d.some(([px, py]) => Math.hypot(px - x, py - y) < r + s.size));
        if (keep.length !== cur.length)
          S().mutate((dd) => {
            dd.cards[card.id].data.strokes = keep;
          });
      };
      erase(e);
      const move = (ev: PointerEvent) => erase(ev);
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    const stroke: Stroke = { d: [toLocal(e)], color, size };
    setLive(stroke);
    const move = (ev: PointerEvent) => {
      const p = toLocal(ev);
      const last = stroke.d[stroke.d.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5) return;
      stroke.d.push(p);
      setLive({ ...stroke, d: [...stroke.d] });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLive(null);
      const cur = S().ws.cards[card.id]?.data.strokes || [];
      updateCard(card.id, { strokes: [...cur, stroke] });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const all = live ? [...strokes, live] : strokes;
  return (
    <div className={"sketch-body" + (drawing ? " drawing" : "")} onDoubleClick={() => S().set({ drawingId: card.id })}>
      {drawing && (
        <div className="sketch-tools no-export" data-nodrag>
          {PEN_COLORS.map((c) => (
            <button key={c} className={"pen" + (c === color && !eraser ? " on" : "")} style={{ background: c }} onClick={() => (setColor(c), setEraser(false))} aria-label={c} />
          ))}
          <span className="sep" />
          {[2, 4, 8].map((s) => (
            <button key={s} className={"size" + (s === size && !eraser ? " on" : "")} onClick={() => (setSize(s), setEraser(false))} aria-label={`Size ${s}`}>
              <i style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
          <button className={"tool" + (eraser ? " on" : "")} onClick={() => setEraser(!eraser)} title="Eraser">
            <Eraser size={14} />
          </button>
          <button className="tool" onClick={() => strokes.length && updateCard(card.id, { strokes: strokes.slice(0, -1) })} title="Undo stroke">
            <Undo2 size={14} />
          </button>
          <button className="tool" onClick={() => strokes.length && updateCard(card.id, { strokes: [] })} title="Clear">
            <Trash size={14} />
          </button>
          <button className="done" onClick={() => S().set({ drawingId: null })}>
            Done
          </button>
        </div>
      )}
      <svg
        ref={svg}
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ height: card.h ? card.h : 260 }}
        onPointerDown={onDown}
        {...(drawing ? { "data-nodrag": true } : {})}
        className={eraser ? "erasing" : ""}
      >
        {all.map((s, i) => (
          <path key={i} d={pathFor(s.d)} stroke={s.color} strokeWidth={s.size} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      {!drawing && strokes.length === 0 && (
        <div className="sketch-hint">Double-click to draw</div>
      )}
    </div>
  );
}
