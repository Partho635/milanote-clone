"use client";
import { S } from "./store";
import type { Card, TodoItem } from "./types";
import { LABEL_COLORS } from "./data";
import { uid } from "./utils";

/** What the toolbar's Labels / Reactions / Due / Assign act on: a todo item if one is active, else the card. */
export interface MetaTarget {
  cardId: string;
  itemId?: string;
}

export function currentTarget(): MetaTarget | null {
  const s = S();
  if (s.selection.length !== 1) return null;
  const id = s.selection[0];
  const c = s.ws.cards[id];
  if (!c) return null;
  if (c.type === "todo" && s.activeItem?.cardId === id && c.data.items?.some((i) => i.id === s.activeItem!.itemId)) {
    return { cardId: id, itemId: s.activeItem.itemId };
  }
  return { cardId: id };
}

function edit(t: MetaTarget, fn: (o: Card | TodoItem) => void) {
  S().mutate(
    (d) => {
      const c = d.cards[t.cardId];
      if (!c) return;
      if (t.itemId) {
        const it = c.data.items?.find((i) => i.id === t.itemId);
        if (it) fn(it);
      } else fn(c as Card);
      c.updatedAt = Date.now();
    },
    { history: true }
  );
}

export function readTarget(t: MetaTarget | null): { labels: string[]; reactions: Record<string, number>; due?: string; assignee?: string } {
  if (!t) return { labels: [], reactions: {} };
  const c = S().ws.cards[t.cardId];
  if (!c) return { labels: [], reactions: {} };
  const o = t.itemId ? c.data.items?.find((i) => i.id === t.itemId) : c;
  return {
    labels: o?.labels || [],
    reactions: o?.reactions || {},
    due: t.itemId ? (o as TodoItem | undefined)?.due : undefined,
    assignee: t.itemId ? (o as TodoItem | undefined)?.assignee : undefined,
  };
}

export function toggleLabel(t: MetaTarget, labelId: string) {
  edit(t, (o) => {
    const set = new Set(o.labels || []);
    if (set.has(labelId)) set.delete(labelId);
    else set.add(labelId);
    o.labels = Array.from(set);
  });
}

export function createLabel(name: string) {
  const s = S();
  const existing = s.ws.labels.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const id = uid();
  s.mutate(
    (d) => {
      d.labels.push({ id, name, color: LABEL_COLORS[d.labels.length % LABEL_COLORS.length] });
    },
    { history: true }
  );
  return id;
}

export function toggleReaction(t: MetaTarget, emoji: string, forceAdd = false) {
  edit(t, (o) => {
    const r = { ...(o.reactions || {}) };
    if (r[emoji] && !forceAdd) delete r[emoji];
    else r[emoji] = 1;
    o.reactions = r;
  });
}

export function setDue(t: MetaTarget, due: string | undefined) {
  edit(t, (o) => {
    (o as TodoItem).due = due;
  });
}

export function setAssignee(t: MetaTarget, name: string | undefined) {
  edit(t, (o) => {
    (o as TodoItem).assignee = name;
  });
  if (name)
    S().mutate((d) => {
      if (!d.people.includes(name)) d.people.push(name);
    });
}

export function dueLabel(due: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due + "T00:00:00");
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return { text: "Due today", cls: "today" };
  if (diff === 1) return { text: "Due tomorrow", cls: "soon" };
  if (diff < 0) return { text: `Overdue · ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`, cls: "overdue" };
  return { text: `Due ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`, cls: "later" };
}

export function isoDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
