"use client";
import { useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import type { Card } from "@/lib/types";
import { itemCount, navigate, renameBoard, updateCard } from "@/lib/actions";
import { S, useStore } from "@/lib/store";
import { justDragged } from "@/lib/interactions";
import { BOARD_TILE, htmlToText } from "@/lib/utils";
import { CardView } from "../CardView";
import { AutoTextarea } from "../AutoTextarea";

export function BoardCard({ card }: { card: Card }) {
  const bid = card.data.boardId!;
  const board = useStore((s) => s.ws.boards[bid]);
  const count = useStore((s) => itemCount(s.ws, bid));
  const isDrop = useStore((s) => s.dropTarget?.kind === "board" && s.dropTarget.id === card.id);
  const wantFocus = useStore((s) => s.focusRequest === card.id);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (wantFocus && input.current) {
      input.current.focus();
      input.current.select();
      S().set({ focusRequest: null });
    }
  }, [wantFocus]);
  if (!board) return <div className="board-missing">Missing board</div>;
  return (
    <div className="board-body">
      <div
        className={"board-tile" + (isDrop ? " drop" : "")}
        style={{ background: BOARD_TILE[card.color] || BOARD_TILE.default }}
        onClick={() => !justDragged() && navigate(bid)}
        title="Open board"
      >
        <span className="board-icon">{board.icon}</span>
      </div>
      <AutoTextarea
        ref={input}
        className="board-title"
        value={board.title}
        placeholder="Untitled"
        onChange={(e) => renameBoard(bid, e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      <div className="board-count">{`${count} card${count === 1 ? "" : "s"}`}</div>
    </div>
  );
}

export function ColumnCard({ card }: { card: Card }) {
  const cards = useStore((s) => s.ws.cards);
  const children = useMemo(
    () =>
      Object.values(cards)
        .filter((c) => c.parentId === card.id && !c.deleted)
        .sort((a, b) => a.order - b.order),
    [cards, card.id]
  );
  const drop = useStore((s) => (s.dropTarget?.kind === "column" && s.dropTarget.id === card.id ? s.dropTarget.index : -1));
  const wantFocus = useStore((s) => s.focusRequest === card.id);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (wantFocus) {
      input.current?.focus();
      S().set({ focusRequest: null });
    }
  }, [wantFocus]);
  const collapsed = !!card.data.collapsed;
  const items: React.ReactNode[] = children.map((c) => <CardView key={c.id} id={c.id} inColumn />);
  if (drop >= 0) items.splice(drop, 0, <div key="__ph" className="col-placeholder" />);
  return (
    <div className={"column-body" + (drop >= 0 ? " drop" : "")}>
      <div className="column-head">
        <button data-nodrag className="col-collapse" onClick={() => updateCard(card.id, { collapsed: !collapsed })} aria-label="Collapse">
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        <AutoTextarea
          ref={input}
          className="column-title"
          placeholder="Untitled column"
          value={card.data.title || ""}
          onChange={(e) => updateCard(card.id, { title: e.target.value }, "coltitle-" + card.id)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
      <div className="col-sub">{children.length} card{children.length === 1 ? "" : "s"}</div>
      {!collapsed ? (
        <div className="column-cards" data-col-body>
          {items}
          {children.length === 0 && drop < 0 && <div className="col-empty">Drag cards here</div>}
        </div>
      ) : (
        <div className="col-collapsed" data-col-body>
          {drop >= 0 ? <div className="col-placeholder" /> : `${children.length} card${children.length === 1 ? "" : "s"} hidden`}
        </div>
      )}
    </div>
  );
}

export function DocumentCard({ card }: { card: Card }) {
  const d = card.data;
  const text = htmlToText(d.html);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const open = () => !justDragged() && S().set({ modal: { type: "document", id: card.id } });
  const tint = card.color && card.color !== "default" ? undefined : "#e8eaee";
  if (d.cardView)
    return (
      <div className="doc-page" onDoubleClick={open}>
        <div className="doc-page-inner" dangerouslySetInnerHTML={{ __html: d.html || "<p class='muted'>Empty document</p>" }} />
        <div className="doc-page-foot" onClick={open}>
          <FileText size={15} />
          <div>
            <div className="doc-title">{d.title || "New document"}</div>
            <div className="doc-words">{words} word{words === 1 ? "" : "s"}</div>
          </div>
        </div>
      </div>
    );
  return (
    <div className="doc-icon-view" onClick={open}>
      <div className="doc-file" style={tint ? { background: tint } : undefined}>
        <FileText size={22} />
      </div>
      <div className="doc-title">{d.title || "New document"}</div>
      <div className="doc-words">{words} word{words === 1 ? "" : "s"}</div>
    </div>
  );
}
