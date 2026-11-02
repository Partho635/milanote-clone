"use client";
import type { Draft } from "immer";
import { S, useStore, vpOf, DEFAULT_VP } from "./store";
import type { Board, Card, CardData, CardType, Line, Workspace } from "./types";
import { cardRect, refs, screenToWorld, viewportCenterWorld } from "./canvas";
import { BOARD_ICONS, PALETTE, cardText, clamp, htmlToText, uid } from "./utils";
import { resolveUrl, shareableUrl, storeFile } from "./storage";

/* ---------------- defaults ---------------- */

export function defaultsFor(type: CardType): { w: number; h?: number; data: CardData } {
  switch (type) {
    case "note":
      return { w: 260, data: { html: "" } };
    case "todo":
      return { w: 260, data: { title: "", showTitle: false, items: [{ id: uid(), text: "", done: false }] } };
    case "link":
      return { w: 300, data: { url: "", status: "idle" } };
    case "image":
      return { w: 300, data: { url: "", caption: "" } };
    case "file":
      return { w: 260, data: { url: "", name: "file" } };
    case "board":
      return { w: 128, data: {} };
    case "column":
      return { w: 300, data: { title: "", collapsed: false } };
    case "comment":
      return { w: 280, data: { comments: [] } };
    case "sketch":
      return { w: 340, h: 260, data: { strokes: [], vbW: 340, vbH: 260 } };
    case "swatch":
      return { w: 150, data: { color: "#f5a623", name: "" } };
    case "table":
      return { w: 380, data: { cells: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ v: "" }))) } };
    case "document":
      return { w: 150, data: { title: "", html: "", cardView: false } };
    case "heading":
      return { w: 320, data: { html: "", hsize: "l" } };
    case "map":
      return { w: 320, h: 240, data: { query: "" } };
  }
}

export function topZ(ws: Workspace, boardId: string) {
  let z = 0;
  for (const c of Object.values(ws.cards)) if (c.boardId === boardId && c.z > z) z = c.z;
  return z + 1;
}

export function columnChildren(ws: Workspace, colId: string) {
  return Object.values(ws.cards)
    .filter((c) => c.parentId === colId && !c.deleted)
    .sort((a, b) => a.order - b.order);
}

function reorderColumn(d: Draft<Workspace>, colId: string, insertIds: string[], index: number) {
  const siblings = Object.values(d.cards)
    .filter((c) => c.parentId === colId && !c.deleted && !insertIds.includes(c.id))
    .sort((a, b) => a.order - b.order)
    .map((c) => c.id);
  const i = clamp(index, 0, siblings.length);
  siblings.splice(i, 0, ...insertIds);
  siblings.forEach((id, k) => {
    d.cards[id].order = k;
    d.cards[id].parentId = colId;
  });
}

export interface CreateOpts {
  parentId?: string | null;
  index?: number;
  data?: Partial<CardData>;
  color?: string;
  focus?: boolean;
  select?: boolean;
  w?: number;
  h?: number;
  boardTitle?: string;
  boardId?: string;
  topLeft?: boolean;
}

/** Create a card. `at` is a world point (centre of the card unless topLeft). */
export function createCard(type: CardType, at?: { x: number; y: number }, opts: CreateOpts = {}) {
  const s = S();
  const boardId = opts.boardId || s.currentBoardId;
  const def = defaultsFor(type);
  const w = opts.w ?? def.w;
  const h = opts.h ?? def.h;
  const p = at || freeSpot(type);
  const id = uid();
  const now = Date.now();
  const snap = s.ws.settings.snap;
  let x = opts.topLeft ? p.x : p.x - w / 2;
  let y = opts.topLeft ? p.y : p.y - 24;
  if (snap) {
    x = Math.round(x / 20) * 20;
    y = Math.round(y / 20) * 20;
  }
  s.mutate(
    (d) => {
      const data: CardData = { ...def.data, ...(opts.data || {}) };
      if (type === "board") {
        const bid = uid();
        d.boards[bid] = {
          id: bid,
          title: opts.boardTitle ?? "New board",
          icon: BOARD_ICONS[Math.floor(Math.random() * 8)],
          createdAt: now,
        };
        data.boardId = bid;
      }
      d.cards[id] = {
        id,
        type,
        boardId,
        parentId: null,
        order: 0,
        x,
        y,
        w,
        h,
        z: topZ(d as Workspace, boardId),
        color: opts.color || (type === "board" ? ["default", "orange", "teal", "purple", "pink", "red"][Math.floor(Math.random() * 6)] : "default"),
        data,
        createdAt: now,
        updatedAt: now,
      };
      if (opts.parentId) reorderColumn(d, opts.parentId, [id], opts.index ?? 9999);
    },
    { history: true }
  );
  if (opts.select !== false) s.set({ selection: [id], selectedLines: [] });
  if (opts.focus) s.set({ focusRequest: id });
  if (type === "sketch" && opts.focus) s.set({ drawingId: id, focusRequest: null });
  return id;
}

