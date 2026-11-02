import path from "path";
import { promises as fs } from "fs";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const WS_FILE = path.join(DATA_DIR, "workspace.json");

export async function ensureDirs() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif", ".bmp": "image/bmp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".aac": "audio/aac",
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".json": "application/json",
  ".zip": "application/zip", ".psd": "image/vnd.adobe.photoshop",
};
export function mimeFor(name: string) {
  return MIME[path.extname(name).toLowerCase()] || "application/octet-stream";
}
