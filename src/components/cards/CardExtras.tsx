"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Card, CommentItem, Label } from "@/lib/types";
import { S, useStore } from "@/lib/store";
import { timeAgo, uid } from "@/lib/utils";
import { dueLabel, toggleReaction, type MetaTarget } from "@/lib/meta";
import { AutoTextarea } from "../AutoTextarea";

export const avatarColor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 60% 52%)`;
};

/** Labels, reactions, due date and assignee chips (used for cards and to-do items). */
export function MetaChips({
  target,
  labels,
  reactions,
  due,
  assignee,
  done,
}: {
  target: MetaTarget;
  labels?: string[];
  reactions?: Record<string, number>;
  due?: string;
  assignee?: string;
  done?: boolean;
}) {
  const all = useStore((s) => s.ws.labels);
  const ls = (labels || []).map((id) => all.find((l) => l.id === id)).filter(Boolean) as Label[];
  const rs = Object.entries(reactions || {});
  if (!ls.length && !rs.length && !due && !assignee) return null;
  const dl = due ? dueLabel(due) : null;
  return (
    <div className="meta-chips">
      {assignee && <span className="chip assignee">@{assignee}</span>}
      {dl && <span className={"chip due " + (done ? "done" : dl.cls)}>{dl.text}</span>}
      {ls.map((l) => (
        <span key={l.id} className="chip label" style={{ background: l.color }}>
          {l.name}
        </span>
      ))}
      {rs.map(([e, n]) => (
        <button key={e} data-nodrag className="chip reaction" onClick={() => toggleReaction(target, e)} title="Click to remove">
          {e} <span>{n}</span>
        </button>
      ))}
    </div>
  );
}

/** Blue comment bubble pinned to a card, with a thread popover. */
export function CommentPin({ card }: { card: Card }) {
  const open = useStore((s) => s.commentOpen === card.id);
  const user = useStore((s) => s.ws.settings.userName || "Me");
  const comments = card.comments || [];
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 20);
  }, [open]);
  if (!comments.length && !open) return null;
  const post = () => {
    if (!text.trim()) return;
    const c: CommentItem = { id: uid(), author: user, text: text.trim(), at: Date.now() };
    S().mutate(
      (d) => {
        const x = d.cards[card.id];
        if (x) x.comments = [...(x.comments || []), c];
      },
      { history: true }
    );
    setText("");
  };
  return (
    <>
      <button
        data-nodrag
        className={"comment-pin no-export" + (open ? " open" : "")}
        onClick={() => S().set({ commentOpen: open ? null : card.id, selection: [card.id] })}
        title={`${comments.length} comment${comments.length === 1 ? "" : "s"}`}
      >
        {comments.length || "+"}
      </button>
      {open && (
        <div className="comment-thread no-export" data-nodrag onPointerDown={(e) => e.stopPropagation()}>
          {comments.map((c) => (
            <div key={c.id} className="ct-item">
              <span className="avatar small" style={{ background: avatarColor(c.author) }}>
                {c.author.slice(0, 1).toUpperCase()}
              </span>
              <div className="ct-main">
                <div className="ct-meta">
                  <b>{c.author}</b> <span>{timeAgo(c.at)}</span>
                  <button
                    className="ct-del"
                    onClick={() =>
                      S().mutate(
                        (d) => {
                          const x = d.cards[card.id];
                          if (x) x.comments = (x.comments || []).filter((y) => y.id !== c.id);
                        },
                        { history: true }
                      )
                    }
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="ct-text">{c.text}</div>
              </div>
            </div>
          ))}
          <div className="ct-input">
            <span className="avatar small" style={{ background: avatarColor(user) }}>
              {user.slice(0, 1).toUpperCase()}
            </span>
            <AutoTextarea
              ref={input}
              placeholder={comments.length ? "Reply…" : "Add a comment…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  post();
                } else if (e.key === "Escape") S().set({ commentOpen: null });
              }}
            />
            <button className="ct-send" disabled={!text.trim()} onClick={post}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