export function updateCard(id: string, patch: Partial<CardData>, coalesce?: string) {
  S().mutate(
    (d) => {
      const c = d.cards[id];
      if (!c) return;
      Object.assign(c.data, patch);
      c.updatedAt = Date.now();
    },
    coalesce ? { coalesce } : { history: true }
  );
}

export function patchCard(id: string, patch: Partial<Card>, history = true) {
  S().mutate(
    (d) => {
      const c = d.cards[id];
      if (c) Object.assign(c, patch);
    },
    { history }
  );
}

export function renameBoard(boardId: string, title: string) {
  S().mutate(
    (d) => {
      if (d.boards[boardId]) d.boards[boardId].title = title;
    },
    { coalesce: "board-title-" + boardId }
  );
}

/** Find an empty spot near the centre of the view for a new card (returns the card's centre-top anchor). */
export function freeSpot(type?: string) {
  const s = S();
  const c = viewportCenterWorld();
  const w = (type && type in { note: 1, todo: 1, link: 1, column: 1, comment: 1, table: 1, sketch: 1, swatch: 1, document: 1, board: 1, image: 1, file: 1 }
    ? defaultsFor(type as CardType).w
    : 260) + 24;
  const def = type && type in { sketch: 1, map: 1, table: 1, image: 1 } ? defaultsFor(type as CardType) : null;
  const h = def?.h ? def.h + 50 : type === "table" ? 190 : type === "image" ? 230 : 150;
  const rects = Object.values(s.ws.cards)
    .filter((x) => x.boardId === s.currentBoardId && !x.deleted && !x.parentId)
    .map((x) => cardRect(x.id))
    .filter(Boolean) as { x: number; y: number; w: number; h: number }[];
  const free = (px: number, py: number) => {
    const rx = px - w / 2, ry = py - 40;
    return !rects.some((r) => rx < r.x + r.w && rx + w > r.x && ry < r.y + r.h && ry + h > r.y);
  };
  const step = 40;
  for (let ring = 0; ring < 25; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
        const px = c.x + dx * step, py = c.y - 60 + dy * step;
        if (free(px, py)) return { x: px, y: py };
      }
    }
  }
  return { x: c.x, y: c.y - 60 };
}

/* ---------------- navigation ---------------- */

export function boardCardOf(ws: Workspace, boardId: string) {
  return Object.values(ws.cards).find((c) => c.type === "board" && c.data.boardId === boardId);
}

export function boardPath(ws: Workspace, boardId: string): Board[] {
  const out: Board[] = [];
  let cur: string | undefined = boardId;
  const seen = new Set<string>();
  while (cur && ws.boards[cur] && !seen.has(cur)) {
    seen.add(cur);
    out.unshift(ws.boards[cur]);
    if (cur === "home") break;
    const card = boardCardOf(ws, cur);
    cur = card?.boardId;
  }
  if (out[0]?.id !== "home" && ws.boards.home) out.unshift(ws.boards.home);
  return out;
}

export function navigate(boardId: string, pushHash = true) {
  const s = S();
  if (!s.ws.boards[boardId]) boardId = "home";
  s.set({ currentBoardId: boardId, selection: [], selectedLines: [], drawingId: null, contextMenu: null, marquee: null });
  if (pushHash && typeof window !== "undefined") {
    const h = boardId === "home" ? "#/" : `#/b/${boardId}`;
    if (location.hash !== h) history.pushState(null, "", h);
  }
  if (!s.viewports[boardId]) {
    const has = Object.values(s.ws.cards).some((c) => c.boardId === boardId && !c.deleted);
    s.setViewport({ x: 80, y: 60, zoom: 1 }, boardId);
    if (has) requestAnimationFrame(() => requestAnimationFrame(() => zoomToFit(1)));
  }
}

export function itemCount(ws: Workspace, boardId: string) {
  let n = 0;
  for (const c of Object.values(ws.cards)) if (c.boardId === boardId && !c.deleted && !c.parentId && c.type !== "column") n++;
  for (const c of Object.values(ws.cards)) if (c.parentId && c.boardId === boardId && !c.deleted && ws.cards[c.parentId] && !ws.cards[c.parentId].deleted) n++;
  return n;
}

/* ---------------- viewport ---------------- */

