"use client";
import {
  Columns3,
  FileText,
  Hand,
  ImagePlus,
  Link2,
  ListTodo,
  MessageSquare,
  MousePointer2,
  Palette,
  PenLine,
  Spline,
  SquareKanban,
  StickyNote,
  Table,
  Trash,
  Upload,
  Maximize,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { startToolDrag, type ToolKind } from "@/lib/interactions";
import { useStore, vpOf, S } from "@/lib/store";
import { trashedCards, zoomBy, zoomTo, zoomToFit } from "@/lib/actions";

const TOOLS: { kind: ToolKind; label: string; icon: React.ComponentType<{ size?: number }>; key?: string }[] = [
  { kind: "note", label: "Note", icon: StickyNote, key: "N" },
  { kind: "link", label: "Link", icon: Link2, key: "L" },
  { kind: "todo", label: "To-do", icon: ListTodo, key: "T" },
  { kind: "line", label: "Line", icon: Spline },
  { kind: "board", label: "Board", icon: SquareKanban, key: "B" },
  { kind: "column", label: "Column", icon: Columns3, key: "C" },
  { kind: "comment", label: "Comment", icon: MessageSquare, key: "M" },
  { kind: "table", label: "Table", icon: Table },
  { kind: "document", label: "Document", icon: FileText },
  { kind: "swatch", label: "Color", icon: Palette },
  { kind: "sketch", label: "Draw", icon: PenLine, key: "D" },
  { kind: "upload-image", label: "Image", icon: ImagePlus, key: "I" },
  { kind: "upload-file", label: "Upload", icon: Upload, key: "U" },
];

export function Toolbar() {
  const dropTrash = useStore((s) => s.dropTarget?.kind === "trash");
  const dragging = useStore((s) => s.dragging);
  const trashCount = useStore((s) => trashedCards(s.ws).length);
  return (
    <nav className="toolbar">
      <div className="tools">
        {TOOLS.map((t) => (
          <button
            key={t.kind}
            className="tool-btn"
            onPointerDown={(e) => startToolDrag(e, t.kind, t.label)}
            title={`${t.label}${t.key ? ` (${t.key})` : ""} — click or drag onto the board`}
          >
            <t.icon size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <button
        data-trash-drop
        className={"tool-btn trash" + (dropTrash ? " drop" : "") + (dragging ? " armed" : "")}
        onClick={() => S().set({ modal: { type: "trash" } })}
        title="Trash — drag cards here to delete"
      >
        <Trash size={20} />
        <span>Trash{trashCount ? ` (${trashCount})` : ""}</span>
      </button>
    </nav>
  );
}

export function ZoomControls() {
  const zoom = useStore((s) => vpOf(s).zoom);
  const tool = useStore((s) => s.tool);
  return (
    <div className="zoom-controls">
      <button className={"zc" + (tool === "select" ? " on" : "")} onClick={() => S().set({ tool: "select" })} title="Select (V)">
        <MousePointer2 size={16} />
      </button>
      <button className={"zc" + (tool === "hand" ? " on" : "")} onClick={() => S().set({ tool: "hand" })} title="Hand / pan (H, or hold Space)">
        <Hand size={16} />
      </button>
      <span className="zsep" />
      <button className="zc" onClick={() => zoomBy(1 / 1.2)} title="Zoom out (Ctrl -)">
        <ZoomOut size={16} />
      </button>
      <button className="zc pct" onClick={() => zoomTo(1, undefined, true)} title="Reset to 100% (Ctrl 0)">
        {Math.round(zoom * 100)}%
      </button>
      <button className="zc" onClick={() => zoomBy(1.2)} title="Zoom in (Ctrl +)">
        <ZoomIn size={16} />
      </button>
      <button className="zc" onClick={() => zoomToFit()} title="Fit to screen (Shift 1)">
        <Maximize size={16} />
      </button>
    </div>
  );
}
