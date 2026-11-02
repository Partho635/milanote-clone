"use client";
import { useEffect, useRef, useState } from "react";
import {
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpToLine,
  AudioLines,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Brush,
  CalendarDays,
  Captions,
  Code,
  Columns3,
  Copy,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FaceSlightlySmilingPlus,
  FileText,
  FolderInput,
  Highlighter,
  ImagePlus,
  Inbox,
  Link,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Lock,
  LockOpen,
  MapPin,
  MessageCircle,
  MessageSquare,
  Minus,
  PaintBucket,
  Palette,
  PanelTop,
  PenLine,
  Pencil,
  RefreshCw,
  Search,
  Spline,
  SquareKanban,
  SquarePlay,
  StickyNote,
  Table,
  Tag,
  TextAlignCenter,
  TextAlignStart,
  Trash,
  Type,
  Upload,
  UserPlus,
} from "lucide-react";
import { useStore, S } from "@/lib/store";
import type { Card, Cell, Line } from "@/lib/types";
import {
  alignSelection,
  bringToFront,
  convertColumnToBoard,
  copySelection,
  deleteSelection,
  duplicateSelection,
  moveCardsToBoard,
  navigate,
  patchLine,
  sendToBack,
  sendToUnsorted,
  toggleLock,
  trashedCards,
  updateCard,
  uploadFiles,
  createImageCardFromUrl,
} from "@/lib/actions";
import { createFromTool, startToolDrag, type ToolKind } from "@/lib/interactions";
import { EMOJI_CATEGORIES, EMOJI_NAMES, PICKER_COLORS, isHex } from "@/lib/data";
import { BOARD_ICONS, PALETTE, proxied, timeAgo } from "@/lib/utils";
import { importImage, resolveUrl, searchImages, type ImgResult } from "@/lib/storage";
import { createLabel, currentTarget, isoDate, readTarget, setAssignee, setDue, toggleLabel, toggleReaction } from "@/lib/meta";

type Icon = React.ComponentType<{ size?: number }>;
type Pop = { key: string; rect: DOMRect } | null;

/* ---------------- shared bits ---------------- */

function Tool({
  icon: I,
  label,
  onClick,
  on,
  disabled,
  title,
  onPointerDown,
  danger,
}: {
  icon: Icon;
  label: string;
  onClick?: (r: DOMRect) => void;
  on?: boolean;
  disabled?: boolean;
  title?: string;
  onPointerDown?: (e: React.PointerEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      className={"tool-btn" + (on ? " on" : "") + (danger ? " danger" : "")}
      disabled={disabled}
      title={title || label}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={onPointerDown}
      onClick={(e) => onClick?.(e.currentTarget.getBoundingClientRect())}
    >
      <I size={20} />
      <span>{label}</span>
    </button>
  );
}

function Popover({ pop, onClose, children, width = 240, keepFocus }: { pop: NonNullable<Pop>; onClose: () => void; children: React.ReactNode; width?: number; keepFocus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(pop.rect.top - 6);
  useEffect(() => {
    const h = ref.current?.offsetHeight || 0;
    setTop(Math.max(8, Math.min(pop.rect.top - 6, window.innerHeight - h - 12)));
  }, [pop.rect.top]);
  return (
    <>
      <div className="menu-backdrop" onMouseDown={(e) => keepFocus && e.preventDefault()} onPointerDown={onClose} />
      <div ref={ref} className="tb-popover" style={{ left: pop.rect.right + 10, top, width }} onMouseDown={(e) => keepFocus && (e.target as HTMLElement).tagName !== "INPUT" && e.preventDefault()}>
        {children}
      </div>
    </>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button className="tool-back" onMouseDown={(e) => e.preventDefault()} onClick={onClick} title="Back">
      <ArrowLeft size={15} />
    </button>
  );
}

/* ---------------- colour picker ---------------- */

export function ColorGrid({ value, onPick, allowDefault = true }: { value?: string; onPick: (c: string) => void; allowDefault?: boolean }) {
  const custom = useRef<HTMLInputElement>(null);
  return (
    <div className="color-grid-wrap">
      <div className="color-grid">
        {allowDefault && <button className={"cg default" + (!value || value === "default" ? " on" : "")} onClick={() => onPick("default")} title="Default" />}
        {PICKER_COLORS.map((c) => (
          <button key={c} className={"cg" + (value === c ? " on" : "")} style={{ background: c }} onClick={() => onPick(c)} title={c} />
        ))}
      </div>
      <div className="color-legacy">
        {PALETTE.slice(1).map((p) => (
          <button key={p.key} className={"cg sm" + (value === p.key ? " on" : "")} style={{ background: p.swatch }} onClick={() => onPick(p.key)} title={p.label} />
        ))}
      </div>
      <button className="custom-color" onClick={() => custom.current?.click()}>
        <span className="rainbow" /> Custom colour…
        <input ref={custom} type="color" value={isHex(value) && value!.length === 7 ? value : "#888888"} onChange={(e) => onPick(e.target.value)} />
      </button>
    </div>
  );
}

function CardColorPopover({ ids }: { ids: string[] }) {
  const first = useStore((s) => s.ws.cards[ids[0]]);
  const isColumn = ids.length === 1 && first?.type === "column";
  const mode = first?.colorMode || "bg";
  const set = (c: string, m?: "bg" | "strip") =>
    S().mutate(
      (d) => {
        for (const id of ids) {
          const x = d.cards[id];
          if (!x) continue;
          x.color = c;
          if (m) x.colorMode = m;
        }
      },
      { history: true }
    );
  return (
    <>
      {isColumn && (
        <div className="seg">
          <button className={mode === "bg" ? "on" : ""} onClick={() => set(first.color, "bg")}>
            <span className="seg-ico bg" /> Background
          </button>
          <button className={mode === "strip" ? "on" : ""} onClick={() => set(first.color, "strip")}>
            <span className="seg-ico strip" /> Top strip
          </button>
        </div>
      )}
      <ColorGrid value={first?.color} onPick={(c) => set(c)} />
    </>
  );
}

/* ---------------- labels ---------------- */

function LabelsPopover() {
  const labels = useStore((s) => s.ws.labels);
  useStore((s) => s.ws.cards); // re-render on change
  const [q, setQ] = useState("");
  const t = currentTarget();
  const cur = readTarget(t);
  const filtered = labels.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()));
  const exact = labels.some((l) => l.name.toLowerCase() === q.trim().toLowerCase());
  if (!t) return null;
  return (
    <div className="labels-pop">
      <input
        autoFocus
        placeholder="Enter label name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && q.trim()) {
            const id = exact ? labels.find((l) => l.name.toLowerCase() === q.trim().toLowerCase())!.id : createLabel(q.trim());
            if (!cur.labels.includes(id)) toggleLabel(t, id);
            setQ("");
          }
        }}
      />
      {q.trim() && !exact && (
        <button
          className="pop-item create"
          onClick={() => {
            toggleLabel(t, createLabel(q.trim()));
            setQ("");
          }}
        >
          + Create label “{q.trim()}”
        </button>
      )}
      <div className="pop-list" data-scroll>
        {filtered.map((l) => (
          <button key={l.id} className="pop-item" onClick={() => toggleLabel(t, l.id)}>
            <span className="label-chip" style={{ background: l.color }}>
              {l.name}
            </span>
            {cur.labels.includes(l.id) && <span className="tick">✓</span>}
          </button>
        ))}
        {!filtered.length && !q && <div className="muted small pad-s">No labels yet — type a name to create one.</div>}
        {!filtered.length && q && exact === false && <div className="muted small pad-s">There are no results</div>}
      </div>
    </div>
  );
}