let vpAnim = 0;
export function cancelViewportAnim() {
  cancelAnimationFrame(vpAnim);
  vpAnim = 0;
}
/** Smoothly animate the viewport (ease-out cubic). */
export function animateViewport(to: { x: number; y: number; zoom: number }, ms = 260) {
  cancelViewportAnim();
  const from = vpOf(S());
  const t0 = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    const e = ease(t);
    S().setViewport({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, zoom: from.zoom * Math.pow(to.zoom / from.zoom, e) });
    vpAnim = t < 1 ? requestAnimationFrame(step) : 0;
  };
  vpAnim = requestAnimationFrame(step);
}

export function zoomTo(zoom: number, screenPt?: { x: number; y: number }, animate = false) {
  const s = S();
  const vp = vpOf(s);
  const r = refs.viewport?.getBoundingClientRect();
  if (!r) return;
  const pt = screenPt || { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const z = clamp(zoom, 0.1, 4);
  const wx = (pt.x - r.left - vp.x) / vp.zoom;
  const wy = (pt.y - r.top - vp.y) / vp.zoom;
  const target = { zoom: z, x: pt.x - r.left - wx * z, y: pt.y - r.top - wy * z };
  if (animate) animateViewport(target, 200);
  else {
    if (vpAnim) cancelViewportAnim();
    s.setViewport(target);
  }
}

export function zoomBy(f: number) {
  // chain from the animation target if one is running
  zoomTo(vpOf(S()).zoom * f, undefined, true);
}

export function boardBounds() {
  const s = S();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of Object.values(s.ws.cards)) {
    if (c.boardId !== s.currentBoardId || c.deleted || c.parentId || c.unsorted) continue;
    const r = cardRect(c.id) || { x: c.x, y: c.y, w: c.w, h: c.h || 120 };
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  for (const l of Object.values(s.ws.lines)) {
    if (l.boardId !== s.currentBoardId) continue;
    for (const e of [l.from, l.to])
      if (!e.cardId) {
        minX = Math.min(minX, e.x);
        minY = Math.min(minY, e.y);
        maxX = Math.max(maxX, e.x);
        maxY = Math.max(maxY, e.y);
      }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function zoomToFit(maxZoom = 1.5) {
  const b = boardBounds();
  const r = refs.viewport?.getBoundingClientRect();
  if (!r) return;
  if (!b) {
    S().setViewport({ x: 80, y: 60, zoom: 1 });
    return;
  }
  const pad = 80;
  const z = clamp(Math.min((r.width - pad * 2) / Math.max(b.w, 1), (r.height - pad * 2) / Math.max(b.h, 1)), 0.1, maxZoom);
  animateViewport({ zoom: z, x: (r.width - b.w * z) / 2 - b.x * z, y: (r.height - b.h * z) / 2 - b.y * z }, 320);
}

export function focusCard(id: string) {
  const s = S();
  const c = s.ws.cards[id];
  if (!c) return;
  if (c.boardId !== s.currentBoardId) navigate(c.boardId);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const r = cardRect(id) || { x: c.x, y: c.y, w: c.w, h: 100 };
      const vr = refs.viewport?.getBoundingClientRect();
      if (!vr) return;
      const z = Math.max(vpOf(S()).zoom, 0.8);
      animateViewport({ zoom: z, x: vr.width / 2 - (r.x + r.w / 2) * z, y: vr.height / 2 - (r.y + r.h / 2) * z }, 380);
      S().set({ selection: [id], flashId: id });
      setTimeout(() => S().set({ flashId: null }), 1400);
    })
  );
}

/* ---------------- selection ops ---------------- */

export function deleteSelection() {
  const s = S();
  const ids = s.selection;
  const lines = s.selectedLines;
  if (!ids.length && !lines.length) return;
  s.mutate(
    (d) => {
      const now = Date.now();
      for (const id of ids) {
        const c = d.cards[id];
        if (c) {
          c.deleted = true;
          c.deletedAt = now;
        }
      }
      for (const id of lines) delete d.lines[id];
    },
    { history: true }
  );
  s.set({ selection: [], selectedLines: [] });
  if (ids.length) s.toast(`${ids.length} item${ids.length > 1 ? "s" : ""} moved to trash`);
}

export function setColor(ids: string[], color: string) {
  S().mutate(
    (d) => {
      for (const id of ids) if (d.cards[id]) d.cards[id].color = color;
    },
    { history: true }
  );
}

export function bringToFront(ids: string[]) {
  S().mutate(
    (d) => {
      const s = S();
      let z = topZ(d as Workspace, s.currentBoardId);
      for (const id of ids) if (d.cards[id]) d.cards[id].z = z++;
    },
    { history: true }
  );
}
export function sendToBack(ids: string[]) {
  S().mutate(
    (d) => {
      let min = Infinity;
      for (const c of Object.values(d.cards)) if (c.boardId === S().currentBoardId) min = Math.min(min, c.z);
      let z = min - ids.length;
      for (const id of ids) if (d.cards[id]) d.cards[id].z = z++;
    },
    { history: true }
  );
}

