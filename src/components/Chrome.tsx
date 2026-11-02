"use client";
import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  House,
  Keyboard,
  LayoutTemplate,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  Presentation,
  Redo2,
  Search,
  Settings,
  Share2,
  Sun,
  Trash,
  Undo2,
} from "lucide-react";
import { useStore, S, vpOf } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { boardPath, createCard, exportJSON, importJSON, navigate, renameBoard, zoomBy, zoomTo, zoomToFit } from "@/lib/actions";
import { exportLinear, exportPDF, exportPNGImage, exportZip } from "@/lib/exporters";

/* ---------------- sidebar ---------------- */

function childBoards(ws: Workspace, boardId: string) {
  return Object.values(ws.cards)
    .filter((c) => c.type === "board" && c.boardId === boardId && !c.deleted && c.data.boardId && ws.boards[c.data.boardId])
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((c) => ws.boards[c.data.boardId!]);
}

function TreeNode({ id, depth, ws, current, open, toggle }: { id: string; depth: number; ws: Workspace; current: string; open: Set<string>; toggle: (id: string) => void }) {
  const b = ws.boards[id];
  const kids = childBoards(ws, id);
  const isOpen = open.has(id);
  if (!b) return null;
  return (
    <>
      <div className={"tree-row" + (current === id ? " on" : "")} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => navigate(id)}>
        <button
          className="tree-toggle"
          onClick={(e) => {
            e.stopPropagation();
            toggle(id);
          }}
          style={{ visibility: kids.length ? "visible" : "hidden" }}
        >
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <span className="tree-icon">{id === "home" ? "🏠" : b.icon}</span>
        <span className="tree-title">{b.title || "Untitled"}</span>
      </div>
      {isOpen && kids.map((k) => <TreeNode key={k.id} id={k.id} depth={depth + 1} ws={ws} current={current} open={open} toggle={toggle} />)}
    </>
  );
}

const treeSig = (ws: Workspace) =>
  Object.values(ws.cards)
    .filter((c) => c.type === "board" && !c.deleted)
    .map((c) => `${c.id}:${c.boardId}:${c.data.boardId}:${Math.round(c.y / 20)}:${Math.round(c.x / 20)}`)
    .join("|");

export function Sidebar() {
  useStore((s) => treeSig(s.ws));
  useStore((s) => s.ws.boards);
  const ws = S().ws;
  const current = useStore((s) => s.currentBoardId);
  const open = useStore((s) => s.sidebarOpen);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["home"]));
  // keep the path to the current board expanded
  const path = boardPath(ws, current).map((b) => b.id);
  const merged = useMemo(() => new Set([...expanded, ...path.slice(0, -1)]), [expanded, path]);
  if (!open) return null;
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">M</div>
        <div>
          <div className="brand-name">Milanote Clone</div>
          <div className="brand-sub">Local workspace</div>
        </div>
      </div>
      <button className="side-btn" onClick={() => S().set({ modal: { type: "search" } })}>
        <Search size={15} /> Search <kbd>Ctrl K</kbd>
      </button>
      <button className="side-btn" onClick={() => S().set({ modal: { type: "templates" } })}>
        <LayoutTemplate size={15} /> Templates
      </button>
      <button className="side-btn" onClick={() => createCard("board", undefined, { focus: true })}>
        <Plus size={15} /> New board here
      </button>
      <div className="side-label">Boards</div>
      <div className="tree" data-scroll>
        <TreeNode
          id="home"
          depth={0}
          ws={ws}
          current={current}
          open={merged}
          toggle={(id) =>
            setExpanded((s) => {
              const n = new Set(s);
              if (n.has(id)) n.delete(id);
              else n.add(id);
              return n;
            })
          }
        />
      </div>
      <div className="side-foot">
        <button className="side-btn" onClick={() => S().set({ modal: { type: "trash" } })}>
          <Trash size={15} /> Trash
        </button>
        <button className="side-btn" onClick={() => S().set({ modal: { type: "settings" } })}>
          <Settings size={15} /> Settings
        </button>
      </div>
    </aside>
  );
}

