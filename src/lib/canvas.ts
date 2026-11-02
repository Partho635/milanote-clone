"use client";
import { S, vpOf } from "./store";

// DOM references registered by <Canvas/>
export const refs: { viewport: HTMLDivElement | null; world: HTMLDivElement | null } = {
  viewport: null,
  world: null,
};

/** Live offset of cards being dragged (applied as CSS transforms, committed on drop). */
export const dragState: { ids: Set<string>; dx: number; dy: number } = { ids: new Set(), dx: 0, dy: 0 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function screenToWorld(cx: number, cy: number) {
  const vp = vpOf(S());
  const r = refs.viewport?.getBoundingClientRect() || { left: 0, top: 0 };
  return { x: (cx - r.left - vp.x) / vp.zoom, y: (cy - r.top - vp.y) / vp.zoom };
}

export function worldToScreen(x: number, y: number) {
  const vp = vpOf(S());
  const r = refs.viewport?.getBoundingClientRect() || { left: 0, top: 0 };
  return { x: x * vp.zoom + vp.x + r.left, y: y * vp.zoom + vp.y + r.top };
}

export function cardEl(id: string) {
  return refs.world?.querySelector<HTMLElement>(`[data-card-id="${id}"]`) || null;
}

/** World-space rect of a card, measured from layout offsets (unaffected by zoom transforms). */
export function cardRect(id: string): Rect | null {
  const el = cardEl(id);
  const world = refs.world;
  if (!el || !world) return null;
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== world) {
    x += node.offsetLeft;
    y += node.offsetTop;
    const cid = node.dataset?.cardId;
    if (cid && dragState.ids.has(cid)) {
      x += dragState.dx;
      y += dragState.dy;
    }
    node = node.offsetParent as HTMLElement | null;
  }
  if (node !== world) return null;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

export function viewportCenterWorld() {
  const r = refs.viewport?.getBoundingClientRect();
  if (!r) return { x: 200, y: 200 };
  return screenToWorld(r.left + r.width / 2, r.top + r.height / 2);
}

export function overViewport(cx: number, cy: number) {
  const r = refs.viewport?.getBoundingClientRect();
  return !!r && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
}

/** Finds a drop target under the pointer, ignoring cards being dragged. */
export function hitTest(cx: number, cy: number, exclude: Set<string>, allowColumn: boolean) {
  const els = document.elementsFromPoint(cx, cy) as HTMLElement[];
  for (const el of els) {
    if (el.closest("[data-trash-drop]")) return { kind: "trash" as const };
    if (el.closest("[data-unsorted-drop]")) return { kind: "unsorted" as const };
    const cardNode = el.closest<HTMLElement>("[data-card-id]");
    if (!cardNode) continue;
    const id = cardNode.dataset.cardId!;
    if (exclude.has(id)) continue;
    // ancestors: maybe a column containing this card
    const col = cardNode.dataset.cardType === "column" ? cardNode : cardNode.parentElement?.closest<HTMLElement>('[data-card-type="column"]');
    if (allowColumn && col && !exclude.has(col.dataset.cardId!)) {
      return { kind: "column" as const, id: col.dataset.cardId!, index: columnIndex(col, cy, exclude) };
    }
    if (cardNode.dataset.cardType === "board") return { kind: "board" as const, id };
    return null;
  }
  return null;
}

function columnIndex(col: HTMLElement, cy: number, exclude: Set<string>) {
  const body = col.querySelector<HTMLElement>("[data-col-body]");
  if (!body) return 0;
  let i = 0;
  for (const child of Array.from(body.children) as HTMLElement[]) {
    const id = child.dataset.cardId;
    if (!id || exclude.has(id)) continue;
    const r = child.getBoundingClientRect();
    if (r.top + r.height / 2 < cy) i++;
  }
  return i;
}
