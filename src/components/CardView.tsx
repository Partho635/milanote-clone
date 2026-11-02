"use client";
import { memo } from "react";
import { Lock } from "lucide-react";
import { useStore, S } from "@/lib/store";
import { onCardPointerDown, startConnector, startResize } from "@/lib/interactions";
import type { Card } from "@/lib/types";
import { isHex, readableOn } from "@/lib/data";
import { NoteCard } from "./cards/NoteCard";
import { TodoCard } from "./cards/TodoCard";
import { LinkCard } from "./cards/LinkCard";
import { FileCard, ImageCard } from "./cards/MediaCards";
import { BoardCard, ColumnCard, DocumentCard } from "./cards/StructureCards";
import { CommentCard, SketchCard, SwatchCard } from "./cards/MiscCards";
import { TableCard } from "./cards/TableCard";
import { HeadingCard, MapCard } from "./cards/ExtraCards";
import { CommentPin, MetaChips } from "./cards/CardExtras";

function Content({ card }: { card: Card }) {
  switch (card.type) {
    case "note":
      return <NoteCard card={card} />;
    case "todo":
      return <TodoCard card={card} />;
    case "link":
      return <LinkCard card={card} />;
    case "image":
      return <ImageCard card={card} />;
    case "file":
      return <FileCard card={card} />;
    case "board":
      return <BoardCard card={card} />;
    case "column":
      return <ColumnCard card={card} />;
    case "comment":
      return <CommentCard card={card} />;
    case "sketch":
      return <SketchCard card={card} />;
    case "swatch":
      return <SwatchCard card={card} />;
    case "table":
      return <TableCard card={card} />;
    case "document":
      return <DocumentCard card={card} />;
    case "heading":
      return <HeadingCard card={card} />;
    case "map":
      return <MapCard card={card} />;
  }
}

const NO_CHIPS = new Set(["board", "column", "heading"]);
const RESIZE_BOTH = new Set(["sketch", "map"]);

export const CardView = memo(function CardView({ id, inColumn, inDrawer }: { id: string; inColumn?: boolean; inDrawer?: boolean }) {
  const card = useStore((s) => s.ws.cards[id]);
  const selected = useStore((s) => s.selection.includes(id));
  const single = useStore((s) => s.selection.length === 1 && s.selection[0] === id && !s.dragging);
  const dragging = useStore((s) => s.dragging && s.selection.includes(id));
  const flash = useStore((s) => s.flashId === id);
  if (!card || card.deleted) return null;
  if (card.unsorted && !inDrawer) return null;

  const flow = inColumn || inDrawer;
  const style: React.CSSProperties & Record<string, string | number> = flow
    ? {}
    : { left: card.x, top: card.y, width: card.w, zIndex: dragging ? 900000 + card.z : card.z };

  const hex = isHex(card.color);
  if (hex && card.type !== "board") {
    if (card.type === "column" && card.colorMode === "strip") style["--strip"] = card.color;
    else {
      style["--card-bg"] = card.color;
      style["--text"] = readableOn(card.color);
      style["--muted"] = readableOn(card.color) === "#ffffff" ? "rgba(255,255,255,.7)" : "rgba(31,35,40,.6)";
      style.color = readableOn(card.color);
    }
  }

  const cls = [
    "card",
    `card-${card.type}`,
    hex ? "c-hex" : `c-${card.color || "default"}`,
    card.type === "column" && card.colorMode === "strip" && "strip",
    selected && "selected",
    dragging && "dragging",
    flash && "flash",
    inColumn && "in-column",
    inDrawer && "in-drawer",
    card.locked && "locked",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      data-card-id={id}
      data-card-type={card.type}
      className={cls}
      style={style}
      onPointerDown={(e) => !inDrawer && onCardPointerDown(e, id)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const s = S();
        if (!s.selection.includes(id)) s.set({ selection: [id], selectedLines: [] });
        s.set({ contextMenu: { x: e.clientX, y: e.clientY, kind: "card" } });
      }}
    >
      <Content card={card} />
      {!NO_CHIPS.has(card.type) && <MetaChips target={{ cardId: id }} labels={card.labels} reactions={card.reactions} />}
      {!inDrawer && <CommentPin card={card} />}
      {card.locked && (
        <span className="lock-badge no-export" title="Position locked">
          <Lock size={11} />
        </span>
      )}
      {single && !flow && !card.locked && (
        <div
          className={"resize-handle no-export" + (RESIZE_BOTH.has(card.type) ? " both" : "")}
          data-nodrag
          onPointerDown={(e) => startResize(e, id, RESIZE_BOTH.has(card.type))}
          title="Resize"
        />
      )}
      {single && !inDrawer && card.type !== "column" && (
        <div className="connector no-export" data-nodrag onPointerDown={(e) => startConnector(e, id)} title="Drag to connect with a line" />
      )}
    </div>
  );
});
