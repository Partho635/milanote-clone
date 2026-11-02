"use client";
/**
 * Storage layer with two modes:
 *  - Local server mode (npm run dev / start): data in data/workspace.json, uploads in data/uploads (via /api routes).
 *  - Static mode (GitHub Pages, NEXT_PUBLIC_STATIC=1): everything is kept in this browser's IndexedDB.
 */
import { useEffect, useState } from "react";
import type { Workspace } from "./types";
import { STATIC } from "./utils";

export { STATIC };

/* ---------------- IndexedDB helpers ---------------- */

let dbp: Promise<IDBDatabase> | null = null;
function db() {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open("milanote-clone", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("kv");
        r.result.createObjectStore("files");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  return dbp;
}
async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((res, rej) => {
    const q = d.transaction(store).objectStore(store).get(key);
    q.onsuccess = () => res(q.result as T);
    q.onerror = () => rej(q.error);
  });
}
async function idbPut(store: string, key: string, val: unknown) {
  const d = await db();
  return new Promise<void>((res, rej) => {
    const tx = d.transaction(store, "readwrite");
    tx.objectStore(store).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

/* ---------------- workspace ---------------- */

export async function loadWorkspace(): Promise<Workspace | null> {
  if (STATIC) {
    const raw = await idbGet<string>("kv", "workspace");
    return raw ? (JSON.parse(raw) as Workspace) : null;
  }
  const r = await fetch("/api/workspace");
  return r.json();
}

export async function saveWorkspace(ws: Workspace) {
  if (STATIC) {
    await idbPut("kv", "workspace", JSON.stringify(ws));
    return;
  }
  const res = await fetch("/api/workspace", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(ws) });
  if (!res.ok) throw new Error("save failed");
}

export function saveOnUnload(ws: Workspace) {
  if (STATIC) {
    saveWorkspace(ws).catch(() => {});
    return;
  }
  navigator.sendBeacon("/api/workspace", new Blob([JSON.stringify(ws)], { type: "application/json" }));
}

/* ---------------- files ---------------- */

export interface StoredFile {
  url: string;
  name: string;
  size: number;
  type: string;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function storeFile(file: File | Blob, name?: string): Promise<StoredFile> {
  const fname = name || (file as File).name || "file";
  if (STATIC) {
    const id = uid();
    await idbPut("files", id, file);
    return { url: "idb:" + id, name: fname, size: file.size, type: file.type || "application/octet-stream" };
  }
  const fd = new FormData();
  fd.append("file", file, fname);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload failed");
  return res.json();
}

const urlCache = new Map<string, string>();

/** Turns a stored file reference into something an <img>/<a> can use. */
export async function resolveUrl(url?: string): Promise<string> {
  if (!url) return "";
  if (!url.startsWith("idb:")) return url;
  const hit = urlCache.get(url);
  if (hit) return hit;
  const blob = await idbGet<Blob>("files", url.slice(4));
  if (!blob) return "";
  const u = URL.createObjectURL(blob);
  urlCache.set(url, u);
  return u;
}

export function resolveUrlSync(url?: string) {
  if (!url) return "";
  if (!url.startsWith("idb:")) return url;
  return urlCache.get(url) || "";
}

export function useFileUrl(url?: string) {
  const [u, setU] = useState(() => resolveUrlSync(url));
  useEffect(() => {
    let alive = true;
    resolveUrl(url).then((x) => alive && setU(x));
    return () => {
      alive = false;
    };
  }, [url]);
  return u;
}

/** Absolute link for exports (local server files) — browser-stored files can't be linked. */
export function shareableUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("idb:")) return "";
  if (url.startsWith("/")) return location.origin + url;
  return url;
}

/* ---------------- link previews ---------------- */

export interface Preview {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

export async function unfurl(url: string): Promise<Preview> {
  if (!STATIC) {
    const r = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
    return r.json();
  }
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  const base: Preview = { title: host || url, siteName: host, favicon: host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : "" };
  // 1) oEmbed via noembed (YouTube, Vimeo, Flickr, SoundCloud, Twitter …)
  try {
    const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(7000) });
    const j = await r.json();
    if (j && j.title && !j.error) return { ...base, title: j.title, image: j.thumbnail_url, siteName: j.provider_name || host, description: j.author_name ? `by ${j.author_name}` : "" };
  } catch {}
  // 2) Microlink free tier (any web page)
  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(9000) });
    const j = await r.json();
    if (j.status === "success" && j.data)
      return { ...base, title: j.data.title || base.title, description: j.data.description || "", image: j.data.image?.url, favicon: j.data.logo?.url || base.favicon, siteName: j.data.publisher || host };
  } catch {}
  return base;
}

/* ---------------- free image search ---------------- */

export interface ImgResult {
  url: string;
  thumbnail: string;
  title: string;
  creator?: string;
}

export async function searchImages(q: string): Promise<ImgResult[]> {
  if (!STATIC) {
    const r = await fetch(`/api/images?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.results;
  }
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("search failed");
  const j = await r.json();
  return (j.results || []).map((x: Record<string, string>) => ({ url: x.url, thumbnail: x.thumbnail || x.url, title: x.title || q, creator: x.creator || "" }));
}

/** Saves a remote image locally if possible; otherwise keeps the remote link. */
export async function importImage(url: string, name?: string): Promise<{ url: string; name: string }> {
  if (!STATIC) {
    const r = await fetch("/api/upload-url", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, name }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "failed");
    return j;
  }
  try {
    const blob = await fetch(url, { signal: AbortSignal.timeout(15000) }).then((r) => {
      if (!r.ok) throw new Error();
      return r.blob();
    });
    if (!blob.type.startsWith("image/")) throw new Error();
    const f = await storeFile(blob, name || "image");
    return { url: f.url, name: f.name };
  } catch {
    return { url, name: name || "image" };
  }
}
