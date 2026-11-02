"use client";
import type { Card, CardData, CardType, Line, Workspace } from "./types";
import { defaultsFor } from "./actions";
import { uid } from "./utils";

/** Small builder used by templates and the welcome board. */
export class Builder {
  cards: Card[] = [];
  lines: Line[] = [];
  boards: Workspace["boards"] = {};
  z = 1;
  constructor(public boardId: string) {}

  card(type: CardType, x: number, y: number, data: Partial<CardData> = {}, extra: Partial<Card> = {}): Card {
    const def = defaultsFor(type);
    const c: Card = {
      id: uid(),
      type,
      boardId: extra.boardId || this.boardId,
      parentId: null,
      order: 0,
      x,
      y,
      w: def.w,
      h: def.h,
      z: this.z++,
      color: "default",
      data: { ...def.data, ...data },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...extra,
    };
    this.cards.push(c);
    return c;
  }
  note(x: number, y: number, html: string, extra: Partial<Card> = {}) {
    return this.card("note", x, y, { html }, extra);
  }
  todo(x: number, y: number, title: string, items: (string | [string, boolean])[], extra: Partial<Card> = {}) {
    return this.card(
      "todo",
      x,
      y,
      { title, items: items.map((i) => (typeof i === "string" ? { id: uid(), text: i, done: false } : { id: uid(), text: i[0], done: i[1] })) },
      extra
    );
  }
  column(x: number, y: number, title: string, children: Card[], extra: Partial<Card> = {}) {
    const col = this.card("column", x, y, { title }, extra);
    children.forEach((ch, i) => {
      ch.parentId = col.id;
      ch.order = i;
    });
    return col;
  }
  board(x: number, y: number, title: string, icon: string, color = "default") {
    const bid = uid();
    this.boards[bid] = { id: bid, title, icon, createdAt: Date.now() };
    const c = this.card("board", x, y, { boardId: bid }, { color });
    return { card: c, boardId: bid };
  }
  line(a: Card | { x: number; y: number }, b: Card | { x: number; y: number }, extra: Partial<Line> = {}) {
    const ep = (v: Card | { x: number; y: number }) => ("id" in v ? { cardId: v.id, x: 0, y: 0 } : { cardId: null, x: v.x, y: v.y });
    const l: Line = {
      id: uid(),
      boardId: this.boardId,
      from: ep(a),
      to: ep(b),
      cx: 0,
      cy: 0,
      color: "#5b6573",
      width: 2,
      dashed: false,
      arrowStart: false,
      arrowEnd: true,
      label: "",
      ...extra,
    };
    this.lines.push(l);
    return l;
  }
  commit(ws: Workspace) {
    for (const b of Object.values(this.boards)) ws.boards[b.id] = b;
    for (const c of this.cards) ws.cards[c.id] = c;
    for (const l of this.lines) ws.lines[l.id] = l;
  }
}

export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  build: (b: Builder) => void;
}

const sw = (b: Builder, x: number, y: number, color: string, name: string) => b.card("swatch", x, y, { color, name });

