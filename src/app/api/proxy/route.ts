export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxies remote images so link previews work offline-friendly and can be exported as PNG.
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") || "";
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
    const res = await fetch(u.href, {
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124" },
      signal: AbortSignal.timeout(10000),
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !(type.startsWith("image/") || type.includes("icon"))) return new Response("Not an image", { status: 415 });
    return new Response(res.body, { headers: { "content-type": type, "cache-control": "public, max-age=604800" } });
  } catch {
    return new Response("Bad request", { status: 400 });
  }
}
