import { promises as fs, createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { UPLOAD_DIR, mimeFor } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const safe = path.basename(name);
  const file = path.join(UPLOAD_DIR, safe);
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = mimeFor(safe);
  const range = req.headers.get("range");
  const base = { "content-type": type, "accept-ranges": "bytes", "cache-control": "public, max-age=31536000, immutable" };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? Math.min(parseInt(m[2], 10), stat.size - 1) : stat.size - 1;
    const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...base, "content-range": `bytes ${start}-${end}/${stat.size}`, "content-length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(stream, { headers: { ...base, "content-length": String(stat.size) } });
}