/* ---------------- top bar (Milanote-style: nav row + board header) ---------------- */

function ExportMenu({ close }: { close: () => void }) {
  const [sub, setSub] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const run = (f: () => void) => () => {
    close();
    f();
  };
  return (
    <div className="dropdown export-menu">
      <div className="dd-title">Export the current board layout</div>
      <button onClick={run(() => exportPDF(false))}>📄 PDF standard <span className="muted xsmall">(small file size)</span></button>
      <button onClick={run(() => exportPDF(true))}>📄 PDF high quality <span className="muted xsmall">(large file size)</span></button>
      <button onClick={run(exportPNGImage)}>🖼️ PNG image</button>
      <div className="dd-sep" />
      <div className="dd-title">Convert to a linear document</div>
      <label className="dd-toggle">
        <input type="checkbox" checked={sub} onChange={(e) => setSub(e.target.checked)} /> Include sub-boards
      </label>
      <button onClick={run(() => exportLinear("word", sub))}>📝 Word document</button>
      <button onClick={run(() => exportLinear("markdown", sub))}>Ⓜ️ Markdown</button>
      <button onClick={run(() => exportLinear("text", sub))}>🗒️ Plain text</button>
      <div className="dd-sep" />
      <div className="dd-title">Download all images and files</div>
      <button onClick={run(() => exportZip(sub))}>🗜️ Generate ZIP file</button>
      <div className="dd-sep" />
      <div className="dd-title">Backup</div>
      <button onClick={run(exportJSON)}>💾 Backup everything (JSON)</button>
      <button onClick={() => importRef.current?.click()}>♻️ Restore from backup…</button>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && confirm("Replace your whole workspace with this backup? (You can undo this.)")) importJSON(f);
          e.target.value = "";
          close();
        }}
      />
    </div>
  );
}

function ViewMenu({ close }: { close: () => void }) {
  const zoom = useStore((s) => vpOf(s).zoom);
  const st = useStore((s) => s.ws.settings);
  const set = (p: Partial<typeof st>) => S().mutate((d) => void Object.assign(d.settings, p));
  return (
    <div className="dropdown view-menu">
      <div className="dd-title">Zoom</div>
      <div className="muted xsmall pad-x">Tip: hold Ctrl and use the mouse wheel to zoom</div>
      <div className="zoom-row">
        <button className="icon-btn" onClick={() => zoomBy(1 / 1.2)}>
          <Minus size={15} />
        </button>
        <input type="range" min={10} max={400} value={Math.round(zoom * 100)} onChange={(e) => zoomTo(Number(e.target.value) / 100)} />
        <button className="icon-btn" onClick={() => zoomBy(1.2)}>
          <Plus size={15} />
        </button>
        <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
      </div>
      <button className="btn wide" onClick={() => zoomToFit()}>
        Scale to fit
      </button>
      <div className="dd-sep" />
      <label className="dd-toggle">
        <input type="checkbox" checked={st.showGrid} onChange={(e) => set({ showGrid: e.target.checked })} /> Dot grid
      </label>
      <label className="dd-toggle">
        <input type="checkbox" checked={st.snap} onChange={(e) => set({ snap: e.target.checked })} /> Snap to grid
      </label>
      <label className="dd-toggle">
        <input type="checkbox" checked={st.theme === "dark"} onChange={(e) => set({ theme: e.target.checked ? "dark" : "light" })} /> Dark mode
      </label>
      <div className="dd-sep" />
      <div className="dd-title">Presentation mode</div>
      <div className="muted xsmall pad-x">Go full-screen & hide toolbar, dot grid etc.</div>
      <button
        className="btn primary wide"
        onClick={() => {
          close();
          startPresenting();
        }}
      >
        <Presentation size={15} /> Present
      </button>
    </div>
  );
}