export function alignSelection(kind: "left" | "top" | "hcenter" | "vcenter" | "distH" | "distV") {
  const s = S();
  const ids = s.selection.filter((id) => !s.ws.cards[id]?.parentId);
  if (ids.length < 2) return;
  const rects = ids.map((id) => ({ id, r: cardRect(id)! })).filter((x) => x.r);
  s.mutate(
    (d) => {
      if (kind === "left") {
        const m = Math.min(...rects.map((x) => x.r.x));
        rects.forEach((x) => (d.cards[x.id].x = m));
      } else if (kind === "top") {
        const m = Math.min(...rects.map((x) => x.r.y));
        rects.forEach((x) => (d.cards[x.id].y = m));
      } else if (kind === "hcenter") {
        const m = rects.reduce((a, x) => a + x.r.x + x.r.w / 2, 0) / rects.length;
        rects.forEach((x) => (d.cards[x.id].x = m - x.r.w / 2));
      } else if (kind === "vcenter") {
        const m = rects.reduce((a, x) => a + x.r.y + x.r.h / 2, 0) / rects.length;
        rects.forEach((x) => (d.cards[x.id].y = m - x.r.h / 2));
      } else if (kind === "distH") {
        const sorted = [...rects].sort((a, b) => a.r.x - b.r.x);
        const total = sorted.reduce((a, x) => a + x.r.w, 0);
        const span = sorted[sorted.length - 1].r.x + sorted[sorted.length - 1].r.w - sorted[0].r.x;
        const gap = Math.max(16, (span - total) / (sorted.length - 1));
        let x = sorted[0].r.x;
        sorted.forEach((it) => {
          d.cards[it.id].x = x;
          x += it.r.w + gap;
        });
      } else if (kind === "distV") {
        const sorted = [...rects].sort((a, b) => a.r.y - b.r.y);
        const total = sorted.reduce((a, x) => a + x.r.h, 0);
        const span = sorted[sorted.length - 1].r.y + sorted[sorted.length - 1].r.h - sorted[0].r.y;
        const gap = Math.max(16, (span - total) / (sorted.length - 1));
        let y = sorted[0].r.y;
        sorted.forEach((it) => {
          d.cards[it.id].y = y;
          y += it.r.h + gap;
        });
      }
    },
    { history: true }
  );
}

/* ---------------- cloning / clipboard ---------------- */

export interface ClipPayload {
  kind: "milanote-clone";
  cards: Card[];
  lines: Line[];
  boards: Record<string, Board>;
  nested: Card[]; // contents of copied boards (recursive)
  nestedLines: Line[];
}

const CLIP_PREFIX = "milanote-clone:";
let memoryClip: ClipPayload | null = null;

function collectBoardContents(ws: Workspace, boardId: string, out: ClipPayload, seen: Set<string>) {
  if (seen.has(boardId)) return;
  seen.add(boardId);
  if (ws.boards[boardId]) out.boards[boardId] = ws.boards[boardId];
  for (const c of Object.values(ws.cards)) {
    if (c.boardId !== boardId || c.deleted) continue;
    out.nested.push(c);
    if (c.type === "board" && c.data.boardId) collectBoardContents(ws, c.data.boardId, out, seen);
  }
  for (const l of Object.values(ws.lines)) if (l.boardId === boardId) out.nestedLines.push(l);
}

export function buildPayload(ids: string[]): ClipPayload {
  const ws = S().ws;
  const out: ClipPayload = { kind: "milanote-clone", cards: [], lines: [], boards: {}, nested: [], nestedLines: [] };
  const set = new Set(ids);
  // include column children
  for (const c of Object.values(ws.cards)) if (c.parentId && set.has(c.parentId) && !c.deleted) set.add(c.id);
  const seen = new Set<string>();
  for (const id of set) {
    const c = ws.cards[id];
    if (!c) continue;
    let copy = c;
    if (c.parentId && !set.has(c.parentId)) {
      const r = cardRect(c.id);
      copy = { ...c, parentId: null, x: r?.x ?? c.x, y: r?.y ?? c.y, w: r?.w ?? c.w };
    }
    out.cards.push(copy);
    if (c.type === "board" && c.data.boardId) collectBoardContents(ws, c.data.boardId, out, seen);
  }
  for (const l of Object.values(ws.lines)) {
    const a = l.from.cardId, b = l.to.cardId;
    if ((a ? set.has(a) : true) && (b ? set.has(b) : true) && (a || b) && l.boardId === S().currentBoardId) out.lines.push(l);
  }
  for (const id of S().selectedLines) {
    const l = ws.lines[id];
    if (l && !out.lines.includes(l)) out.lines.push(l);
  }
  return JSON.parse(JSON.stringify(out));
}