export const TEMPLATES: Template[] = [
  {
    id: "blank",
    name: "Blank board",
    icon: "📁",
    description: "Start from an empty canvas.",
    build: () => {},
  },
  {
    id: "moodboard",
    name: "Moodboard",
    icon: "🎨",
    description: "Collect images, colours and references for a visual direction.",
    build: (b) => {
      b.note(0, 0, "<h1>Moodboard</h1><div>Drag images from your desktop onto this board, or paste links. Group references into columns.</div>", { w: 360, color: "yellow" });
      b.column(0, 180, "Inspiration", [b.note(0, 0, "<div>Drop reference images here</div>"), b.note(0, 0, "<div>Paste a Pinterest / Behance link</div>")]);
      b.column(330, 180, "Typography", [b.note(0, 0, "<h2>Heading font</h2><div>e.g. Playfair Display</div>"), b.note(0, 0, "<div><b>Body font</b> — Inter</div>")]);
      b.column(660, 180, "Textures & Mood", [b.note(0, 0, "<div>Warm, natural, calm</div>")]);
      const colors: [string, string][] = [["#1f2933", "Ink"], ["#e4c9a8", "Sand"], ["#c86b4a", "Terracotta"], ["#7d8f69", "Sage"], ["#f6f1e9", "Cream"]];
      colors.forEach(([c, n], i) => sw(b, 400 + i * 160, 0, c, n));
      b.todo(1000, 180, "Next steps", ["Collect 20 references", "Pick 3 key images", "Define palette", "Share with client"]);
    },
  },
  {
    id: "kanban",
    name: "Project plan (Kanban)",
    icon: "📋",
    description: "Columns for Backlog, In progress, Review and Done.",
    build: (b) => {
      b.note(0, 0, "<h1>Project plan</h1><div>Drag cards between columns as work moves forward.</div>", { w: 420, color: "blue" });
      b.column(0, 150, "Backlog", [b.note(0, 0, "<div>Research competitors</div>"), b.note(0, 0, "<div>Write creative brief</div>"), b.note(0, 0, "<div>Collect brand assets</div>")], { color: "gray" });
      b.column(330, 150, "In progress", [b.note(0, 0, "<div><b>Design key visual</b></div><div>Due Friday</div>", { color: "yellow" }), b.todo(0, 0, "Social posts", ["Facebook cover", "Instagram carousel", ["Story template", true]])], { color: "orange" });
      b.column(660, 150, "Review", [b.note(0, 0, "<div>Video teaser v1 — waiting for feedback</div>")], { color: "purple" });
      b.column(990, 150, "Done", [b.note(0, 0, "<div><s>Kick-off meeting</s></div>", { color: "green" })], { color: "green" });
    },
  },
  {
    id: "brainstorm",
    name: "Brainstorm / Mind map",
    icon: "🧠",
    description: "A central idea with connected branches.",
    build: (b) => {
      const center = b.note(400, 300, "<h1>Main idea</h1><div>What problem are we solving?</div>", { w: 280, color: "yellow" });
      const pts: [number, number, string, string][] = [
        [20, 40, "Audience", "blue"],
        [780, 40, "Channels", "teal"],
        [0, 560, "Messaging", "pink"],
        [800, 560, "Budget", "green"],
        [420, 40, "Goals", "purple"],
      ];
      for (const [x, y, t, c] of pts) {
        const n = b.note(x, y, `<h2>${t}</h2><div>Add ideas…</div>`, { color: c, w: 220 });
        b.line(center, n, { arrowEnd: false });
      }
    },
  },
  {
    id: "storyboard",
    name: "Video storyboard",
    icon: "🎬",
    description: "Scene-by-scene frames with shot notes — great for planning edits.",
    build: (b) => {
      b.note(0, 0, "<h1>Storyboard</h1><div><b>Project:</b> …  <b>Length:</b> 30s  <b>Format:</b> 9:16 / 16:9</div>", { w: 520, color: "orange" });
      for (let i = 0; i < 6; i++) {
        const sk = b.card("sketch", 0, 0, { strokes: [], vbW: 320, vbH: 180 }, { w: 300, h: 190 });
        const n = b.note(0, 0, `<div><b>Shot:</b> Wide / Close-up</div><div><b>Action:</b> …</div><div><b>Audio / VO:</b> …</div><div><b>Duration:</b> 0:0${i * 5 % 10}</div>`);
        b.column((i % 3) * 340, 140 + Math.floor(i / 3) * 520, `Scene ${i + 1}`, [sk, n]);
      }
      b.todo(1040, 140, "Production checklist", ["Script locked", "Shot list", "B-roll", "Music licensed", "Captions", "Export 1080p + 4K"]);
    },
  },
  {
    id: "content-calendar",
    name: "Content calendar",
    icon: "📅",
    description: "Plan a week of social media posts, one column per day.",
    build: (b) => {
      b.note(0, 0, "<h1>Content calendar</h1><div>One column per day. Add the post copy, the visual and the platform.</div>", { w: 480, color: "pink" });
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      days.forEach((d, i) =>
        b.column(i * 300, 150, d, [b.note(0, 0, "<div><b>Platform:</b> Facebook</div><div><b>Type:</b> Image post</div><div><b>Caption:</b> …</div>")], { w: 280 })
      );
      b.todo(0, 620, "This week", ["Plan 7 posts", "Design visuals", "Write captions", "Schedule in Meta Business Suite"]);
    },
  },
];

export function welcomeWorkspace(): Workspace {
  const ws: Workspace = {
    version: 1,
    boards: { home: { id: "home", title: "Home", icon: "🏠", createdAt: Date.now() } },
    cards: {},
    lines: {},
    settings: { userName: "Me", theme: "light", snap: false, showGrid: true },
    labels: [{ id: "lbl-video", name: "Video Editing", color: "#2bb3c0" }, { id: "lbl-design", name: "Design", color: "#8b5cf6" }],
    people: [],
  };
  const b = new Builder("home");
  const welcome = b.note(
    0,
    0,
    "<h1>Welcome 👋</h1><div>This is your visual workspace. Drag anything from the toolbar on the left onto the board.</div><ul><li><b>Click</b> a card to edit it</li><li><b>Drag</b> cards to move them, drop them into columns or onto boards</li><li><b>Scroll</b> to pan, <b>Ctrl + scroll</b> to zoom</li><li>Drop images and files straight from your desktop</li></ul>",
    { w: 340, color: "yellow" }
  );
  const todo = b.todo(420, 0, "Getting started", ["Create your first board", "Drop in an image", "Paste a YouTube link", "Connect two cards with a line", ["Read the welcome note", true]]);
  b.line(welcome, todo, { label: "then" });
  b.column(0, 360, "Ideas", [
    b.note(0, 0, "<div><b>Tip:</b> press <b>N</b> for a new note, <b>T</b> for a to-do, <b>?</b> for all shortcuts.</div>"),
    b.note(0, 0, "<div>Select a card and drag the blue dot on its edge to draw an arrow.</div>", { color: "blue" }),
  ]);
  const p1 = b.board(420, 330, "My first board", "🚀", "orange");
  const p2 = b.board(570, 330, "Inspiration", "🎨", "purple");
  void p1;
  void p2;
  b.card("link", 760, 300, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Paste any link — YouTube plays inline", siteName: "youtube.com", status: "done", image: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
  ["#4f7cff", "#f5a623", "#e25563", "#2bb39a"].forEach((c, i) => sw(b, 760 + i * 0, 0, c, "").x = 760 + i * 110);
  b.cards.filter((c) => c.type === "swatch").forEach((c) => (c.w = 100));
  b.commit(ws);
  return ws;
}
