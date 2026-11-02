import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .trim();
}

function attrs(tag: string) {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") || "";
  let target: URL;
  try {
    target = new URL(url);
    if (!/^https?:$/.test(target.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  const result: Record<string, string> = { url: target.href, siteName: target.hostname.replace(/^www\./, "") };
  try {
    const res = await fetch(target.href, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.startsWith("image/")) {
      result.image = target.href;
      result.title = target.pathname.split("/").pop() || target.hostname;
      return NextResponse.json(result);
    }
    const html = (await res.text()).slice(0, 600_000);
    const meta: Record<string, string> = {};
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
      const a = attrs(tag);
      const key = (a.property || a.name || a.itemprop || "").toLowerCase();
      if (key && a.content && !meta[key]) meta[key] = decode(a.content);
    }
    const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    result.title = meta["og:title"] || meta["twitter:title"] || (titleTag ? decode(titleTag[1]) : "") || target.hostname;
    result.description = meta["og:description"] || meta["twitter:description"] || meta["description"] || "";
    const img = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || meta["twitter:image:src"] || "";
    if (img) result.image = new URL(img, res.url || target.href).href;
    if (meta["og:site_name"]) result.siteName = meta["og:site_name"];
    let icon = "";
    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
      const a = attrs(tag);
      if (/(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(a.rel || "") && a.href) {
        icon = a.href;
        if (/apple/i.test(a.rel)) continue;
        break;
      }
    }
    result.favicon = new URL(icon || "/favicon.ico", res.url || target.href).href;
  } catch {
    result.title = result.title || target.hostname;
  }
  return NextResponse.json(result);
}