/** Insert a payload into the target board, offset by dx/dy. Returns new top-level ids. */
export function insertPayload(p: ClipPayload, targetBoard: string, dx: number, dy: number, renameBoards = false) {
  const newTop: string[] = [];
  const newLines: string[] = [];
  S().mutate(
    (d) => {
      const idMap: Record<string, string> = {};
      const boardMap: Record<string, string> = {};
      for (const bid of Object.keys(p.boards)) boardMap[bid] = uid();
      const all = [...p.cards, ...p.nested];
      for (const c of all) idMap[c.id] = uid();
      let z = topZ(d as Workspace, targetBoard);
      const now = Date.now();
      for (const [old, nid] of Object.entries(boardMap)) {
        const b = p.boards[old];
        d.boards[nid] = { ...b, id: nid, title: renameBoards && p.cards.some((c) => c.data.boardId === old) ? b.title + " copy" : b.title, createdAt: now };
      }
      const place = (c: Card, top: boolean) => {
        const n: Card = JSON.parse(JSON.stringify(c));
        n.id = idMap[c.id];
        n.createdAt = now;
        n.updatedAt = now;
        delete n.deleted;
        delete n.deletedAt;
        if (top) {
          n.boardId = targetBoard;
          if (n.parentId && idMap[n.parentId]) n.parentId = idMap[n.parentId];
          else if (n.parentId && d.cards[n.parentId] && d.cards[n.parentId].boardId === targetBoard) n.order += 0.5;
          else n.parentId = null;
          if (!n.parentId) {
            n.x += dx;
            n.y += dy;
            n.z = z++;
            newTop.push(n.id);
          }
        } else {
          n.boardId = boardMap[c.boardId] || c.boardId;
          if (n.parentId) n.parentId = idMap[n.parentId] || null;
        }
        if (n.type === "board" && n.data.boardId) {
          if (boardMap[n.data.boardId]) n.data.boardId = boardMap[n.data.boardId];
          else {
            const nb = uid();
            d.boards[nb] = { id: nb, title: "Board", icon: "📁", createdAt: now };
            n.data.boardId = nb;
          }
        }
        d.cards[n.id] = n;
      };
      for (const c of p.cards) place(c, true);
      for (const c of p.nested) place(c, false);
      const mapEnd = (e: Line["from"], shift: boolean) =>
        e.cardId ? { cardId: idMap[e.cardId] || null, x: e.x + (shift ? dx : 0), y: e.y + (shift ? dy : 0) } : { cardId: null, x: e.x + (shift ? dx : 0), y: e.y + (shift ? dy : 0) };
      for (const l of p.lines) {
        const id = uid();
        d.lines[id] = { ...l, id, boardId: targetBoard, from: mapEnd(l.from, true), to: mapEnd(l.to, true) };
        newLines.push(id);
      }
      for (const l of p.nestedLines) {
        const id = uid();
        d.lines[id] = { ...l, id, boardId: boardMap[l.boardId] || l.boardId, from: mapEnd(l.from, false), to: mapEnd(l.to, false) };
      }
    },
    { history: true }
  );
  S().set({ selection: newTop, selectedLines: newLines });
  return newTop;
}

export function duplicateSelection() {
  const s = S();
  if (!s.selection.length) return;
  insertPayload(buildPayload(s.selection), s.currentBoardId, 24, 24, true);
}

export async function copySelection(cut = false) {
  const s = S();
  if (!s.selection.length && !s.selectedLines.length) return;
  const p = buildPayload(s.selection);
  memoryClip = p;
  try {
    await navigator.clipboard.writeText(CLIP_PREFIX + JSON.stringify(p));
  } catch {}
  if (cut) deleteSelection();
  else s.toast("Copied");
}

export function tryPasteText(text: string): boolean {
  let p: ClipPayload | null = null;
  if (text.startsWith(CLIP_PREFIX)) {
    try {
      p = JSON.parse(text.slice(CLIP_PREFIX.length));
    } catch {}
  } else if (!text && memoryClip) p = memoryClip;
  if (!p) return false;
  pastePayload(p);
  return true;
}

export function pastePayload(p: ClipPayload) {
  const s = S();
  const tops = p.cards.filter((c) => !c.parentId);
  const minX = Math.min(...tops.map((c) => c.x), Infinity);
  const minY = Math.min(...tops.map((c) => c.y), Infinity);
  const c = viewportCenterWorld();
  const sameBoard = p.cards.every((x) => x.boardId === s.currentBoardId);
  const dx = sameBoard ? 32 : isFinite(minX) ? c.x - minX - 100 : 0;
  const dy = sameBoard ? 32 : isFinite(minY) ? c.y - minY - 60 : 0;
  insertPayload(p, s.currentBoardId, dx, dy);
}

