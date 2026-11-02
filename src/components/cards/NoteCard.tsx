"use client";
import type { Card } from "@/lib/types";
import { updateCard } from "@/lib/actions";
import { RichText } from "../RichText";

export function NoteCard({ card }: { card: Card }) {
  return (
    <div className="note-body">
      <RichText
        html={card.data.html || ""}
        focusKey={card.id}
        placeholder="Start typing…"
        onChange={(html) => updateCard(card.id, { html }, "text-" + card.id)}
      />
    </div>
  );
}
