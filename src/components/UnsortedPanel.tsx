"use client";
import { useMemo } from "react";
import { X } from "lucide-react";
import { useStore, S } from "@/lib/store";
import { unsortedCards } from "@/lib/actions";
import { startUnsortedDrag } from "@/lib/interactions";
import { CardView } from "./CardView";

export function UnsortedPanel() {
  const boardId = useStore((s) => s.currentBoardId);
  const cards = useStore((s) => s.ws.cards);
  const open = useStore((s) => s.unsortedOpen);
  const dragging = useStore((s) => s.dragging);
  const isDrop = useStore((s) => s.dropTarget?.kind === "unsorted");
  const ws = useStore((s) => s.ws);
  const list = useMemo(() => unsortedCards(ws, boardId), [cards, boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        className={"unsorted-btn" + (isDrop ? " drop" : "") + (dragging ? " armed" : "")}
        data-unsorted-drop
        onClick={() => S().set({ unsortedOpen: !open })}
        title="Unsorted cards — drag cards here to park them"
      >
        {list.length} Unsorted
      </button>
      {open && (
        <aside className={"unsorted-panel" + (isDrop ? " drop" : "")} data-unsorted-drop>
          <div className="unsorted-head">
            <span>Unsorted</span>
            <button className="icon-btn" onClick={() => S().set({ unsortedOpen: false })} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <div className="unsorted-list" data-scroll>
            {list.length === 0 && <div className="muted small unsorted-empty">Nothing here. Drag cards onto “Unsorted” to park them for later.</div>}
            {list.map((c) => (
              <div key={c.id} className="unsorted-item" onPointerDown={(e) => startUnsortedDrag(e, c.id)} title="Drag onto the board">
                <CardView id={c.id} inDrawer />
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
