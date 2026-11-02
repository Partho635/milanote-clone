import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR, ensureDirs } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg", "image/avif": ".avif" };

// Downloads a remote image into data/uploads so it keeps working offline.
export async function POST(req: Request) {
  await ensureDirs();
  try {
    const { url, name } = await req.json();
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error("bad url");
    const res = await fetch(u.href, { headers: { "user-agent": "Mozilla/5.0 Chrome/124" }, signal: AbortSignal.timeout(20000) });
    const type = (res.headers.get("content-type") || "").split(";")[0];
    if (!res.ok || !type.startsWith("image/")) throw new Error("not an image");
    const buf = Buffer.from(await res.arrayBuffer());
    const file = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + (EXT[type] || path.extname(u.pathname).slice(0, 6) || ".jpg");
    await fs.writeFile(path.join(UPLOAD_DIR, file), buf);
    return NextResponse.json({ url: `/api/files/${file}`, name: (name || path.basename(u.pathname) || "image").slice(0, 80), size: buf.length, type });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
