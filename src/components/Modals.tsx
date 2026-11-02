"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Search, Trash, X } from "lucide-react";
import { useStore, S } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { boardPath, createCard, emptyTrash, focusCard, navigate, purgeCard, restoreCard, trashedCards, updateCard } from "@/lib/actions";
import { STATIC, cardText, htmlToText, timeAgo } from "@/lib/utils";
import { useFileUrl } from "@/lib/storage";
import { TextTools } from "./LeftToolbar";
import { Builder, TEMPLATES, type Template } from "@/lib/templates";
import { RichText } from "./RichText";

function Modal({ children, wide, className }: { children: React.ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && S().set({ modal: null })}>
      <div className={"modal" + (wide ? " wide" : "") + (className ? " " + className : "")} role="dialog">
        <button className="modal-close" onClick={() => S().set({ modal: null })} aria-label="Close">
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  note: "Note", todo: "To-do", link: "Link", image: "Image", file: "File", board: "Board", column: "Column",
  comment: "Comment", sketch: "Sketch", swatch: "Colour", table: "Table", document: "Document",
};

/* ---------------- search ---------------- */

function SearchModal() {
  const ws = useStore((s) => s.ws);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    const out: { id: string; kind: "card" | "board"; title: string; snippet: string; where: string; type: string }[] = [];
    for (const b of Object.values(ws.boards)) {
      if (b.title.toLowerCase().includes(query)) out.push({ id: b.id, kind: "board", title: b.title, snippet: "Board", where: boardPath(ws, b.id).slice(0, -1).map((x) => x.title).join(" / ") || "—", type: "board" });
    }
    for (const c of Object.values(ws.cards)) {
      if (c.deleted || c.type === "board") continue;
      const t = cardText(c, "");
      const i = t.toLowerCase().indexOf(query);
      if (i < 0) continue;
      const start = Math.max(0, i - 40);
      out.push({
        id: c.id,
        kind: "card",
        title: TYPE_LABEL[c.type],
        snippet: (start ? "…" : "") + t.slice(start, i + query.length + 80).replace(/\n+/g, " · "),
        where: boardPath(ws, c.boardId).map((x) => x.title).join(" / "),
        type: c.type,
      });
      if (out.length > 60) break;
    }
    return out;
  }, [q, ws]);
  const open = (r: (typeof results)[number]) => {
    S().set({ modal: null });
    if (r.kind === "board") navigate(r.id);
    else focusCard(r.id);
  };
  const hl = (text: string) => {
    const query = q.trim();
    if (!query) return text;
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + query.length)}</mark>
        {text.slice(i + query.length)}
      </>
    );
  };
  return (
    <Modal className="search-modal">
      <div className="search-input">
        <Search size={18} />
        <input
          ref={input}
          placeholder="Search all boards, notes, links, tasks…"
          value={q}
          onChange={(e) => (setQ(e.target.value), setActive(0))}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
            if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            if (e.key === "Enter" && results[active]) open(results[active]);
            if (e.key === "Escape") S().set({ modal: null });
          }}
        />
      </div>
      <div className="search-results" data-scroll>
        {q && !results.length && <div className="muted pad">No results for “{q}”.</div>}
        {!q && <div className="muted pad">Type to search everything in your workspace.</div>}
        {results.map((r, i) => (
          <button key={r.kind + r.id} className={"result" + (i === active ? " on" : "")} onMouseEnter={() => setActive(i)} onClick={() => open(r)}>
            <span className={"rtype t-" + r.type}>{r.kind === "board" ? "Board" : r.title}</span>
            <span className="rmain">
              <span className="rsnip">{hl(r.kind === "board" ? r.title : r.snippet)}</span>
              <span className="rwhere">{r.where}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- templates ---------------- */

export function applyTemplate(t: Template) {
  const id = createCard("board", undefined, { boardTitle: t.id === "blank" ? "New board" : t.name });
  const s = S();
  const bid = s.ws.cards[id].data.boardId!;
  s.mutate((d) => {
    d.boards[bid].icon = t.icon;
    const b = new Builder(bid);
    t.build(b);
    b.commit(d as Workspace);
  });
  s.set({ modal: null });
  navigate(bid);
}

function TemplatesModal() {
  return (
    <Modal wide>
      <h2>Start from a template</h2>
      <p className="muted">A new board is added to the current board and opened.</p>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <button key={t.id} className="template" onClick={() => applyTemplate(t)}>
            <span className="t-icon">{t.icon}</span>
            <span className="t-name">{t.name}</span>
            <span className="t-desc">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- trash ---------------- */

function TrashModal() {
  const ws = useStore((s) => s.ws);
  const items = trashedCards(ws);
  return (
    <Modal wide>
      <div className="modal-head">
        <h2>Trash</h2>
        {items.length > 0 && (
          <button className="btn danger" onClick={() => confirm("Permanently delete everything in the trash?") && emptyTrash()}>
            Empty trash
          </button>
        )}
      </div>
      {!items.length && <p className="muted">Trash is empty. Deleted cards show up here so you can restore them.</p>}
      <div className="trash-list" data-scroll>
        {items.map((c) => (
          <div key={c.id} className="trash-item">
            <span className={"rtype t-" + c.type}>{TYPE_LABEL[c.type]}</span>
            <div className="rmain">
              <span className="rsnip">{(c.type === "board" ? ws.boards[c.data.boardId!]?.title : cardText(c, "").slice(0, 120)) || <i>Empty</i>}</span>
              <span className="rwhere">
                from {ws.boards[c.boardId]?.title || "deleted board"} · {c.deletedAt ? timeAgo(c.deletedAt) : ""}
              </span>
            </div>
            <button className="btn" onClick={() => restoreCard(c.id)}>
              <RotateCcw size={14} /> Restore
            </button>
            <button className="icon-btn danger" title="Delete forever" onClick={() => purgeCard(c.id)}>
              <Trash size={15} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- settings ---------------- */

function SettingsModal() {
  const st = useStore((s) => s.ws.settings);
  const set = (p: Partial<typeof st>) => S().mutate((d) => void Object.assign(d.settings, p));
  return (
    <Modal>
      <h2>Settings</h2>
      <label className="field">
        <span>Your name (shown on comments)</span>
        <input value={st.userName} onChange={(e) => set({ userName: e.target.value })} />
      </label>
      <label className="check-field">
        <input type="checkbox" checked={st.theme === "dark"} onChange={(e) => set({ theme: e.target.checked ? "dark" : "light" })} /> Dark mode
      </label>
      <label className="check-field">
        <input type="checkbox" checked={st.showGrid} onChange={(e) => set({ showGrid: e.target.checked })} /> Show dot grid
      </label>
      <label className="check-field">
        <input type="checkbox" checked={st.snap} onChange={(e) => set({ snap: e.target.checked })} /> Snap cards to grid while moving
      </label>
      <p className="muted small">
        {STATIC
          ? "Everything is saved in this browser (IndexedDB). Clearing browser data deletes your boards — use Export → Backup everything regularly."
          : <>Everything is saved to <code>data/workspace.json</code> inside the project folder, and uploads go to <code>data/uploads/</code>. Back up that folder to keep your boards safe.</>}
      </p>
    </Modal>
  );
}

/* ---------------- shortcuts ---------------- */

const SHORTCUTS: [string, string][] = [
  ["N / T / L / B / C / M / D", "New note / to-do / link / board / column / comment / drawing"],
  ["I / U", "Upload image / file"],
  ["Double-click canvas", "New note"],
  ["Drag empty canvas", "Select multiple"],
  ["Space + drag, middle mouse, H", "Pan the board"],
  ["Scroll / Shift + scroll", "Pan vertically / horizontally"],
  ["Ctrl + scroll, pinch", "Zoom"],
  ["Ctrl + / Ctrl − / Ctrl 0", "Zoom in / out / reset"],
  ["Shift 1", "Zoom to fit"],
  ["Ctrl Z / Ctrl Shift Z", "Undo / redo"],
  ["Ctrl C / X / V", "Copy / cut / paste cards (works across boards)"],
  ["Ctrl D", "Duplicate"],
  ["Ctrl A", "Select all"],
  ["Delete / Backspace", "Move to trash"],
  ["Arrow keys (+Shift)", "Nudge selection"],
  ["Ctrl K or /", "Search"],
  ["Esc", "Deselect / stop editing / go up a board (Backspace on empty)"],
  ["Ctrl B / I / U", "Bold / italic / underline in notes"],
  ["Ctrl Alt 1 / 2 / 3 / 0", "Large heading / heading / small / normal text"],
  ["Alt + drag", "Drag out a copy of a card"],
  ["Drag onto “Unsorted”", "Park cards in the Unsorted drawer"],
  ["Click a task, then Due date / Assign", "Set due date or assignee on a to-do item"],
  ["Table: type, Tab, Enter, =SUM(A1:A3)", "Spreadsheet editing & formulas"],
];

function ShortcutsModal() {
  return (
    <Modal wide>
      <h2>Keyboard shortcuts</h2>
      <div className="shortcuts">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="sc-row">
            <kbd>{k}</kbd>
            <span>{v}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- document editor ---------------- */

function DocumentModal({ id }: { id: string }) {
  const card = useStore((s) => s.ws.cards[id]);
  const title = useRef<HTMLInputElement>(null);
  const [exp, setExp] = useState(false);
  useEffect(() => {
    if (!card?.data.title) title.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!card) return null;
  const words = htmlToText(card.data.html).split(/\s+/).filter(Boolean).length;
  const dl = (kind: "md" | "txt" | "doc") => {
    const t = card.data.title || "document";
    const text = htmlToText(card.data.html);
    const blob =
      kind === "doc"
        ? new Blob(["\ufeff<html><head><meta charset='utf-8'></head><body><h1>" + t + "</h1>" + (card.data.html || "") + "</body></html>"], { type: "application/msword" })
        : new Blob([(kind === "md" ? "# " : "") + t + "\n\n" + text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = t.replace(/[^\w\- ]+/g, "") + "." + kind;
    a.click();
    setExp(false);
  };
  return (
    <Modal className="doc-modal">
      <div className="doc-head">
        <span className="doc-head-title">{card.data.title || "New document"}</span>
        <span className="muted xsmall">{words} words</span>
        <div className="menu-wrap">
          <button className="hbtn" onClick={() => setExp(!exp)}>
            Export ▾
          </button>
          {exp && (
            <div className="dropdown">
              <button onClick={() => dl("doc")}>Word document</button>
              <button onClick={() => dl("md")}>Markdown</button>
              <button onClick={() => dl("txt")}>Plain text</button>
            </div>
          )}
        </div>
      </div>
      <div className="doc-layout">
        <div className="doc-tools">
          <TextTools vertical={false} />
        </div>
      <div className="doc-editor" data-scroll>
        <input
          ref={title}
          className="doc-title-input"
          placeholder="Untitled document"
          value={card.data.title || ""}
          onChange={(e) => updateCard(id, { title: e.target.value }, "doctitle-" + id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              document.querySelector<HTMLElement>(".doc-editor .rt")?.focus();
            }
          }}
        />
        <RichText className="doc-rt" html={card.data.html || ""} placeholder="Start typing…" onChange={(html) => updateCard(id, { html }, "doc-" + id)} />
      </div>
      </div>
    </Modal>
  );
}

function ShareModal() {
  const current = useStore((s) => s.currentBoardId);
  const url = typeof window !== "undefined" ? `${location.origin}${location.pathname}${current === "home" ? "" : "#/b/" + current}` : "";
  const [copied, setCopied] = useState(false);
  return (
    <Modal>
      <h2>Share this board</h2>
      {STATIC ? (
        <p className="muted small">Your boards are saved privately in this browser. The link opens the app, but other people (and your other devices) will see their own empty workspace — to move boards, use Export → Backup everything, then Restore from backup on the other device.</p>
      ) : (
        <p className="muted small">This app runs on your own computer. Anyone on the same Wi-Fi can open the board while the app is running — replace <code>localhost</code> with your computer&apos;s IP address (run <code>ipconfig</code> on Windows to find it).</p>
      )}
      <div className="share-row">
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
        <button
          className="btn primary"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <p className="muted small">To send the board to someone else, use Export → PDF, PNG or Word.</p>
    </Modal>
  );
}

function ImageModal({ id }: { id: string }) {
  const card = useStore((s) => s.ws.cards[id]);
  const src = useFileUrl(card?.data.url);
  if (!card) return null;
  return (
    <div className="lightbox" onClick={() => S().set({ modal: null })}>
      <img src={src} alt={card.data.caption || ""} />
      {card.data.caption && <div className="lightbox-cap">{card.data.caption}</div>}
    </div>
  );
}

export function Modals() {
  const modal = useStore((s) => s.modal);
  if (!modal) return null;
  switch (modal.type) {
    case "search":
      return <SearchModal />;
    case "templates":
      return <TemplatesModal />;
    case "trash":
      return <TrashModal />;
    case "settings":
      return <SettingsModal />;
    case "shortcuts":
      return <ShortcutsModal />;
    case "document":
      return <DocumentModal id={modal.id} />;
    case "image":
      return <ImageModal id={modal.id} />;
    case "share":
      return <ShareModal />;
  }
}
