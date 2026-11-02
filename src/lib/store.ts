"use client";
import { create } from "zustand";
import { produce, type Draft } from "immer";
import type { DropTarget, Modal, Viewport, Workspace } from "./types";

export interface ContextMenuState {
  x: number;
  y: number;
  kind: "card" | "canvas";
  world?: { x: number; y: number };
}

export interface Toast {
  id: string;
  text: string;
}

interface MutateOpts {
  history?: boolean;
  coalesce?: string; // group rapid edits (e.g. typing) into one undo step
}

export interface State {
  ws: Workspace;
  loaded: boolean;
  saveState: "saved" | "saving" | "error";
  currentBoardId: string;
  viewports: Record<string, Viewport>;
  selection: string[];
  selectedLines: string[];
  focusRequest: string | null;
  drawingId: string | null;
  dropTarget: DropTarget;
  marquee: { x0: number; y0: number; x1: number; y1: number } | null;
  dragging: boolean;
  tool: "select" | "hand";
  spaceDown: boolean;
  sidebarOpen: boolean;
  modal: Modal;
  contextMenu: ContextMenuState | null;
  toasts: Toast[];
  flashId: string | null;
  activeItem: { cardId: string; itemId: string } | null;
  tableSel: { cardId: string; r0: number; c0: number; r1: number; c1: number } | null;
  commentOpen: string | null;
  presenting: boolean;
  unsortedOpen: boolean;
  past: Workspace[];
  future: Workspace[];
  lastCoalesce: { key: string; t: number } | null;

  mutate: (fn: (d: Draft<Workspace>) => void, opts?: MutateOpts) => void;
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  set: (p: Partial<State>) => void;
  setViewport: (v: Partial<Viewport>, boardId?: string) => void;
  toast: (text: string) => void;
}

export const DEFAULT_VP: Viewport = { x: 0, y: 0, zoom: 1 };

export const useStore = create<State>((set, get) => ({
  ws: { version: 1, boards: {}, cards: {}, lines: {}, labels: [], people: [], settings: { userName: "Me", theme: "light", snap: false, showGrid: true } },
  loaded: false,
  saveState: "saved",
  currentBoardId: "home",
  viewports: {},
  selection: [],
  selectedLines: [],
  focusRequest: null,
  drawingId: null,
  dropTarget: null,
  marquee: null,
  dragging: false,
  tool: "select",
  spaceDown: false,
  sidebarOpen: true,
  modal: null,
  contextMenu: null,
  toasts: [],
  flashId: null,
  activeItem: null,
  tableSel: null,
  commentOpen: null,
  presenting: false,
  unsortedOpen: false,
  past: [],
  future: [],
  lastCoalesce: null,

  mutate: (fn, opts = {}) => {
    const s = get();
    const next = produce(s.ws, fn);
    if (next === s.ws) return;
    let past = s.past;
    let lastCoalesce = s.lastCoalesce;
    const now = Date.now();
    if (opts.coalesce) {
      if (!lastCoalesce || lastCoalesce.key !== opts.coalesce || now - lastCoalesce.t > 1200) {
        past = [...past.slice(-149), s.ws];
      }
      lastCoalesce = { key: opts.coalesce, t: now };
    } else if (opts.history) {
      past = [...past.slice(-149), s.ws];
      lastCoalesce = null;
    }
    set({ ws: next, past, future: opts.history || opts.coalesce ? [] : s.future, lastCoalesce });
  },
  checkpoint: () => {
    const s = get();
    set({ past: [...s.past.slice(-149), s.ws], future: [], lastCoalesce: null });
  },
  undo: () => {
    const s = get();
    if (!s.past.length) return;
    const prev = s.past[s.past.length - 1];
    set({
      ws: prev,
      past: s.past.slice(0, -1),
      future: [s.ws, ...s.future],
      lastCoalesce: null,
      selection: s.selection.filter((id) => prev.cards[id] && !prev.cards[id].deleted),
      selectedLines: s.selectedLines.filter((id) => prev.lines[id]),
    });
  },
  redo: () => {
    const s = get();
    if (!s.future.length) return;
    const next = s.future[0];
    set({
      ws: next,
      past: [...s.past, s.ws],
      future: s.future.slice(1),
      lastCoalesce: null,
      selection: s.selection.filter((id) => next.cards[id] && !next.cards[id].deleted),
      selectedLines: s.selectedLines.filter((id) => next.lines[id]),
    });
  },
  set: (p) => set(p),
  setViewport: (v, boardId) => {
    const s = get();
    const id = boardId || s.currentBoardId;
    const cur = s.viewports[id] || DEFAULT_VP;
    set({ viewports: { ...s.viewports, [id]: { ...cur, ...v } } });
  },
  toast: (text) => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { id, text }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600);
  },
}));

export const S = () => useStore.getState();
export const vpOf = (s: State) => s.viewports[s.currentBoardId] || DEFAULT_VP;
