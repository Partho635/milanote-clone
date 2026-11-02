import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR, ensureDirs } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureDirs();
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  const ext = path.extname(file.name || "").toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const name = id + ext;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return NextResponse.json({
    url: `/api/files/${name}`,
    name: file.name,
    size: buf.length,
    type: file.type || "application/octet-stream",
  });
}
