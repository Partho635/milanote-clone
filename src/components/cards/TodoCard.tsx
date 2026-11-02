"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Card, TodoItem } from "@/lib/types";
import { updateCard } from "@/lib/actions";
import { S, useStore } from "@/lib/store";
import { uid } from "@/lib/utils";
import { AutoTextarea } from "../AutoTextarea";
import { MetaChips } from "./CardExtras";

export function TodoCard({ card }: { card: Card }) {
  const items = card.data.items || [];
  const done = items.filter((i) => i.done).length;
  const showTitle = card.data.showTitle ?? !!card.data.title;
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const wantFocus = useStore((s) => s.focusRequest === card.id);
  const active = useStore((s) => (s.activeItem?.cardId === card.id ? s.activeItem.itemId : null));

  useEffect(() => {
    if (wantFocus) {
      const el = root.current?.querySelector<HTMLTextAreaElement>(showTitle && !card.data.title ? "textarea[data-title]" : "textarea[data-item]");
      el?.focus();
      S().set({ focusRequest: null });
    }
  }, [wantFocus, card.data.title, showTitle]);

  useEffect(() => {
    if (!focusItem) return;
    const el = root.current?.querySelector<HTMLTextAreaElement>(`[data-item="${focusItem}"]`);
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    setFocusItem(null);
  }, [focusItem]);

  const setItems = (next: TodoItem[], coalesce?: string) => updateCard(card.id, { items: next }, coalesce);
  const activate = (itemId: string) => {
    const s = S();
    if (s.activeItem?.itemId !== itemId) s.set({ activeItem: { cardId: card.id, itemId }, selection: [card.id] });
  };

  return (
    <div className="todo-body" ref={root}>
      {showTitle && (
        <div className="todo-head">
          <AutoTextarea
            data-title
            className="todo-title"
            placeholder="Title"
            value={card.data.title || ""}
            onChange={(e) => updateCard(card.id, { title: e.target.value }, "title-" + card.id)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                if (items[0]) setFocusItem(items[0].id);
              }
            }}
          />
          {items.length > 1 && (
            <span className="todo-progress" title={`${done} of ${items.length} done`}>
              {done}/{items.length}
            </span>
          )}
        </div>
      )}
      {showTitle && items.length > 1 && (
        <div className="todo-bar">
          <div style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      )}
      <ul className="todo-list">
        {items.map((it, idx) => (
          <li key={it.id} className={(it.done ? "done" : "") + (active === it.id ? " active" : "")} onPointerDown={() => activate(it.id)}>
            <div className="todo-row">
              <button
                data-nodrag
                className={"check" + (it.done ? " on" : "")}
                onClick={() => setItems(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
                aria-label="Toggle"
              >
                <svg viewBox="0 0 16 16" width="12" height="12">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <AutoTextarea
                data-item={it.id}
                placeholder="Add a task…"
                value={it.text}
                onFocus={() => activate(it.id)}
                onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)), "todo-" + card.id)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const el = e.currentTarget;
                    const before = it.text.slice(0, el.selectionStart);
                    const after = it.text.slice(el.selectionEnd);
                    const n = { id: uid(), text: after, done: false };
                    const next = [...items];
                    next.splice(idx, 1, { ...it, text: before }, n);
                    setItems(next);
                    setFocusItem(n.id);
                  } else if (e.key === "Backspace" && it.text === "" && items.length > 1) {
                    e.preventDefault();
                    const prev = items[idx - 1] || items[idx + 1];
                    setItems(items.filter((x) => x.id !== it.id));
                    setFocusItem(prev.id);
                  } else if (e.key === "ArrowUp" && idx > 0 && e.currentTarget.selectionStart === 0) {
                    setFocusItem(items[idx - 1].id);
                  } else if (e.key === "ArrowDown" && idx < items.length - 1 && e.currentTarget.selectionEnd === it.text.length) {
                    setFocusItem(items[idx + 1].id);
                  }
                }}
              />
              {items.length > 1 && (
                <button data-nodrag className="todo-del" onClick={() => setItems(items.filter((x) => x.id !== it.id))} aria-label="Remove">
                  <X size={12} />
                </button>
              )}
            </div>
            <MetaChips target={{ cardId: card.id, itemId: it.id }} labels={it.labels} reactions={it.reactions} due={it.due} assignee={it.assignee} done={it.done} />
          </li>
        ))}
      </ul>
    </div>
  );
}
