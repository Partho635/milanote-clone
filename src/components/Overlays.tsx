"use client";
import { useEffect, useState } from "react";
import {
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  FolderInput,
  Heading1,
  Heading2,
  Highlighter,
  Link,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Trash,
} from "lucide-react";
import { useStore, S } from "@/lib/store";
import {
  alignSelection,
  bringToFront,
  copySelection,
  createCard,
  deleteSelection,
  duplicateSelection,
  moveCardsToBoard,
  sendToBack,
  setColor,
  tryPasteText,
  zoomToFit,
} from "@/lib/actions";
import { BOARD_ICONS, PALETTE } from "@/lib/utils";
import type { Workspace } from "@/lib/types";
import { createFromTool } from "@/lib/interactions";

/* ---------------- board picker (move to…) ---------------- */

function allBoards(ws: Workspace) {
  const out: { id: string; title: string; depth: number; icon: string }[] = [];
  const walk = (id: string, depth: number, seen: Set<string>) => {
    if (seen.has(id) || !ws.boards[id]) return;
    seen.add(id);
    out.push({ id, title: ws.boards[id].title || "Untitled", depth, icon: id === "home" ? "🏠" : ws.boards[id].icon });
    Object.values(ws.cards)
      .filter((c) => c.type === "board" && c.boardId === id && !c.deleted && c.data.boardId)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .forEach((c) => walk(c.data.boardId!, depth + 1, seen));
  };
  walk("home", 0, new Set());
  return out;
}

function BoardPicker({ onPick }: { onPick: (id: string) => void }) {
  const ws = useStore((s) => s.ws);
  const current = useStore((s) => s.currentBoardId);
  const sel = useStore((s) => s.selection);
  const selBoards = new Set(sel.map((id) => ws.cards[id]?.data.boardId).filter(Boolean));
  return (
    <div className="board-picker" data-scroll>
      {allBoards(ws).map((b) => (
        <button key={b.id} disabled={b.id === current || selBoards.has(b.id)} style={{ paddingLeft: 10 + b.depth * 14 }} onClick={() => onPick(b.id)}>
          <span>{b.icon}</span> {b.title}
        </button>
      ))}
    </div>
  );
}

/* ---------------- selection bar ---------------- */

export function SelectionBar() {
  const sel = useStore((s) => s.selection);
  const dragging = useStore((s) => s.dragging);
  const cards = useStore((s) => s.ws.cards);
  const [picker, setPicker] = useState(false);
  useEffect(() => setPicker(false), [sel]);
  if (!sel.length || dragging) return null;
  const first = cards[sel[0]];
  const isBoard = sel.length === 1 && first?.type === "board";
  const multi = sel.filter((id) => !cards[id]?.parentId).length > 1;
  return (
    <div className="selection-bar" onPointerDown={(e) => e.stopPropagation()}>
      <span className="sb-count">{sel.length} selected</span>
      <span className="sep" />
      {PALETTE.map((p) => (
        <button key={p.key} className={"dot" + (first?.color === p.key ? " on" : "")} style={{ background: p.swatch }} title={p.label} onClick={() => setColor(sel, p.key)} />
      ))}
      {isBoard && (
        <>
          <span className="sep" />
          <IconPicker boardId={first.data.boardId!} />
        </>
      )}
      <span className="sep" />
      {multi && (
        <>
          <button className="tb" onClick={() => alignSelection("left")} title="Align left">
            <AlignStartVertical size={15} />
          </button>
          <button className="tb" onClick={() => alignSelection("top")} title="Align top">
            <AlignStartHorizontal size={15} />
          </button>
          <button className="tb" onClick={() => alignSelection("distH")} title="Distribute horizontally">
            <AlignHorizontalSpaceAround size={15} />
          </button>
          <button className="tb" onClick={() => alignSelection("distV")} title="Distribute vertically">
            <AlignVerticalSpaceAround size={15} />
          </button>
          <span className="sep" />
        </>
      )}
      <button className="tb" onClick={() => bringToFront(sel)} title="Bring to front">
        <ArrowUpToLine size={15} />
      </button>
      <button className="tb" onClick={duplicateSelection} title="Duplicate (Ctrl D)">
        <Copy size={15} />
      </button>
      <div className="menu-wrap">
        <button className="tb" onClick={() => setPicker(!picker)} title="Move to board…">
          <FolderInput size={15} />
        </button>
        {picker && (
          <div className="dropdown up">
            <div className="dd-title">Move to…</div>
            <BoardPicker onPick={(id) => moveCardsToBoard(S().selection, id)} />
          </div>
        )}
      </div>
      <button className="tb danger" onClick={deleteSelection} title="Delete (Del)">
        <Trash size={15} />
      </button>
    </div>
  );
}

