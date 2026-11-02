"use client";
import { S } from "./store";
import type { Card, Workspace } from "./types";
import { boardBounds, columnChildren } from "./actions";
import { refs } from "./canvas";
import { escapeHtml, htmlToText } from "./utils";
import { resolveUrl, shareableUrl } from "./storage";
import { evaluate } from "@/components/cards/TableCard";

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
const slug = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "board";

/* ---------------- image of the board (PNG / PDF) ---------------- */

async function renderBoard(pixelRatio: number) {
  const s = S();
  const b = boardBounds();
  const world = refs.world;
  if (!b || !world) {
    s.toast("Nothing to export");
    return null;
  }
  s.set({ selection: [], selectedLines: [], commentOpen: null });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const { toPng } = await import("html-to-image");
  const pad = 48;
  const dark = s.ws.settings.theme === "dark";
  const url = await toPng(world, {
    width: b.w + pad * 2,
    height: b.h + pad * 2,
    pixelRatio,
    backgroundColor: dark ? "#1b1d21" : "#f4f3ef",
    style: { transform: `translate(${-b.x + pad}px, ${-b.y + pad}px)`, transformOrigin: "0 0" },
    skipFonts: true,
    filter: (n) =>
      !(n instanceof HTMLElement && n.classList.contains("no-export")) &&
      !(n instanceof HTMLImageElement && (!n.complete || n.naturalWidth === 0)) &&
      !(n instanceof HTMLIFrameElement),
  });
  return { url, w: b.w + pad * 2, h: b.h + pad * 2 };
}

export async function exportPDF(high: boolean) {
  const s = S();
  s.toast("Creating PDF…");
  try {
    const img = await renderBoard(high ? 3 : 1.5);
    if (!img) return;
    const { jsPDF } = await import("jspdf");
    const landscape = img.w >= img.h;
    const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "px", format: [img.w, img.h], compress: !high });
    pdf.addImage(img.url, "PNG", 0, 0, img.w, img.h, undefined, high ? "NONE" : "FAST");
    pdf.save(slug(s.ws.boards[s.currentBoardId]?.title || "board") + ".pdf");
  } catch (e) {
    console.error(e);
    s.toast("PDF export failed");
  }
}

export async function exportPNGImage() {
  const s = S();
  s.toast("Rendering image…");
  try {
    const img = await renderBoard(2);
    if (img) download(slug(s.ws.boards[s.currentBoardId]?.title || "board") + ".png", img.url);
  } catch (e) {
    console.error(e);
    s.toast("Export failed");
  }
}

/* ---------------- linear documents (Word / Markdown / Text) ---------------- */

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "html"; html: string }
  | { t: "todo"; title?: string; items: { text: string; done: boolean; due?: string; who?: string }[] }
  | { t: "link"; title: string; url: string }
  | { t: "image"; url: string; caption: string }
  | { t: "file"; name: string; url: string }
  | { t: "table"; rows: string[][] }
  | { t: "text"; text: string };

function blocksFor(ws: Workspace, boardId: string, includeSub: boolean, depth: number, seen: Set<string>): Block[] {
  const out: Block[] = [];
  if (seen.has(boardId)) return out;
  seen.add(boardId);
  const render = (c: Card) => {
    const d = c.data;
    switch (c.type) {
      case "note":
        out.push({ t: "html", html: d.html || "" });
        break;
      case "heading":
        out.push({ t: "h", level: Math.min(6, depth + 2), text: htmlToText(d.html) });
        break;
      case "todo":
        out.push({ t: "todo", title: d.title, items: (d.items || []).map((i) => ({ text: i.text, done: i.done, due: i.due, who: i.assignee })) });
        break;
      case "link":
        out.push({ t: "link", title: d.customTitle || d.title || d.url || "", url: d.url || "" });
        break;
      case "image":
        out.push({ t: "image", url: shareableUrl(d.url), caption: d.caption || "" });
        break;
      case "file":
        out.push({ t: "file", name: d.name || "file", url: shareableUrl(d.url) });
        break;
      case "document":
        out.push({ t: "h", level: Math.min(6, depth + 3), text: d.title || "Document" });
        out.push({ t: "html", html: d.html || "" });
        break;
      case "column":
        out.push({ t: "h", level: Math.min(6, depth + 3), text: d.title || "Column" });
        columnChildren(ws, c.id).forEach(render);
        break;
      case "table": {
        const cells = d.cells || (d.rows || []).map((r) => r.map((v) => ({ v })));
        out.push({ t: "table", rows: cells.map((r) => r.map((x) => evaluate(x.v, cells))) });
        break;
      }
      case "board": {
        const title = ws.boards[d.boardId!]?.title || "Board";
        if (includeSub && d.boardId) {
          out.push({ t: "h", level: Math.min(6, depth + 2), text: title });
          out.push(...blocksFor(ws, d.boardId, true, depth + 1, seen));
        } else out.push({ t: "text", text: `📁 ${title}` });
        break;
      }
      case "comment":
        for (const cm of d.comments || []) out.push({ t: "text", text: `💬 ${cm.author}: ${cm.text}` });
        break;
      case "swatch":
        out.push({ t: "text", text: `🎨 ${d.name || ""} ${d.color}`.trim() });
        break;
      case "map":
        out.push({ t: "link", title: `📍 ${d.query}`, url: `https://maps.google.com/?q=${encodeURIComponent(d.query || "")}` });
        break;
    }
  };
  Object.values(ws.cards)
    .filter((c) => c.boardId === boardId && !c.deleted && !c.parentId && !c.unsorted)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach(render);
  return out;
}

