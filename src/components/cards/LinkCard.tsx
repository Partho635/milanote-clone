"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import type { Card } from "@/lib/types";
import { updateCard } from "@/lib/actions";
import { S, useStore } from "@/lib/store";
import { normalizeUrl, proxied, vimeoId, youtubeId } from "@/lib/utils";
import { unfurl as unfurlPreview } from "@/lib/storage";

const inflight = new Set<string>();

async function unfurl(id: string, url: string) {
  if (inflight.has(id)) return;
  inflight.add(id);
  S().mutate((d) => {
    if (d.cards[id]) d.cards[id].data.status = "loading";
  });
  try {
    const yt = youtubeId(url);
    const j = await unfurlPreview(url);
    S().mutate((d) => {
      const c = d.cards[id];
      if (!c) return;
      Object.assign(c.data, {
        title: j.title || url,
        description: j.description || "",
        image: yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : j.image || "",
        favicon: j.favicon || "",
        siteName: j.siteName || "",
        status: "done",
      });
    });
  } catch {
    S().mutate((d) => {
      if (d.cards[id]) d.cards[id].data.status = "error";
    });
  } finally {
    inflight.delete(id);
  }
}

export function LinkCard({ card }: { card: Card }) {
  const d = card.data;
  const [draft, setDraft] = useState("");
  const [playing, setPlaying] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const wantFocus = useStore((s) => s.focusRequest === card.id);
  const selected = useStore((s) => s.selection.includes(card.id));

  useEffect(() => {
    if (wantFocus) {
      input.current?.focus();
      S().set({ focusRequest: null });
    }
  }, [wantFocus]);

  useEffect(() => {
    if (d.url && d.status !== "done" && d.status !== "error") unfurl(card.id, d.url);
  }, [card.id, d.url, d.status]);

  useEffect(() => {
    if (!selected) setPlaying(false);
  }, [selected]);

  if (!d.url) {
    return (
      <div className="link-empty">
        <input
          ref={input}
          placeholder={d.description === "video" ? "Paste a YouTube or Vimeo link…" : "Paste a link and press Enter"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && draft.trim()) {
              updateCard(card.id, { url: normalizeUrl(draft), status: "idle" });
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    );
  }

  const yt = youtubeId(d.url);
  const vm = vimeoId(d.url);
  const embed = yt ? `https://www.youtube.com/embed/${yt}?autoplay=1` : vm ? `https://player.vimeo.com/video/${vm}?autoplay=1` : null;
  let host = "";
  try {
    host = new URL(d.url).hostname.replace(/^www\./, "");
  } catch {}

  return (
    <div className="link-body">
      {d.hidePreview ? null : embed && playing ? (
        <div className="embed" data-nodrag>
          <iframe src={embed} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        </div>
      ) : d.image ? (
        <div className={"link-image" + (embed ? " video" : "")}>
          <img src={proxied(d.image)} alt="" draggable={false} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          {embed && (
            <button data-nodrag className="play" onClick={() => setPlaying(true)} aria-label="Play">
              <Play size={22} fill="currentColor" />
            </button>
          )}
        </div>
      ) : null}
      <div className="link-meta">
        {d.status === "loading" && !d.title ? (
          <div className="link-loading">Fetching preview…</div>
        ) : (
          <>
            <a className="link-title" href={d.url} target="_blank" rel="noreferrer" data-nodrag>
              {d.customTitle || d.title || d.url}
            </a>
            {d.description && d.description !== "video" && !d.hidePreview && <div className="link-desc">{d.description}</div>}
          </>
        )}
        <div className="link-host">
          {d.favicon && <img src={proxied(d.favicon)} alt="" width={14} height={14} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />}
          <span>{d.siteName || host}</span>
          <a href={d.url} target="_blank" rel="noreferrer" data-nodrag className="link-open" title="Open link">
            <ExternalLink size={13} />
          </a>
        </div>
        {d.showCaption && (
          <input
            className="caption-inline"
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
    </div>
  );
}