/* ---------------- moving ---------------- */

export function moveCardsToBoard(ids: string[], targetBoard: string) {
  const s = S();
  if (!ids.length) return;
  // prevent moving a board into itself or its descendants
  const forbidden = new Set<string>();
  const walk = (bid: string) => {
    forbidden.add(bid);
    for (const c of Object.values(s.ws.cards)) if (c.boardId === bid && c.type === "board" && c.data.boardId) walk(c.data.boardId);
  };
  for (const id of ids) {
    const c = s.ws.cards[id];
    if (c?.type === "board" && c.data.boardId) walk(c.data.boardId);
  }
  if (forbidden.has(targetBoard)) {
    s.toast("Can't move a board inside itself");
    return;
  }
  const rects = Object.fromEntries(ids.map((id) => [id, cardRect(id)]));
  const tops = ids.map((id) => rects[id] || { x: s.ws.cards[id].x, y: s.ws.cards[id].y });
  const minX = Math.min(...tops.map((r) => r.x));
  const minY = Math.min(...tops.map((r) => r.y));
  const set = new Set(ids);
  s.mutate(
    (d) => {
      let z = topZ(d as Workspace, targetBoard);
      // place after existing content in the target board
      let maxY = 40;
      for (const c of Object.values(d.cards)) if (c.boardId === targetBoard && !c.deleted && !c.parentId) maxY = Math.max(maxY, c.y + 200);
      const hasContent = Object.values(d.cards).some((c) => c.boardId === targetBoard && !c.deleted);
      for (const id of ids) {
        const c = d.cards[id];
        const r = rects[id] || { x: c.x, y: c.y };
        c.boardId = targetBoard;
        c.parentId = null;
        c.x = 40 + (r.x - minX);
        c.y = (hasContent ? maxY : 40) + (r.y - minY);
        c.z = z++;
        // children of moved columns follow
        for (const ch of Object.values(d.cards)) if (ch.parentId === id) ch.boardId = targetBoard;
      }
      for (const l of Object.values(d.lines)) {
        const a = l.from.cardId && set.has(l.from.cardId);
        const b = l.to.cardId && set.has(l.to.cardId);
        if (a && b) {
          l.boardId = targetBoard;
        } else if (a || b) {
          delete d.lines[l.id];
        }
      }
    },
    { history: true }
  );
  s.set({ selection: [] });
  const title = s.ws.boards[targetBoard]?.title || "board";
  s.toast(`Moved ${ids.length} item${ids.length > 1 ? "s" : ""} to “${title}”`);
}

export function dropIntoColumn(ids: string[], colId: string, index: number) {
  S().mutate((d) => {
    const valid = ids.filter((id) => d.cards[id] && d.cards[id].type !== "column" && id !== colId);
    reorderColumn(d, colId, valid, index);
  });
}

/* ---------------- trash ---------------- */

export function restoreCard(id: string) {
  const s = S();
  s.mutate(
    (d) => {
      const c = d.cards[id];
      if (!c) return;
      c.deleted = false;
      delete c.deletedAt;
      if (!d.boards[c.boardId]) {
        c.boardId = "home";
        c.parentId = null;
      }
      if (c.parentId && (!d.cards[c.parentId] || d.cards[c.parentId].deleted)) {
        c.parentId = null;
      }
    },
    { history: true }
  );
  s.toast("Restored");
}

function purgeInto(d: Draft<Workspace>, id: string) {
  const c = d.cards[id];
  if (!c) return;
  if (c.type === "board" && c.data.boardId) {
    const bid = c.data.boardId;
    for (const x of Object.values(d.cards)) if (x.boardId === bid) purgeInto(d, x.id);
    for (const l of Object.values(d.lines)) if (l.boardId === bid) delete d.lines[l.id];
    delete d.boards[bid];
  }
  for (const x of Object.values(d.cards)) if (x.parentId === id) delete d.cards[x.id];
  for (const l of Object.values(d.lines)) if (l.from.cardId === id || l.to.cardId === id) delete d.lines[l.id];
  delete d.cards[id];
}

export function purgeCard(id: string) {
  S().mutate((d) => purgeInto(d, id), { history: true });
}

export function trashedCards(ws: Workspace) {
  return Object.values(ws.cards)
    .filter((c) => c.deleted && !(c.parentId && ws.cards[c.parentId]?.deleted))
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
}

export function emptyTrash() {
  const ids = trashedCards(S().ws).map((c) => c.id);
  S().mutate(
    (d) => {
      for (const id of ids) purgeInto(d, id);
    },
    { history: true }
  );
}

/* ---------------- uploads ---------------- */