function IconPicker({ boardId }: { boardId: string }) {
  const [open, setOpen] = useState(false);
  const icon = useStore((s) => s.ws.boards[boardId]?.icon);
  return (
    <div className="menu-wrap">
      <button className="tb emoji" onClick={() => setOpen(!open)} title="Board icon">
        {icon}
      </button>
      {open && (
        <div className="dropdown icon-grid">
          {BOARD_ICONS.map((i) => (
            <button
              key={i}
              onClick={() => {
                S().mutate((d) => void (d.boards[boardId].icon = i), { history: true });
                setOpen(false);
              }}
            >
              {i}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- rich text format bar ---------------- */

const TEXT_COLORS = ["inherit", "#e25563", "#f5a623", "#2bb39a", "#4f7cff", "#8b5cf6", "#7c7f86"];

export function FormatBar() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [state, setState] = useState<Record<string, boolean>>({});
  const [colors, setColors] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !el.hasAttribute("data-rt")) {
          setPos(null);
          setColors(false);
          return;
        }
        const host = el.closest<HTMLElement>(".card, .doc-editor") || el;
        const r = host.getBoundingClientRect();
        const inModal = !!el.closest(".doc-editor");
        setPos({ x: Math.max(8, Math.min(window.innerWidth - 440, r.left)), y: inModal ? r.top - 48 : Math.max(60, r.top - 46) });
        const q = (c: string) => {
          try {
            return document.queryCommandState(c);
          } catch {
            return false;
          }
        };
        let block = "";
        try {
          block = String(document.queryCommandValue("formatBlock")).toLowerCase();
        } catch {}
        setState({
          bold: q("bold"),
          italic: q("italic"),
          underline: q("underline"),
          strike: q("strikeThrough"),
          ul: q("insertUnorderedList"),
          ol: q("insertOrderedList"),
          h1: block === "h1",
          h2: block === "h2",
          quote: block === "blockquote",
        });
      });
    };
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    document.addEventListener("selectionchange", update);
    document.addEventListener("input", update);
    const unsub = useStore.subscribe((s, p) => s.viewports !== p.viewports && update());
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("input", update);
      unsub();
    };
  }, []);
  if (!pos) return null;
  const cmd = (c: string, v?: string) => document.execCommand(c, false, v);
  const block = (tag: string, active: boolean) => cmd("formatBlock", active ? "div" : tag);
  const B = ({ on, title, children, onClick }: { on?: boolean; title: string; children: React.ReactNode; onClick: () => void }) => (
    <button className={"fb" + (on ? " on" : "")} title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </button>
  );
  return (
    <div className="format-bar" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.preventDefault()}>
      <B on={state.bold} title="Bold (Ctrl B)" onClick={() => cmd("bold")}>
        <b>B</b>
      </B>
      <B on={state.italic} title="Italic (Ctrl I)" onClick={() => cmd("italic")}>
        <i style={{ fontFamily: "Georgia, serif" }}>I</i>
      </B>
      <B on={state.underline} title="Underline (Ctrl U)" onClick={() => cmd("underline")}>
        <u>U</u>
      </B>
      <B on={state.strike} title="Strikethrough" onClick={() => cmd("strikeThrough")}>
        <s>S</s>
      </B>
      <span className="sep" />
      <B on={state.h1} title="Heading" onClick={() => block("h1", !!state.h1)}>
        <Heading1 size={16} />
      </B>
      <B on={state.h2} title="Subheading" onClick={() => block("h2", !!state.h2)}>
        <Heading2 size={16} />
      </B>
      <B on={state.quote} title="Quote" onClick={() => block("blockquote", !!state.quote)}>
        <Quote size={15} />
      </B>
      <B on={state.ul} title="Bullet list" onClick={() => cmd("insertUnorderedList")}>
        <List size={16} />
      </B>
      <B on={state.ol} title="Numbered list" onClick={() => cmd("insertOrderedList")}>
        <ListOrdered size={16} />
      </B>
      <span className="sep" />
      <B
        title="Link"
        onClick={() => {
          const url = prompt("Link URL", "https://");
          if (url) cmd("createLink", url);
        }}
      >
        <Link size={15} />
      </B>
      <div className="menu-wrap">
        <B title="Text colour" onClick={() => setColors(!colors)}>
          <span className="color-a">A</span>
        </B>
        {colors && (
          <div className="dropdown colors" onMouseDown={(e) => e.preventDefault()}>
            {TEXT_COLORS.map((c) => (
              <button key={c} style={{ color: c === "inherit" ? "var(--text)" : c }} onClick={() => (cmd("foreColor", c === "inherit" ? getComputedStyle(document.body).color : c), setColors(false))}>
                A
              </button>
            ))}
          </div>
        )}
      </div>
      <B title="Highlight" onClick={() => cmd("hiliteColor", "#fff1a8")}>
        <Highlighter size={15} />
      </B>
      <B title="Clear formatting" onClick={() => (cmd("removeFormat"), cmd("formatBlock", "div"))}>
        <RemoveFormatting size={15} />
      </B>
    </div>
  );
}

