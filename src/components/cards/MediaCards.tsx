"use client";
import { Download, File, FileMusic, FileText, Film } from "lucide-react";
import type { Card } from "@/lib/types";
import { updateCard } from "@/lib/actions";
import { S } from "@/lib/store";
import { formatBytes } from "@/lib/utils";
import { useFileUrl } from "@/lib/storage";

export function ImageCard({ card }: { card: Card }) {
  const d = card.data;
  const ratio = d.natW && d.natH ? `${d.natW} / ${d.natH}` : undefined;
  const src = useFileUrl(d.url);
  return (
    <div className="image-body" onDoubleClick={() => S().set({ modal: { type: "image", id: card.id } })}>
      {d.url ? (
        src ? <img src={src} alt={d.caption || ""} draggable={false} style={{ aspectRatio: ratio }} /> : <div className="image-loading" style={{ aspectRatio: ratio || "4 / 3" }} />
      ) : (
        <div className="image-empty">No image</div>
      )}
      {(d.caption || d.showCaption) && (
        <input
          className="caption"
          placeholder="Add a caption"
          value={d.caption || ""}
          onChange={(e) => updateCard(card.id, { caption: e.target.value }, "cap-" + card.id)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          }}
        />
      )}
    </div>
  );
}

function iconFor(mime = "", name = "") {
  if (mime.startsWith("audio/")) return FileMusic;
  if (mime.startsWith("video/")) return Film;
  if (/pdf|text|word|document/.test(mime) || /\.(pdf|docx?|txt|md)$/i.test(name)) return FileText;
  return File;
}

export function FileCard({ card }: { card: Card }) {
  const d = card.data;
  const mime = d.mime || "";
  const Icon = iconFor(mime, d.name);
  const ext = (d.name || "").split(".").pop()?.toUpperCase().slice(0, 5) || "FILE";
  const src = useFileUrl(d.url);
  return (
    <div className="file-body">
      {mime.startsWith("video/") && (
        <video src={src || undefined} controls preload="metadata" data-nodrag className="file-video" />
      )}
      <div className="file-row">
        <div className="file-icon">
          <Icon size={22} />
          <span>{ext}</span>
        </div>
        <div className="file-info">
          <div className="file-name" title={d.name}>
            {d.name}
          </div>
          <div className="file-size">{formatBytes(d.size)}</div>
        </div>
        <a className="icon-btn" href={src} download={d.name} data-nodrag title="Download">
          <Download size={16} />
        </a>
      </div>
      {mime.startsWith("audio/") && <audio src={src || undefined} controls preload="metadata" data-nodrag className="file-audio" />}
      {mime === "application/pdf" && (
        <a className="file-open" href={src} target="_blank" rel="noreferrer" data-nodrag>
          Open PDF
        </a>
      )}
    </div>
  );
}