function imageDims(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((res) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      res({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => res(null);
    img.src = url;
  });
}

export async function uploadFiles(files: File[], at?: { x: number; y: number }, parentId?: string | null, index?: number) {
  const s = S();
  if (!files.length) return;
  s.toast(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`);
  const base = at || freeSpot("image");
  const ids: string[] = [];
  let i = 0;
  let offsetX = 0;
  for (const file of files) {
    const isImage = /^image\/(png|jpe?g|gif|webp|svg\+xml|avif|bmp)$/.test(file.type);
    const dims = isImage ? await imageDims(file) : null;
    try {
      const j = await storeFile(file);
      const w = isImage && dims ? clamp(dims.w, 160, 360) : 260;
      const pos = { x: base.x - 130 + offsetX, y: base.y - 24 };
      const id = createCard(isImage ? "image" : "file", pos, {
        parentId: parentId || null,
        index: index !== undefined ? index + i : undefined,
        w,
        topLeft: true,
        data: isImage
          ? { url: j.url, natW: dims?.w, natH: dims?.h, name: j.name, caption: "" }
          : { url: j.url, name: j.name, size: j.size, mime: j.type },
        select: false,
      });
      ids.push(id);
      offsetX += w + 24;
      i++;
    } catch {
      s.toast(`Upload failed: ${file.name}`);
    }
  }
  s.set({ selection: ids });
}

let pendingPick: { at?: { x: number; y: number }; parentId?: string | null; index?: number } = {};
export function openFilePicker(accept: string, at?: { x: number; y: number }, parentId?: string | null, index?: number) {
  pendingPick = { at, parentId, index };
  const input = document.getElementById("global-file-input") as HTMLInputElement | null;
  if (!input) return;
  input.accept = accept;
  input.value = "";
  input.click();
}
export function onFilesPicked(files: File[]) {
  uploadFiles(files, pendingPick.at, pendingPick.parentId, pendingPick.index);
  pendingPick = {};
}

/* ---------------- lines ---------------- */

export function createLine(from: Line["from"], to: Line["to"], select = true) {
  const id = uid();
  const s = S();
  s.mutate(
    (d) => {
      d.lines[id] = {
        id,
        boardId: s.currentBoardId,
        from,
        to,
        cx: 0,
        cy: 0,
        color: "#5b6573",
        width: 2,
        dashed: false,
        arrowStart: false,
        arrowEnd: true,
        label: "",
      };
    },
    { history: true }
  );
  if (select) s.set({ selectedLines: [id], selection: [] });
  return id;
}

export function patchLine(id: string, patch: Partial<Line>, coalesce?: string) {
  S().mutate(
    (d) => {
      if (d.lines[id]) Object.assign(d.lines[id], patch);
    },
    coalesce ? { coalesce } : { history: true }
  );
}

/* ---------------- export / import ---------------- */

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const slug = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "board";

export async function exportPNG() {
  const s = S();
  const b = boardBounds();
  const world = refs.world;
  if (!b || !world) {
    s.toast("Nothing to export");
    return;
  }
  s.toast("Rendering image…");
  s.set({ selection: [], selectedLines: [] });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const { toPng } = await import("html-to-image");
  const pad = 48;
  const dark = s.ws.settings.theme === "dark";
  try {
    const url = await toPng(world, {
      width: b.w + pad * 2,
      height: b.h + pad * 2,
      pixelRatio: 2,
      backgroundColor: dark ? "#1b1d21" : "#f4f3ef",
      style: { transform: `translate(${-b.x + pad}px, ${-b.y + pad}px)`, transformOrigin: "0 0" },
      imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      skipFonts: true,
      filter: (n) =>
        !(n instanceof HTMLElement && n.classList.contains("no-export")) &&
        !(n instanceof HTMLImageElement && (!n.complete || n.naturalWidth === 0)) &&
        !(n instanceof HTMLIFrameElement),
    });
    download(slug(s.ws.boards[s.currentBoardId]?.title || "board") + ".png", url);
  } catch (e) {
    console.error(e);
    s.toast("Export failed");
  }
}

export function exportJSON() {
  const ws = S().ws;
  const blob = new Blob([JSON.stringify(ws, null, 2)], { type: "application/json" });
  download(`milanote-clone-backup-${new Date().toISOString().slice(0, 10)}.json`, URL.createObjectURL(blob));
}

export async function importJSON(file: File) {
  const s = S();
  try {
    const ws = JSON.parse(await file.text()) as Workspace;
    if (!ws.boards || !ws.cards || !ws.boards.home) throw new Error();
    ws.lines ||= {};
    ws.settings = { ...s.ws.settings, ...(ws.settings || {}) };
    s.mutate(() => ws, { history: true });
    navigate("home");
    s.toast("Workspace imported");
  } catch {
    s.toast("That file is not a valid backup");
  }
}

export function exportMarkdown() {
  const s = S();
  const ws = s.ws;
  const bid = s.currentBoardId;
  const lines: string[] = [`# ${ws.boards[bid]?.title || "Board"}`, ""];
  const render = (c: Card, depth: number) => {
    const pre = "  ".repeat(depth);
    const d = c.data;
    switch (c.type) {
      case "note":
        lines.push(htmlToText(d.html).split("\n").map((l) => pre + l).join("\n"), "");
        break;
      case "todo":
        if (d.title) lines.push(`${pre}**${d.title}**`);
        for (const it of d.items || []) lines.push(`${pre}- [${it.done ? "x" : " "}] ${it.text}`);
        lines.push("");
        break;
      case "link":
        lines.push(`${pre}[${d.title || d.url}](${d.url})`, "");
        break;
      case "image":
        lines.push(`${pre}![${d.caption || d.name || "image"}](${shareableUrl(d.url)})`, "");
        break;
      case "file":
        lines.push(`${pre}📎 [${d.name}](${shareableUrl(d.url)})`, "");
        break;
      case "board":
        lines.push(`${pre}📁 **${ws.boards[d.boardId!]?.title || "Board"}**`, "");
        break;
      case "column":
        lines.push(`${pre}## ${d.title || "Untitled column"}`, "");
        for (const ch of columnChildren(ws, c.id)) render(ch, depth);
        break;
      case "document":
        lines.push(`${pre}### ${d.title || "Untitled document"}`, htmlToText(d.html), "");
        break;
      default:
        lines.push(pre + cardText(c, ""), "");
    }
  };
  const tops = Object.values(ws.cards)
    .filter((c) => c.boardId === bid && !c.deleted && !c.parentId)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of tops) render(c, 0);
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  download(slug(ws.boards[bid]?.title || "board") + ".md", URL.createObjectURL(blob));
}

export function resetViewport() {
  S().setViewport({ ...DEFAULT_VP, x: 80, y: 60 });
}

export const paletteKeys = PALETTE.map((p) => p.key);
export { useStore };

export function screenPointToWorld(e: { clientX: number; clientY: number }) {
  return screenToWorld(e.clientX, e.clientY);
}

/* ---------------- Milanote-style card operations ---------------- */

export function toggleLock(ids: string[]) {
  const s = S();
  const lock = !ids.every((id) => s.ws.cards[id]?.locked);
  s.mutate(
    (d) => {
      for (const id of ids) if (d.cards[id]) d.cards[id].locked = lock;
    },
    { history: true }
  );
  s.toast(lock ? "Position locked" : "Position unlocked");
}

export function sendToUnsorted(ids: string[]) {
  const s = S();
  s.mutate(
    (d) => {
      for (const id of ids) {
        const c = d.cards[id];
        if (!c || c.type === "column") continue;
        c.unsorted = true;
        c.parentId = null;
      }
    },
    { history: true }
  );
  s.set({ selection: [], unsortedOpen: true });
}

/** Turns a column into a board: its cards land in the new board's Unsorted drawer (like Milanote). */
export function convertColumnToBoard(colId: string) {
  const s = S();
  const col = s.ws.cards[colId];
  if (!col || col.type !== "column") return;
  const bid = uid();
  const now = Date.now();
  s.mutate(
    (d) => {
      d.boards[bid] = { id: bid, title: col.data.title || "New board", icon: BOARD_ICONS[Math.floor(Math.random() * BOARD_ICONS.length)], createdAt: now };
      const kids = Object.values(d.cards)
        .filter((c) => c.parentId === colId && !c.deleted)
        .sort((a, b) => a.order - b.order);
      kids.forEach((k, i) => {
        k.parentId = null;
        k.boardId = bid;
        k.unsorted = true;
        k.order = i;
        k.x = 60;
        k.y = 60 + i * 140;
      });
      const c = d.cards[colId];
      c.type = "board";
      c.w = 128;
      c.data = { boardId: bid };
    },
    { history: true }
  );
  s.toast("Column converted to a board");
}

export function unsortedCards(ws: Workspace, boardId: string) {
  return Object.values(ws.cards)
    .filter((c) => c.boardId === boardId && c.unsorted && !c.deleted)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function viewportCenterWorldSafe() {
  return freeSpot("image");
}

/** Create an image card for a file that is already stored on the server. */
export async function createImageCardFromUrl(url: string, name?: string, at?: { x: number; y: number }) {
  const dims = await new Promise<{ w: number; h: number } | null>((res) => {
    const img = new window.Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res(null);
    resolveUrl(url).then((u) => (img.src = u));
  });
  const w = dims ? clamp(dims.w, 160, 360) : 300;
  return createCard("image", at || freeSpot("image"), { w, data: { url, natW: dims?.w, natH: dims?.h, name, caption: "" } });
}