/* ---------------- context menu ---------------- */

export function ContextMenu() {
  const cm = useStore((s) => s.contextMenu);
  const sel = useStore((s) => s.selection);
  const [sub, setSub] = useState<null | "move">(null);
  useEffect(() => setSub(null), [cm]);
  if (!cm) return null;
  const close = () => S().set({ contextMenu: null });
  const run = (f: () => void) => () => {
    close();
    f();
  };
  const x = Math.min(cm.x, window.innerWidth - 230);
  const y = Math.min(cm.y, window.innerHeight - 340);
  return (
    <>
      <div className="menu-backdrop" onPointerDown={close} onContextMenu={(e) => (e.preventDefault(), close())} />
      <div className="context-menu" style={{ left: x, top: y }}>
        {cm.kind === "card" ? (
          sub === "move" ? (
            <>
              <div className="dd-title">Move {sel.length} item(s) to…</div>
              <BoardPicker onPick={(id) => (close(), moveCardsToBoard(S().selection, id))} />
            </>
          ) : (
            <>
              <div className="cm-colors">
                {PALETTE.map((p) => (
                  <button key={p.key} className="dot" style={{ background: p.swatch }} title={p.label} onClick={run(() => setColor(sel, p.key))} />
                ))}
              </div>
              <button onClick={run(duplicateSelection)}>
                Duplicate <kbd>Ctrl D</kbd>
              </button>
              <button onClick={run(() => copySelection())}>
                Copy <kbd>Ctrl C</kbd>
              </button>
              <button onClick={run(() => copySelection(true))}>
                Cut <kbd>Ctrl X</kbd>
              </button>
              <button onClick={run(() => bringToFront(sel))}>
                <ArrowUpToLine size={14} /> Bring to front
              </button>
              <button onClick={run(() => sendToBack(sel))}>
                <ArrowDownToLine size={14} /> Send to back
              </button>
              <button onClick={() => setSub("move")}>
                <FolderInput size={14} /> Move to board…
              </button>
              <div className="dd-sep" />
              <button className="danger" onClick={run(deleteSelection)}>
                <Trash size={14} /> Delete <kbd>Del</kbd>
              </button>
            </>
          )
        ) : (
          <>
            <button onClick={run(() => createCard("note", cm.world, { focus: true }))}>Add note here</button>
            <button onClick={run(() => createFromTool("todo", cm.world))}>Add to-do list</button>
            <button onClick={run(() => createFromTool("column", cm.world))}>Add column</button>
            <button onClick={run(() => createFromTool("board", cm.world))}>Add board</button>
            <button onClick={run(() => createFromTool("upload-image", cm.world))}>Add image…</button>
            <div className="dd-sep" />
            <button
              onClick={run(async () => {
                let t = "";
                try {
                  t = await navigator.clipboard.readText();
                } catch {}
                if (!tryPasteText(t)) S().toast("Use Ctrl V to paste from your clipboard");
              })}
            >
              Paste <kbd>Ctrl V</kbd>
            </button>
            <button
              onClick={run(() => {
                const s = S();
                s.set({ selection: Object.values(s.ws.cards).filter((c) => c.boardId === s.currentBoardId && !c.deleted && !c.parentId).map((c) => c.id) });
              })}
            >
              Select all <kbd>Ctrl A</kbd>
            </button>
            <button onClick={run(() => zoomToFit())}>
              Zoom to fit <kbd>Shift 1</kbd>
            </button>
          </>
        )}
      </div>
    </>
  );
}

/* ---------------- toasts ---------------- */

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}
