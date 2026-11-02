"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import type { Card } from "@/lib/types";
import { updateCard } from "@/lib/actions";
import { S, useStore } from "@/lib/store";
import { RichText } from "../RichText";

export function HeadingCard({ card }: { card: Card }) {
  return (
    <div className={"heading-body size-" + (card.data.hsize || "l")}>
      <RichText html={card.data.html || ""} focusKey={card.id} placeholder="Heading" onChange={(html) => updateCard(card.id, { html }, "heading-" + card.id)} />
    </div>
  );
}

export function MapCard({ card }: { card: Card }) {
  const q = card.data.query || "";
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const wantFocus = useStore((s) => s.focusRequest === card.id);
  const selected = useStore((s) => s.selection.length === 1 && s.selection[0] === card.id && !s.dragging);
  useEffect(() => {
    if (wantFocus) {
      input.current?.focus();
      S().set({ focusRequest: null });
    }
  }, [wantFocus]);
  if (!q)
    return (
      <div className="map-empty">
        <MapPin size={18} />
        <input
          ref={input}
          placeholder="Search a place and press Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && draft.trim()) updateCard(card.id, { query: draft.trim() });
          }}
        />
      </div>
    );
  return (
    <div className="map-body">
      <iframe
        title={q}
        src={`https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`}
        style={{ height: card.h || 240, pointerEvents: selected ? "auto" : "none" }}
        loading="lazy"
        {...(selected ? { "data-nodrag": true } : {})}
      />
      <div className="map-caption">
        <MapPin size={13} /> {q}
        {!selected && <span className="muted xsmall"> · click to interact</span>}
      </div>
    </div>
  );
}
