import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { WS_FILE, ensureDirs } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await fs.readFile(WS_FILE, "utf8");
    return new NextResponse(raw, { headers: { "content-type": "application/json" } });
  } catch {
    return NextResponse.json(null);
  }
}

let lastBackup = 0;

export async function PUT(req: Request) {
  await ensureDirs();
  const body = await req.text();
  try {
    JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  // keep an hourly backup of the previous state
  if (Date.now() - lastBackup > 60 * 60 * 1000) {
    try {
      await fs.copyFile(WS_FILE, WS_FILE.replace(/\.json$/, ".backup.json"));
      lastBackup = Date.now();
    } catch {}
  }
  const tmp = WS_FILE + ".tmp";
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, WS_FILE);
  return NextResponse.json({ ok: true });
}

// navigator.sendBeacon on page close uses POST
export const POST = PUT;
