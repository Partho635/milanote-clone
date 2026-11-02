import type { Card } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const PALETTE: { key: string; label: string; swatch: string }[] = [
  { key: "default", label: "Default", swatch: "#ffffff" },
  { key: "yellow", label: "Yellow", swatch: "#fff1a8" },
  { key: "orange", label: "Orange", swatch: "#ffd8a8" },
  { key: "red", label: "Red", swatch: "#ffc4c4" },
  { key: "pink", label: "Pink", swatch: "#fcc8e6" },
  { key: "purple", label: "Purple", swatch: "#dcccff" },
  { key: "blue", label: "Blue", swatch: "#c4ddff" },
  { key: "teal", label: "Teal", swatch: "#b8eee4" },
  { key: "green", label: "Green", swatch: "#c9efc0" },
  { key: "gray", label: "Gray", swatch: "#dfe2e6" },
  { key: "dark", label: "Dark", swatch: "#2f3437" },
];

export const BOARD_COLORS = ["#4f7cff", "#f5a623", "#e25563", "#2bb39a", "#8b5cf6", "#ec4899", "#0ea5e9", "#22c55e", "#64748b"];
export const BOARD_TILE: Record<string, string> = {
  default: "#4f7cff", yellow: "#f2c200", orange: "#f5a623", red: "#e25563", pink: "#ec4899",
  purple: "#8b5cf6", blue: "#0ea5e9", teal: "#2bb39a", green: "#22c55e", gray: "#64748b", dark: "#2f3437",
};
export const BOARD_ICONS = ["📋", "🎨", "🎬", "📸", "💡", "🚀", "📅", "🧠", "🎵", "📚", "🛍️", "✈️", "🏠", "⭐", "🔥", "📁", "💼", "🎯", "✏️", "🌱"];

export function htmlToText(html?: string) {
  if (!html) return "";
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToHtml(s: string) {
  return s
    .split(/\n/)
    .map((l) => `<div>${escapeHtml(l) || "<br>"}</div>`)
    .join("");
}

export function cardText(c: Card, boardTitle?: string): string {
  const d = c.data;
  switch (c.type) {
    case "note":
      return htmlToText(d.html);
    case "document":
      return (d.title || "") + "\n" + htmlToText(d.html);
    case "todo":
      return (d.title || "") + "\n" + (d.items || []).map((i) => i.text).join("\n");
    case "link":
      return [d.title, d.url, d.description].filter(Boolean).join("\n");
    case "image":
      return d.caption || d.name || "";
    case "file":
      return d.name || "";
    case "board":
      return boardTitle || "";
    case "column":
      return d.title || "";
    case "comment":
      return (d.comments || []).map((x) => `${x.author}: ${x.text}`).join("\n");
    case "swatch":
      return [d.name, d.color].filter(Boolean).join(" ");
    case "table":
      return (d.cells || []).map((r) => r.map((c) => c.v).join(" | ")).join("\n") || (d.rows || []).map((r) => r.join(" | ")).join("\n");
    case "heading":
      return htmlToText(d.html);
    case "map":
      return d.query || "Map";
    case "sketch":
      return "Sketch";
  }
}

export function isUrl(s: string) {
  return /^(https?:\/\/)[^\s]+$/i.test(s.trim()) || /^www\.[^\s]+\.[a-z]{2,}[^\s]*$/i.test(s.trim());
}
export function normalizeUrl(s: string) {
  s = s.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s;
}

export function youtubeId(url?: string) {
  if (!url) return null;
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}
export function vimeoId(url?: string) {
  if (!url) return null;
  const m = /vimeo\.com\/(\d+)/.exec(url);
  return m ? m[1] : null;
}

/** True when built for GitHub Pages (no server; data lives in the browser). */
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

export const proxied = (u?: string) => (u ? (STATIC || u.startsWith("/") || u.startsWith("idb:") || u.startsWith("blob:") ? u : `/api/proxy?url=${encodeURIComponent(u)}`) : "");

export function formatBytes(n?: number) {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export function timeAgo(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
  return new Date(t).toLocaleDateString();
}

export function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const h = el as HTMLElement;
  return h.tagName === "INPUT" || h.tagName === "TEXTAREA" || h.tagName === "SELECT" || h.isContentEditable;
}
