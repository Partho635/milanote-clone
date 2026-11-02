import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Free image search through Openverse (no API key needed).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ results: [] });
  try {
    const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=24&mature=false`, {
      headers: { "user-agent": "milanote-clone/1.0 (local app)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error("bad status " + res.status);
    const j = await res.json();
    const results = (j.results || []).map((r: Record<string, string>) => ({
      url: r.url,
      thumbnail: r.thumbnail || r.url,
      title: r.title || q,
      creator: r.creator || "",
    }));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ results: [], error: String(e) }, { status: 502 });
  }
}