/* ---------------- emoji reactions ---------------- */

export function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState("");
  const grid = useRef<HTMLDivElement>(null);
  const all = Array.from(new Set(EMOJI_CATEGORIES.flatMap((c) => c.emojis.split(" "))));
  const results = q.trim() ? all.filter((e) => (EMOJI_NAMES[e] || "").includes(q.trim().toLowerCase())) : null;
  return (
    <div className="emoji-pop">
      <div className="emoji-cats">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            className={i === cat ? "on" : ""}
            onClick={() => {
              setCat(i);
              setQ("");
              grid.current?.querySelector(`[data-cat="${i}"]`)?.scrollIntoView({ block: "start" });
            }}
          >
            {c.name}
          </button>
        ))}
        <input placeholder="Search emoji…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </div>
      <div className="emoji-grid" ref={grid} data-scroll>
        {results ? (
          <div className="emoji-row">
            {results.map((e) => (
              <button key={e} onClick={() => onPick(e)}>
                {e}
              </button>
            ))}
            {!results.length && <div className="muted small pad-s">No emoji found</div>}
          </div>
        ) : (
          EMOJI_CATEGORIES.map((c, i) => (
            <div key={c.name} data-cat={i}>
              <div className="emoji-title">{c.name}</div>
              <div className="emoji-row">
                {c.emojis.split(" ").map((e, k) => (
                  <button key={e + k} onClick={() => onPick(e)}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- due date / assign ---------------- */

function DuePopover({ close }: { close: () => void }) {
  const t = currentTarget();
  const cur = readTarget(t);
  if (!t?.itemId) return <div className="muted small pad-s">Click a task in the list first, then set its due date.</div>;
  const pick = (d?: string) => {
    setDue(t, d);
    close();
  };
  return (
    <div className="due-pop">
      <button className="pop-item" onClick={() => pick(isoDate(0))}>Today</button>
      <button className="pop-item" onClick={() => pick(isoDate(1))}>Tomorrow</button>
      <button className="pop-item" onClick={() => pick(isoDate(7))}>Next week</button>
      <label className="pop-date">
        Pick a date
        <input type="date" value={cur.due || ""} onChange={(e) => pick(e.target.value || undefined)} onKeyDown={(e) => e.stopPropagation()} />
      </label>
      {cur.due && (
        <button className="pop-item danger" onClick={() => pick(undefined)}>
          Remove due date
        </button>
      )}
    </div>
  );
}

function AssignPopover({ close }: { close: () => void }) {
  const people = useStore((s) => s.ws.people);
  const me = useStore((s) => s.ws.settings.userName || "Me");
  const [q, setQ] = useState("");
  const t = currentTarget();
  const cur = readTarget(t);
  if (!t?.itemId) return <div className="muted small pad-s">Click a task in the list first, then assign it.</div>;
  const all = Array.from(new Set([me, ...people])).filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (n?: string) => {
    setAssignee(t, n);
    close();
  };
  return (
    <div className="labels-pop">
      <input
        autoFocus
        placeholder="Type a name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && q.trim()) pick(q.trim());
        }}
      />
      <div className="pop-list">
        {all.map((p) => (
          <button key={p} className="pop-item" onClick={() => pick(p)}>
            <span className="assignee">@{p}</span>
            {cur.assignee === p && <span className="tick">✓</span>}
          </button>
        ))}
        {q.trim() && !all.includes(q.trim()) && (
          <button className="pop-item create" onClick={() => pick(q.trim())}>
            + Assign “{q.trim()}”
          </button>
        )}
        {cur.assignee && (
          <button className="pop-item danger" onClick={() => pick(undefined)}>
            Unassign
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- board picker ---------------- */

function BoardList({ onPick }: { onPick: (id: string) => void }) {
  const ws = useStore((s) => s.ws);
  const current = useStore((s) => s.currentBoardId);
  const out: { id: string; title: string; depth: number; icon: string }[] = [];
  const walk = (id: string, depth: number, seen: Set<string>) => {
    if (seen.has(id) || !ws.boards[id]) return;
    seen.add(id);
    out.push({ id, title: ws.boards[id].title || "Untitled", depth, icon: id === "home" ? "🏠" : ws.boards[id].icon });
    Object.values(ws.cards)
      .filter((c) => c.type === "board" && c.boardId === id && !c.deleted && c.data.boardId)
      .forEach((c) => walk(c.data.boardId!, depth + 1, seen));
  };
  walk("home", 0, new Set());
  return (
    <div className="pop-list" data-scroll>
      {out.map((b) => (
        <button key={b.id} className="pop-item" disabled={b.id === current} style={{ paddingLeft: 10 + b.depth * 14 }} onClick={() => onPick(b.id)}>
          <span>{b.icon}</span> {b.title}
        </button>
      ))}
    </div>
  );
}

/* ---------------- "more" menu for a card ---------------- */

function MoreMenu({ ids, close }: { ids: string[]; close: () => void }) {
  const card = useStore((s) => s.ws.cards[ids[0]]);
  const [sub, setSub] = useState<null | "move">(null);
  const run = (f: () => void) => () => {
    close();
    f();
  };
  if (sub === "move")
    return (
      <>
        <div className="dd-title">Move to…</div>
        <BoardList onPick={(b) => (close(), moveCardsToBoard(ids, b))} />
      </>
    );
  const locked = ids.every((id) => S().ws.cards[id]?.locked);
  return (
    <div className="pop-menu">
      {card?.type === "column" && ids.length === 1 && <button onClick={run(() => convertColumnToBoard(card.id))}>Convert to board</button>}
      <button onClick={run(() => toggleLock(ids))}>{locked ? "Unlock position" : "Lock position"}</button>
      <div className="dd-sep" />
      <button onClick={run(() => bringToFront(ids))}>Bring to front</button>
      <button onClick={run(() => sendToBack(ids))}>Send to back</button>
      <div className="dd-sep" />
      <button onClick={run(duplicateSelection)}>Duplicate <kbd>Ctrl D</kbd></button>
      <button onClick={run(() => copySelection())}>Copy <kbd>Ctrl C</kbd></button>
      <button onClick={() => setSub("move")}>Move to board…</button>
      {card?.type !== "column" && <button onClick={run(() => sendToUnsorted(ids))}>Send to Unsorted</button>}
      <div className="dd-sep" />
      <button className="danger" onClick={run(deleteSelection)}>Delete <kbd>Del</kbd></button>
      {card && ids.length === 1 && (
        <div className="pop-foot">
          <span className="avatar xs">{(S().ws.settings.userName || "M").slice(0, 1).toUpperCase()}</span> Created by you {timeAgo(card.createdAt)}
        </div>
      )}
    </div>
  );
}

/* ---------------- main tools ---------------- */

const MAIN: { kind: ToolKind; label: string; icon: Icon; key?: string }[] = [
  { kind: "note", label: "Note", icon: StickyNote, key: "N" },
  { kind: "link", label: "Link", icon: Link2, key: "L" },
  { kind: "todo", label: "To-do", icon: ListTodo, key: "T" },
  { kind: "line", label: "Line", icon: Spline },
  { kind: "board", label: "Board", icon: SquareKanban, key: "B" },
  { kind: "column", label: "Column", icon: Columns3, key: "C" },
  { kind: "comment", label: "Comment", icon: MessageSquare, key: "M" },
  { kind: "table", label: "Table", icon: Table },
];

const MORE: { kind: ToolKind; label: string; icon: Icon }[] = [
  { kind: "sketch", label: "Sketch", icon: PenLine },
  { kind: "swatch", label: "Color", icon: Palette },
  { kind: "document", label: "Document", icon: FileText },
  { kind: "upload-audio", label: "Audio", icon: AudioLines },
  { kind: "map", label: "Map", icon: MapPin },
  { kind: "video", label: "Video", icon: SquarePlay },
  { kind: "heading", label: "Heading", icon: Type },
];

function MainTools() {
  const [pop, setPop] = useState<Pop>(null);
  const close = () => setPop(null);
  return (
    <>
      <div className="tools">
        {MAIN.map((t) => (
          <Tool key={t.kind} icon={t.icon} label={t.label} title={`${t.label}${t.key ? ` (${t.key})` : ""} — click or drag onto the board`} onPointerDown={(e) => startToolDrag(e, t.kind, t.label)} />
        ))}
        <Tool icon={Ellipsis} label="More" on={pop?.key === "more"} onClick={(r) => setPop({ key: "more", rect: r })} />
        <div className="tool-sep" />
        <Tool icon={ImagePlus} label="Add image" on={pop?.key === "image"} onClick={(r) => setPop({ key: "image", rect: r })} />
        <Tool icon={Upload} label="Upload" title="Upload files (U) — or drop files on the board" onPointerDown={(e) => startToolDrag(e, "upload-file", "Upload")} />
        <Tool icon={Brush} label="Draw" title="Draw (D)" onPointerDown={(e) => startToolDrag(e, "sketch", "Draw")} />
      </div>
      {pop?.key === "more" && (
        <Popover pop={pop} onClose={close} width={260}>
          <div className="more-grid">
            {MORE.map((t) => (
              <button
                key={t.kind}
                className="more-item"
                onPointerDown={(e) => {
                  startToolDrag(e, t.kind, t.label);
                }}
                onClick={close}
              >
                <t.icon size={20} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </Popover>
      )}
      {pop?.key === "image" && (
        <Popover pop={pop} onClose={close} width={520}>
          <AddImagePanel close={close} />
        </Popover>
      )}
    </>
  );
}

/* ---------------- add image panel (upload / search free images / URL) ---------------- */


function AddImagePanel({ close }: { close: () => void }) {
  const [tab, setTab] = useState<"upload" | "search" | "url">("upload");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ImgResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    if (!q.trim()) return;
    setTab("search");
    setLoading(true);
    setErr("");
    try {
      setResults(await searchImages(q.trim()));
    } catch {
      setErr("Couldn't reach the free image library. Check your internet connection.");
      setResults([]);
    }
    setLoading(false);
  };

  const addFromUrl = async (u: string, title?: string) => {
    setLoading(true);
    try {
      const j = await importImage(u, title);
      await createImageCardFromUrl(j.url, j.name);
      close();
    } catch {
      setErr("Couldn't download that image.");
    }
    setLoading(false);
  };

  return (
    <div className="addimg">
      <div className="addimg-side">
        <button className={tab === "upload" ? "on" : ""} onClick={() => setTab("upload")}>Upload your own</button>
        <button className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>Free images</button>
        <button className={tab === "url" ? "on" : ""} onClick={() => setTab("url")}>From a link</button>
        <div className="addimg-search">
          <input
            placeholder="Search images…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") search();
            }}
          />
          <button onClick={search} aria-label="Search">
            <Search size={14} />
          </button>
        </div>
        <div className="muted xsmall">Free images provided by Openverse</div>
      </div>
      <div className="addimg-main" data-scroll>
        {tab === "upload" && (
          <div className="addimg-upload">
            <div className="addimg-art">🖼️</div>
            <button className="btn primary" onClick={() => fileRef.current?.click()}>
              Upload an image
            </button>
            <p className="muted small">Tip: the easiest way to add an image is to drag it straight onto the board, or paste a screenshot with Ctrl V.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                if (f.length) uploadFiles(f);
                close();
              }}
            />
          </div>
        )}
        {tab === "search" && (
          <>
            {loading && <div className="muted pad-s">Searching…</div>}
            {err && <div className="muted pad-s">{err}</div>}
            {!loading && !results && <div className="muted pad-s">Type a search above and press Enter.</div>}
            {results && !loading && results.length === 0 && !err && <div className="muted pad-s">No images found.</div>}
            <div className="img-results">
              {results?.map((r) => (
                <button key={r.url} className="img-result" onClick={() => addFromUrl(r.url, r.title)} title={`${r.title}${r.creator ? " — " + r.creator : ""}`}>
                  <img src={proxied(r.thumbnail)} alt={r.title} loading="lazy" />
                </button>
              ))}
            </div>
          </>
        )}
        {tab === "url" && (
          <div className="addimg-upload">
            <input className="url-input" placeholder="https://example.com/picture.jpg" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            <button className="btn primary" disabled={!url.trim() || loading} onClick={() => addFromUrl(url.trim())}>
              {loading ? "Adding…" : "Add image"}
            </button>
            {err && <div className="muted small">{err}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- text editing tools ---------------- */

const TEXT_COLORS = ["inherit", "#2bb3c0", "#22c55e", "#f5a623", "#e25563", "#8b5cf6"];
const HILITES = ["#1f2328", "#bfe9ff", "#d4f7b0", "#fff1a8", "#ffd0e8", "transparent"];

function useCommandState() {
  const [st, setSt] = useState<Record<string, boolean | string>>({});
  useEffect(() => {
    const up = () => {
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
      setSt({ bold: q("bold"), italic: q("italic"), underline: q("underline"), strike: q("strikeThrough"), ul: q("insertUnorderedList"), ol: q("insertOrderedList"), block });
    };
    up();
    document.addEventListener("selectionchange", up);
    return () => document.removeEventListener("selectionchange", up);
  }, []);
  return st;
}

export function TextStyleMenu({ onDone }: { onDone?: () => void }) {
  const cmd = (c: string, v?: string) => document.execCommand(c, false, v);
  const block = (tag: string) => {
    cmd("formatBlock", tag);
    onDone?.();
  };
  const items: [string, string, string][] = [
    ["h1", "Large heading", "Ctrl Alt 1"],
    ["h2", "Normal heading", "Ctrl Alt 2"],
    ["div", "Normal text", "Ctrl Alt 0"],
    ["h6", "Small text", "Ctrl Alt 3"],
    ["pre", "Code block", ""],
    ["address", "Callout", ""],
    ["blockquote", "Quote block", ""],
  ];
  return (
    <div className="textstyle-pop">
      {items.map(([tag, label, kb]) => (
        <button key={tag} className={"ts-item ts-" + tag} onMouseDown={(e) => e.preventDefault()} onClick={() => block(tag)}>
          <span>{tag === "address" ? "⚠️ " + label : tag === "blockquote" ? `“${label}”` : label}</span>
          {kb && <kbd>{kb}</kbd>}
        </button>
      ))}
      <div className="ts-label">Color</div>
      <div className="ts-row">
        {TEXT_COLORS.map((c) => (
          <button key={c} className="ts-a" style={{ color: c === "inherit" ? "var(--text)" : c }} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("foreColor", c === "inherit" ? getComputedStyle(document.activeElement || document.body).color : c)}>
            A
          </button>
        ))}
      </div>
      <div className="ts-label">Highlight</div>
      <div className="ts-row">
        {HILITES.map((c) => (
          <button
            key={c}
            className="ts-a hl"
            style={{ background: c === "transparent" ? "transparent" : c, color: c === "#1f2328" ? "#fff" : "#1f2328" }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => cmd("hiliteColor", c)}
          >
            A
          </button>
        ))}
      </div>
    </div>
  );
}

export function TextTools({ vertical = true, onBack }: { vertical?: boolean; onBack?: () => void }) {
  const st = useCommandState();
  const [pop, setPop] = useState<Pop>(null);
  const cmd = (c: string, v?: string) => document.execCommand(c, false, v);
  const [align, setAlign] = useState<"left" | "center">("left");
  return (
    <>
      {vertical && <Back onClick={() => onBack?.()} />}
      <div className="tools">
        <Tool icon={Type} label="Text style" on={pop?.key === "ts"} onClick={(r) => setPop(pop ? null : { key: "ts", rect: r })} />
        <button className={"tool-btn letter" + (st.bold ? " on" : "")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("bold")} title="Bold (Ctrl B)">
          <b>B</b>
        </button>
        <button className={"tool-btn letter" + (st.italic ? " on" : "")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("italic")} title="Italic (Ctrl I)">
          <i style={{ fontFamily: "Georgia, serif" }}>I</i>
        </button>
        <button className={"tool-btn letter" + (st.strike ? " on" : "")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("strikeThrough")} title="Strikethrough">
          <s>S</s>
        </button>
        <button className={"tool-btn letter" + (st.underline ? " on" : "")} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("underline")} title="Underline (Ctrl U)">
          <u>U</u>
        </button>
        <Tool icon={List} label="Bullets" on={!!st.ul} onClick={() => cmd("insertUnorderedList")} />
        <Tool icon={ListOrdered} label="Numbers" on={!!st.ol} onClick={() => cmd("insertOrderedList")} />
        <Tool
          icon={align === "left" ? TextAlignStart : TextAlignCenter}
          label="Align"
          onClick={() => {
            const n = align === "left" ? "center" : "left";
            cmd(n === "center" ? "justifyCenter" : "justifyLeft");
            setAlign(n);
          }}
        />
        <Tool
          icon={Code}
          label="Code"
          on={st.block === "pre"}
          onClick={() => {
            const sel = window.getSelection();
            const text = sel?.toString();
            if (text) cmd("insertHTML", `<code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code>&#8203;`);
            else cmd("formatBlock", st.block === "pre" ? "div" : "pre");
          }}
        />
        <Tool
          icon={Link}
          label="Link"
          onClick={() => {
            const sel = window.getSelection();
            const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
            const url = prompt("Link URL", "https://");
            if (url && range) {
              sel!.removeAllRanges();
              sel!.addRange(range);
              cmd("createLink", url);
            }
          }}
        />
        <Tool icon={Highlighter} label="Highlight" onClick={() => cmd("hiliteColor", "#fff1a8")} />
      </div>
      {pop?.key === "ts" && (
        <Popover pop={pop} onClose={() => setPop(null)} width={230} keepFocus>
          <TextStyleMenu onDone={() => setPop(null)} />
        </Popover>
      )}
    </>
  );
}

/* ---------------- line tools ---------------- */

const LINE_COLORS = ["#5b6573", "#1f2328", "#e25563", "#f5a623", "#22c55e", "#2bb3c0", "#4f7cff", "#8b5cf6", "#ec4899"];

function LineTools({ line }: { line: Line }) {
  const [pop, setPop] = useState<Pop>(null);
  const close = () => setPop(null);
  return (
    <>
      <Back onClick={() => S().set({ selectedLines: [] })} />
      <div className="tools">
        <Tool icon={() => <span className="color-dot-ico" style={{ background: line.color }} />} label="Color" on={pop?.key === "color"} onClick={(r) => setPop({ key: "color", rect: r })} />
        <Tool icon={() => <span className="arrow-ico">{line.arrowStart ? "◀—" : "—"}</span>} label="Start" on={line.arrowStart} onClick={() => patchLine(line.id, { arrowStart: !line.arrowStart })} />
        <Tool icon={() => <span className="arrow-ico">{line.arrowEnd ? "—▶" : "—"}</span>} label="End" on={line.arrowEnd} onClick={() => patchLine(line.id, { arrowEnd: !line.arrowEnd })} />
        <Tool icon={Captions} label="Label" on={pop?.key === "label" || !!line.label} onClick={(r) => setPop({ key: "label", rect: r })} />
        <Tool icon={() => <span className="arrow-ico">- - -</span>} label="Dashed" on={line.dashed} onClick={() => patchLine(line.id, { dashed: !line.dashed })} />
        <Tool icon={Minus} label="Weight" on={pop?.key === "weight"} onClick={(r) => setPop({ key: "weight", rect: r })} />
        <Tool
          icon={Trash}
          label="Delete"
          danger
          onClick={() => {
            S().mutate((d) => void delete d.lines[line.id], { history: true });
            S().set({ selectedLines: [] });
          }}
        />
      </div>
      {pop?.key === "color" && (
        <Popover pop={pop} onClose={close} width={196}>
          <div className="color-grid">
            {LINE_COLORS.map((c) => (
              <button key={c} className={"cg" + (line.color === c ? " on" : "")} style={{ background: c }} onClick={() => patchLine(line.id, { color: c })} />
            ))}
          </div>
        </Popover>
      )}
      {pop?.key === "label" && (
        <Popover pop={pop} onClose={close} width={220}>
          <input
            autoFocus
            className="pop-input"
            placeholder="Line label"
            value={line.label}
            onChange={(e) => patchLine(line.id, { label: e.target.value }, "label-" + line.id)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === "Escape") close();
            }}
          />
        </Popover>
      )}
      {pop?.key === "weight" && (
        <Popover pop={pop} onClose={close} width={160}>
          <div className="pop-menu">
            {[
              [1.5, "Thin"],
              [2, "Regular"],
              [4, "Bold"],
              [6, "Heavy"],
            ].map(([w, n]) => (
              <button key={w} className={line.width === w ? "on" : ""} onClick={() => (patchLine(line.id, { width: w as number }), close())}>
                <svg width="40" height="12">
                  <path d="M2 6h36" stroke="currentColor" strokeWidth={w as number} strokeLinecap="round" />
                </svg>
                {n}
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}

/* ---------------- table tools ---------------- */

function tableMutate(cardId: string, fn: (cells: Cell[][]) => Cell[][]) {
  const c = S().ws.cards[cardId];
  if (!c) return;
  const cells = normalizeCells(c);
  updateCard(cardId, { cells: fn(cells.map((r) => r.map((x) => ({ ...x })))) });
}

export function normalizeCells(c: Card): Cell[][] {
  if (c.data.cells?.length) return c.data.cells;
  if (c.data.rows?.length) return c.data.rows.map((r) => r.map((v) => ({ v })));
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ v: "" })));
}

function TableTools({ card }: { card: Card }) {
  const sel = useStore((s) => (s.tableSel?.cardId === card.id ? s.tableSel : null));
  const [pop, setPop] = useState<Pop>(null);
  const close = () => setPop(null);
  const range = sel ? { r0: Math.min(sel.r0, sel.r1), r1: Math.max(sel.r0, sel.r1), c0: Math.min(sel.c0, sel.c1), c1: Math.max(sel.c0, sel.c1) } : null;
  const forRange = (f: (cell: Cell) => void) =>
    range &&
    tableMutate(card.id, (cells) => {
      for (let r = range.r0; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) if (cells[r]?.[c]) f(cells[r][c]);
      return cells;
    });
  const cells = normalizeCells(card);
  const first = range ? cells[range.r0]?.[range.c0] : undefined;
  return (
    <>
      <div className="tools">
        <Tool icon={() => <b className="letter-ico">B</b>} label="Bold" disabled={!range} on={!!first?.bold} onClick={() => forRange((c) => (c.bold = !first?.bold))} />
        <Tool icon={PaintBucket} label="Cell color" disabled={!range} on={pop?.key === "bg"} onClick={(r) => setPop({ key: "bg", rect: r })} />
        <Tool icon={() => <span className="color-a-ico">A</span>} label="Text color" disabled={!range} on={pop?.key === "fg"} onClick={(r) => setPop({ key: "fg", rect: r })} />
        <Tool
          icon={TextAlignStart}
          label="Alignment"
          disabled={!range}
          onClick={() => {
            const next = first?.align === "center" ? "right" : first?.align === "right" ? "left" : "center";
            forRange((c) => (c.align = next));
          }}
        />
        <Tool icon={() => <span className="fx-ico">fx</span>} label="Formula" onClick={(r) => setPop({ key: "fx", rect: r })} />
        <Tool
          icon={BetweenVerticalStart}
          label="Add column"
          onClick={() =>
            tableMutate(card.id, (cells) => {
              const at = range ? range.c1 + 1 : cells[0].length;
              return cells.map((row) => [...row.slice(0, at), { v: "" }, ...row.slice(at)]);
            })
          }
        />
        <Tool
          icon={BetweenHorizontalStart}
          label="Add row"
          onClick={() =>
            tableMutate(card.id, (cells) => {
              const at = range ? range.r1 + 1 : cells.length;
              return [...cells.slice(0, at), cells[0].map(() => ({ v: "" })), ...cells.slice(at)];
            })
          }
        />
        <Tool icon={Ellipsis} label="More" on={pop?.key === "more"} onClick={(r) => setPop({ key: "more", rect: r })} />
      </div>
      {(pop?.key === "bg" || pop?.key === "fg") && (
        <Popover pop={pop} onClose={close} width={230}>
          <ColorGrid
            value={pop.key === "bg" ? first?.bg : first?.color}
            onPick={(c) => forRange((cell) => (pop.key === "bg" ? (cell.bg = c === "default" ? undefined : c) : (cell.color = c === "default" ? undefined : c)))}
          />
        </Popover>
      )}
      {pop?.key === "fx" && (
        <Popover pop={pop} onClose={close} width={260}>
          <div className="pad-s small">
            <b>Formulas</b>
            <p className="muted">Start a cell with <code>=</code>. Examples:</p>
            <code>=A1+B1</code> · <code>=A1*2</code>
            <br />
            <code>=SUM(A1:A5)</code> · <code>=AVERAGE(B1:B4)</code>
            <br />
            <code>=MIN(A1:C1)</code> · <code>=MAX(A1:C1)</code> · <code>=COUNT(A1:A9)</code>
          </div>
        </Popover>
      )}
      {pop?.key === "more" && (
        <Popover pop={pop} onClose={close} width={220}>
          <div className="pop-menu">
            <button
              disabled={!range || cells.length <= 1}
              onClick={() => {
                if (range) tableMutate(card.id, (cs) => cs.filter((_, i) => i < range.r0 || i > range.r1));
                S().set({ tableSel: null });
                close();
              }}
            >
              Delete selected row(s)
            </button>
            <button
              disabled={!range || cells[0].length <= 1}
              onClick={() => {
                if (range) tableMutate(card.id, (cs) => cs.map((row) => row.filter((_, i) => i < range.c0 || i > range.c1)));
                S().set({ tableSel: null });
                close();
              }}
            >
              Delete selected column(s)
            </button>
            <button onClick={() => (forRange((c) => Object.assign(c, { v: "" })), close())} disabled={!range}>
              Clear cells
            </button>
            <div className="dd-sep" />
            <MoreMenu ids={[card.id]} close={close} />
          </div>
        </Popover>
      )}
    </>
  );
}

/* ---------------- card tools ---------------- */

function CardTools({ card }: { card: Card }) {
  const [pop, setPop] = useState<Pop>(null);
  const close = () => setPop(null);
  const activeItem = useStore((s) => (s.activeItem?.cardId === card.id ? s.activeItem.itemId : null));
  useEffect(() => setPop(null), [card.id]);
  const P = (key: string) => (r: DOMRect) => setPop(pop?.key === key ? null : { key, rect: r });
  const colorIcon = () => (
    <span
      className="color-dot-ico"
      style={{ background: isHex(card.color) ? card.color : PALETTE.find((p) => p.key === card.color)?.swatch || "#fff" }}
    />
  );
  const t: React.ReactNode[] = [];
  const add = (k: string, n: React.ReactNode) => t.push(<span key={k}>{n}</span>);
  const color = () => add("color", <Tool icon={colorIcon} label="Color" on={pop?.key === "color"} onClick={P("color")} />);
  const labels = () => add("labels", <Tool icon={Tag} label="Labels" on={pop?.key === "labels"} onClick={P("labels")} />);
  const reactions = () => add("react", <Tool icon={FaceSlightlySmilingPlus} label="Reactions" on={pop?.key === "react"} onClick={P("react")} />);
  const comment = () => add("comment", <Tool icon={MessageCircle} label="Comment" onClick={() => S().set({ commentOpen: S().commentOpen === card.id ? null : card.id })} />);
  const more = () => add("more", <Tool icon={Ellipsis} label="More" on={pop?.key === "more"} onClick={P("more")} />);

  switch (card.type) {
    case "note":
      color();
      labels();
      reactions();
      comment();
      break;
    case "todo":
      color();
      add("title", <Tool icon={PanelTop} label="Title" on={card.data.showTitle ?? !!card.data.title} onClick={() => updateCard(card.id, { showTitle: !(card.data.showTitle ?? !!card.data.title) })} />);
      reactions();
      add("due", <Tool icon={CalendarDays} label="Due date" on={pop?.key === "due"} onClick={P("due")} title={activeItem ? "Due date" : "Click a task first"} />);
      add("assign", <Tool icon={UserPlus} label="Assign" on={pop?.key === "assign"} onClick={P("assign")} title={activeItem ? "Assign" : "Click a task first"} />);
      labels();
      comment();
      break;
    case "image":
      labels();
      reactions();
      comment();
      add("caption", <Tool icon={Captions} label="Caption" on={!!card.data.showCaption} onClick={() => updateCard(card.id, { showCaption: !card.data.showCaption })} />);
      add("open", <Tool icon={Eye} label="View" onClick={() => S().set({ modal: { type: "image", id: card.id } })} />);
      add("dl", <Tool icon={Download} label="Download" onClick={async () => { const a = document.createElement("a"); a.href = await resolveUrl(card.data.url); a.download = card.data.name || "image"; a.click(); }} />);
      break;
    case "link":
      color();
      labels();
      reactions();
      comment();
      add("preview", <Tool icon={card.data.hidePreview ? EyeOff : Eye} label="Preview" on={!card.data.hidePreview} onClick={() => updateCard(card.id, { hidePreview: !card.data.hidePreview })} />);
      add("rename", <Tool icon={Pencil} label="Rename" onClick={() => { const n = prompt("Title", card.data.customTitle || card.data.title || ""); if (n !== null) updateCard(card.id, { customTitle: n }); }} />);
      add("caption", <Tool icon={Captions} label="Caption" on={!!card.data.showCaption} onClick={() => updateCard(card.id, { showCaption: !card.data.showCaption })} />);
      add("open", <Tool icon={ExternalLink} label="Open" onClick={() => window.open(card.data.url, "_blank")} />);
      add("refresh", <Tool icon={RefreshCw} label="Refresh" onClick={() => updateCard(card.id, { status: "idle" })} />);
      break;
    case "document":
      color();
      add("view", <Tool icon={PanelTop} label="Card view" on={!!card.data.cardView} onClick={() => updateCard(card.id, { cardView: !card.data.cardView })} />);
      add("open", <Tool icon={FileText} label="Open" onClick={() => S().set({ modal: { type: "document", id: card.id } })} />);
      labels();
      comment();
      break;
    case "column":
      color();
      add("rename", <Tool icon={Pencil} label="Rename" onClick={() => S().set({ focusRequest: card.id })} />);
      add("collapse", <Tool icon={Inbox} label={card.data.collapsed ? "Expand" : "Collapse"} onClick={() => updateCard(card.id, { collapsed: !card.data.collapsed })} />);
      break;
    case "board":
      color();
      add("icon", <Tool icon={() => <span className="emoji-ico">{S().ws.boards[card.data.boardId!]?.icon}</span>} label="Icon" on={pop?.key === "icon"} onClick={P("icon")} />);
      add("rename", <Tool icon={Pencil} label="Rename" onClick={() => S().set({ focusRequest: card.id })} />);
      add("open", <Tool icon={ExternalLink} label="Open" onClick={() => navigate(card.data.boardId!)} />);
      break;
    case "swatch":
      add("color", <Tool icon={colorIcon} label="Color" on={pop?.key === "swcolor"} onClick={P("swcolor")} />);
      labels();
      comment();
      break;
    case "sketch":
      add("draw", <Tool icon={PenLine} label="Draw" onClick={() => S().set({ drawingId: card.id })} />);
      color();
      labels();
      comment();
      break;
    case "heading":
      color();
      add("size", <Tool icon={Type} label={`Size ${(card.data.hsize || "l").toUpperCase()}`} onClick={() => updateCard(card.id, { hsize: card.data.hsize === "l" || !card.data.hsize ? "m" : card.data.hsize === "m" ? "s" : "l" })} />);
      break;
    case "map":
      color();
      add("edit", <Tool icon={MapPin} label="Location" onClick={() => { const q = prompt("Location", card.data.query || ""); if (q !== null) updateCard(card.id, { query: q }); }} />);
      labels();
      comment();
      break;
    case "file":
      labels();
      reactions();
      comment();
      add("dl", <Tool icon={Download} label="Download" onClick={async () => { const a = document.createElement("a"); a.href = await resolveUrl(card.data.url); a.download = card.data.name || "file"; a.click(); }} />);
      break;
    case "comment":
      color();
      reactions();
      break;
    case "table":
      return <TableTools card={card} />;
  }
  more();
  if (card.locked) add("lock", <Tool icon={LockOpen} label="Unlock" onClick={() => toggleLock([card.id])} />);

  const target = currentTarget();
  return (
    <>
      <div className="tools">{t}</div>
      {pop?.key === "color" && (
        <Popover pop={pop} onClose={close} width={card.type === "column" ? 250 : 230}>
          <CardColorPopover ids={[card.id]} />
        </Popover>
      )}
      {pop?.key === "swcolor" && (
        <Popover pop={pop} onClose={close} width={230}>
          <ColorGrid value={card.data.color} allowDefault={false} onPick={(c) => updateCard(card.id, { color: isHex(c) ? c : PALETTE.find((p) => p.key === c)?.swatch || c })} />
        </Popover>
      )}
      {pop?.key === "labels" && (
        <Popover pop={pop} onClose={close} width={240}>
          <LabelsPopover />
        </Popover>
      )}
      {pop?.key === "react" && target && (
        <Popover pop={pop} onClose={close} width={420}>
          <EmojiPicker
            onPick={(e) => {
              toggleReaction(target, e, true);
              close();
            }}
          />
        </Popover>
      )}
      {pop?.key === "due" && (
        <Popover pop={pop} onClose={close} width={210}>
          <DuePopover close={close} />
        </Popover>
      )}
      {pop?.key === "assign" && (
        <Popover pop={pop} onClose={close} width={220}>
          <AssignPopover close={close} />
        </Popover>
      )}
      {pop?.key === "icon" && card.data.boardId && (
        <Popover pop={pop} onClose={close} width={212}>
          <div className="icon-grid">
            {BOARD_ICONS.map((i) => (
              <button key={i} onClick={() => (S().mutate((d) => void (d.boards[card.data.boardId!].icon = i), { history: true }), close())}>
                {i}
              </button>
            ))}
          </div>
        </Popover>
      )}
      {pop?.key === "more" && (
        <Popover pop={pop} onClose={close} width={230}>
          <MoreMenu ids={[card.id]} close={close} />
        </Popover>
      )}
    </>
  );
}

function MultiTools({ ids }: { ids: string[] }) {
  const [pop, setPop] = useState<Pop>(null);
  const close = () => setPop(null);
  return (
    <>
      <Back onClick={() => S().set({ selection: [] })} />
      <div className="tools">
        <div className="tool-count">{ids.length} selected</div>
        <Tool icon={Palette} label="Color" on={pop?.key === "color"} onClick={(r) => setPop({ key: "color", rect: r })} />
        <Tool icon={AlignStartVertical} label="Align left" onClick={() => alignSelection("left")} />
        <Tool icon={AlignStartHorizontal} label="Align top" onClick={() => alignSelection("top")} />
        <Tool icon={AlignHorizontalSpaceAround} label="Space H" onClick={() => alignSelection("distH")} />
        <Tool icon={AlignVerticalSpaceAround} label="Space V" onClick={() => alignSelection("distV")} />
        <Tool icon={Copy} label="Duplicate" onClick={duplicateSelection} />
        <Tool icon={FolderInput} label="Move" on={pop?.key === "move"} onClick={(r) => setPop({ key: "move", rect: r })} />
        <Tool icon={ids.every((id) => S().ws.cards[id]?.locked) ? LockOpen : Lock} label="Lock" onClick={() => toggleLock(ids)} />
        <Tool icon={ArrowUpToLine} label="Front" onClick={() => bringToFront(ids)} />
        <Tool icon={ArrowDownToLine} label="Back" onClick={() => sendToBack(ids)} />
        <Tool icon={Trash} label="Delete" danger onClick={deleteSelection} />
      </div>
      {pop?.key === "color" && (
        <Popover pop={pop} onClose={close} width={230}>
          <CardColorPopover ids={ids} />
        </Popover>
      )}
      {pop?.key === "move" && (
        <Popover pop={pop} onClose={close} width={240}>
          <div className="dd-title">Move {ids.length} items to…</div>
          <BoardList onPick={(b) => (close(), moveCardsToBoard(ids, b))} />
        </Popover>
      )}
    </>
  );
}

/* ---------------- the toolbar ---------------- */

function useRichTextFocus() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const up = () => {
      const a = document.activeElement as HTMLElement | null;
      setEl(a && a.hasAttribute("data-rt") && !a.closest(".modal") ? a : null);
    };
    document.addEventListener("focusin", up);
    document.addEventListener("focusout", () => setTimeout(up, 0));
    return () => {
      document.removeEventListener("focusin", up);
    };
  }, []);
  return el;
}

export function LeftToolbar() {
  const sel = useStore((s) => s.selection);
  const lines = useStore((s) => s.selectedLines);
  const card = useStore((s) => (s.selection.length === 1 ? s.ws.cards[s.selection[0]] : undefined));
  const line = useStore((s) => (s.selectedLines.length === 1 && !s.selection.length ? s.ws.lines[s.selectedLines[0]] : undefined));
  const dragging = useStore((s) => s.dragging);
  const dropTrash = useStore((s) => s.dropTarget?.kind === "trash");
  const trashCount = useStore((s) => trashedCards(s.ws).length);
  const rt = useRichTextFocus();

  let content: React.ReactNode;
  if (dragging) content = <MainToolsStatic />;
  else if (rt) content = <TextTools onBack={() => rt.blur()} />;
  else if (card) content = (
    <>
      <Back onClick={() => S().set({ selection: [], activeItem: null, tableSel: null })} />
      <CardTools card={card} />
    </>
  );
  else if (sel.length > 1) content = <MultiTools ids={sel} />;
  else if (line) content = <LineTools line={line} />;
  else content = <MainTools />;
  void lines;

  return (
    <nav className="toolbar">
      {content}
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

/** Non-interactive copy of the main tools shown while dragging (keeps layout stable). */
function MainToolsStatic() {
  return (
    <div className="tools dim">
      {MAIN.map((t) => (
        <button key={t.kind} className="tool-btn" tabIndex={-1}>
          <t.icon size={20} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

export { createFromTool };