export function startPresenting() {
  S().set({ presenting: true, selection: [], selectedLines: [] });
  document.documentElement.requestFullscreen?.().catch(() => {});
  setTimeout(() => zoomToFit(), 120);
}

export function TopBar() {
  useStore((s) => treeSig(s.ws));
  useStore((s) => s.ws.boards);
  const ws = S().ws;
  const current = useStore((s) => s.currentBoardId);
  const saveState = useStore((s) => s.saveState);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const theme = useStore((s) => s.ws.settings.theme);
  const path = boardPath(ws, current);
  const [menu, setMenu] = useState<null | "export" | "view">(null);
  const board = ws.boards[current];

  return (
    <header className="topbar-wrap">
      <div className="topbar">
        <button className="icon-btn" onClick={() => S().set({ sidebarOpen: !S().sidebarOpen })} title="Toggle sidebar">
          <PanelLeft size={17} />
        </button>
        <nav className="crumbs">
          {path.map((b, i) => (
            <span key={b.id} className="crumb-wrap">
              <button className={"crumb" + (i === path.length - 1 ? " last" : "")} onClick={() => navigate(b.id)}>
                {b.id === "home" ? <House size={14} /> : <span className="crumb-icon">{b.icon}</span>}
                {b.id === "home" ? "Home" : b.title || "Untitled"}
              </button>
              {i < path.length - 1 && <ChevronRight size={14} className="crumb-sep" />}
            </span>
          ))}
        </nav>
        <div className="topbar-right">
          <button className="icon-btn" disabled={!canUndo} onClick={() => S().undo()} title="Undo (Ctrl Z)">
            <Undo2 size={17} />
          </button>
          <button className="icon-btn" disabled={!canRedo} onClick={() => S().redo()} title="Redo (Ctrl Shift Z)">
            <Redo2 size={17} />
          </button>
          <button className="icon-btn" onClick={() => S().set({ modal: { type: "search" } })} title="Search (Ctrl K)">
            <Search size={17} />
          </button>
          <button className="icon-btn" onClick={() => S().mutate((d) => void (d.settings.theme = theme === "dark" ? "light" : "dark"))} title="Toggle dark mode">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="icon-btn" onClick={() => S().set({ modal: { type: "shortcuts" } })} title="Keyboard shortcuts (?)">
            <Keyboard size={17} />
          </button>
          <button className="icon-btn" onClick={() => S().set({ modal: { type: "settings" } })} title="Settings">
            <Settings size={17} />
          </button>
        </div>
      </div>
      <div className="board-header">
        <span className={"save-state " + saveState}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved — is the server running?" : "Saved"}</span>
        {board && (
          <input
            className="board-title-input"
            value={board.title}
            size={Math.max(4, board.title.length + 1)}
            onChange={(e) => renameBoard(current, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
        )}
        <div className="header-actions">
          <button className="hbtn" onClick={() => S().set({ modal: { type: "share" } })}>
            <Share2 size={14} /> Share
          </button>
          <div className="menu-wrap">
            <button className={"hbtn" + (menu === "export" ? " on" : "")} onClick={() => setMenu(menu === "export" ? null : "export")}>
              <Download size={14} /> Export <ChevronDown size={13} />
            </button>
            {menu === "export" && (
              <>
                <div className="menu-backdrop" onClick={() => setMenu(null)} />
                <ExportMenu close={() => setMenu(null)} />
              </>
            )}
          </div>
          <div className="menu-wrap">
            <button className={"hbtn" + (menu === "view" ? " on" : "")} onClick={() => setMenu(menu === "view" ? null : "view")}>
              <Eye size={14} /> View <ChevronDown size={13} />
            </button>
            {menu === "view" && (
              <>
                <div className="menu-backdrop" onClick={() => setMenu(null)} />
                <ViewMenu close={() => setMenu(null)} />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