function toMarkdown(title: string, blocks: Block[]) {
  const L: string[] = [`# ${title}`, ""];
  for (const b of blocks) {
    if (b.t === "h") L.push(`${"#".repeat(b.level)} ${b.text}`, "");
    else if (b.t === "html") L.push(htmlToText(b.html), "");
    else if (b.t === "text") L.push(b.text, "");
    else if (b.t === "todo") {
      if (b.title) L.push(`**${b.title}**`);
      for (const i of b.items) L.push(`- [${i.done ? "x" : " "}] ${i.text}${i.who ? ` @${i.who}` : ""}${i.due ? ` (due ${i.due})` : ""}`);
      L.push("");
    } else if (b.t === "link") L.push(`[${b.title}](${b.url})`, "");
    else if (b.t === "image") L.push(`![${b.caption || "image"}](${b.url})`, "");
    else if (b.t === "file") L.push(`📎 [${b.name}](${b.url})`, "");
    else if (b.t === "table" && b.rows.length) {
      L.push("| " + b.rows[0].join(" | ") + " |", "| " + b.rows[0].map(() => "---").join(" | ") + " |");
      for (const r of b.rows.slice(1)) L.push("| " + r.join(" | ") + " |");
      L.push("");
    }
  }
  return L.join("\n");
}

function toHtml(title: string, blocks: Block[]) {
  const H: string[] = [`<h1>${escapeHtml(title)}</h1>`];
  for (const b of blocks) {
    if (b.t === "h") H.push(`<h${b.level}>${escapeHtml(b.text)}</h${b.level}>`);
    else if (b.t === "html") H.push(`<div>${b.html}</div>`);
    else if (b.t === "text") H.push(`<p>${escapeHtml(b.text)}</p>`);
    else if (b.t === "todo") {
      if (b.title) H.push(`<p><b>${escapeHtml(b.title)}</b></p>`);
      H.push("<ul>" + b.items.map((i) => `<li>${i.done ? "☑" : "☐"} ${escapeHtml(i.text)}${i.who ? ` <i>@${escapeHtml(i.who)}</i>` : ""}${i.due ? ` <small>(due ${i.due})</small>` : ""}</li>`).join("") + "</ul>");
    } else if (b.t === "link") H.push(`<p><a href="${escapeHtml(b.url)}">${escapeHtml(b.title)}</a></p>`);
    else if (b.t === "image") H.push(`<p><img src="${escapeHtml(b.url)}" style="max-width:480px"><br><i>${escapeHtml(b.caption)}</i></p>`);
    else if (b.t === "file") H.push(`<p>📎 <a href="${escapeHtml(b.url)}">${escapeHtml(b.name)}</a></p>`);
    else if (b.t === "table")
      H.push(
        `<table border="1" cellspacing="0" cellpadding="4">` +
          b.rows.map((r, i) => "<tr>" + r.map((c) => (i === 0 ? `<th>${escapeHtml(c)}</th>` : `<td>${escapeHtml(c)}</td>`)).join("") + "</tr>").join("") +
          `</table>`
      );
  }
  return H.join("\n");
}

export function exportLinear(kind: "word" | "markdown" | "text", includeSub: boolean) {
  const s = S();
  const bid = s.currentBoardId;
  const title = s.ws.boards[bid]?.title || "Board";
  const blocks = blocksFor(s.ws, bid, includeSub, 0, new Set());
  const name = slug(title);
  if (kind === "markdown") {
    download(name + ".md", URL.createObjectURL(new Blob([toMarkdown(title, blocks)], { type: "text/markdown" })));
  } else if (kind === "text") {
    const md = toMarkdown(title, blocks).replace(/^#+ /gm, "").replace(/\*\*/g, "").replace(/!?\[([^\]]*)\]\(([^)]*)\)/g, "$1 ($2)");
    download(name + ".txt", URL.createObjectURL(new Blob([md], { type: "text/plain" })));
  } else {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt} h1{font-size:22pt} table{border-collapse:collapse}</style></head><body>${toHtml(title, blocks)}</body></html>`;
    download(name + ".doc", URL.createObjectURL(new Blob(["﻿" + html], { type: "application/msword" })));
  }
}

/* ---------------- all images & files as ZIP ---------------- */

export async function exportZip(includeSub: boolean) {
  const s = S();
  const ws = s.ws;
  const boards = new Set<string>([s.currentBoardId]);
  if (includeSub) {
    const walk = (b: string) => {
      for (const c of Object.values(ws.cards))
        if (c.boardId === b && c.type === "board" && c.data.boardId && !c.deleted && !boards.has(c.data.boardId)) {
          boards.add(c.data.boardId);
          walk(c.data.boardId);
        }
    };
    walk(s.currentBoardId);
  }
  const files = Object.values(ws.cards).filter((c) => boards.has(c.boardId) && !c.deleted && (c.type === "image" || c.type === "file") && c.data.url);
  if (!files.length) {
    s.toast("No images or files on this board");
    return;
  }
  s.toast(`Zipping ${files.length} file${files.length > 1 ? "s" : ""}…`);
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const used = new Set<string>();
  for (const c of files) {
    try {
      const blob = await fetch(await resolveUrl(c.data.url)).then((r) => r.blob());
      let name = (c.data.name || c.data.url!.split("/").pop() || "file").replace(/[\\/:*?"<>|]/g, "_");
      let k = 1;
      while (used.has(name)) name = name.replace(/(\.\w+)?$/, (m) => `-${k++}${m}`);
      used.add(name);
      zip.file(name, blob);
    } catch {}
  }
  const out = await zip.generateAsync({ type: "blob" });
  download(slug(ws.boards[s.currentBoardId]?.title || "board") + "-files.zip", URL.createObjectURL(out));
}
