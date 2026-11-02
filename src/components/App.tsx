"use client";
import { useEffect } from "react";
import { useStore, S, vpOf } from "@/lib/store";
import type { Workspace } from "@/lib/types";
import { welcomeWorkspace } from "@/lib/templates";
import { loadWorkspace, saveOnUnload, saveWorkspace } from "@/lib/storage";
import {
  boardPath,
  copySelection,
  createCard,
  deleteSelection,
  duplicateSelection,
  freeSpot,
  navigate,
  onFilesPicked,
  tryPasteText,
  uploadFiles,
  zoomBy,
  zoomTo,
  zoomToFit,
} from "@/lib/actions";
import { createFromTool, isTyping } from "@/lib/interactions";
import { isUrl, normalizeUrl, textToHtml } from "@/lib/utils";
import { Canvas } from "./Canvas";
import { Sidebar, TopBar } from "./Chrome";
import { ZoomControls } from "./Toolbar";
import { LeftToolbar } from "./LeftToolbar";
import { UnsortedPanel } from "./UnsortedPanel";
import { ContextMenu, Toasts } from "./Overlays";
import { Modals } from "./Modals";

function boardFromHash() {
  const m = /^#\/b\/([\w-]+)/.exec(location.hash);
  return m ? m[1] : "home";
}

function migrate(ws: Workspace): Workspace {
  ws.lines ||= {};
  ws.labels ||= [];
  ws.people ||= [];
  ws.settings = Object.assign({ userName: "Me", theme: "light", snap: false, showGrid: true }, ws.settings || {});
  if (!ws.boards.home) ws.boards.home = { id: "home", title: "Home", icon: "🏠", createdAt: Date.now() };
  return ws;
}

export default function App() {
  const loaded = useStore((s) => s.loaded);
  const theme = useStore((s) => s.ws.settings.theme);
  const presenting = useStore((s) => s.presenting);
  const sidebarOpen = useStore((s) => s.sidebarOpen);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && S().presenting) S().set({ presenting: false });
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // load workspace
  useEffect(() => {
    (window as unknown as { __mc: typeof useStore }).__mc = useStore; // handy for debugging in devtools
    let vps = {};
    try {
      vps = JSON.parse(localStorage.getItem("mc-viewports") || "{}");
    } catch {}
    loadWorkspace()
      .then((data: Workspace | null) => {
        const ws = data && data.boards ? migrate(data) : welcomeWorkspace();
        S().set({ ws, loaded: true, viewports: vps });
        navigate(boardFromHash(), false);
        if (!data) save(ws);
      })
      .catch(() => {
        S().set({ ws: welcomeWorkspace(), loaded: true, saveState: "error" });
        navigate(boardFromHash(), false);
      });
    const onPop = () => navigate(boardFromHash(), false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // autosave
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    let vt: ReturnType<typeof setTimeout> | null = null;
    const unsub = useStore.subscribe((s, p) => {
      if (s.loaded && s.ws !== p.ws && p.loaded) {
        if (s.saveState !== "saving") S().set({ saveState: "saving" });
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          t = null;
          const run = () => save(S().ws);
          const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
          if (ric) ric(run, { timeout: 1500 });
          else run();
        }, 700);
      }
      if (s.viewports !== p.viewports) {
        if (vt) clearTimeout(vt);
        vt = setTimeout(() => localStorage.setItem("mc-viewports", JSON.stringify(S().viewports)), 400);
      }
    });
    const flush = () => {
      if (t) saveOnUnload(S().ws);
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      unsub();
      window.removeEventListener("beforeunload", flush);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = S();
      const mod = e.ctrlKey || e.metaKey;
      const typing = isTyping();
      if (e.key === "Escape") {
        if (s.presenting) {
          s.set({ presenting: false });
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          return;
        }
        if (s.modal) return s.set({ modal: null });
        if (s.commentOpen) return s.set({ commentOpen: null });
        if (s.tableSel && !typing) return s.set({ tableSel: null });
        if (s.contextMenu) return s.set({ contextMenu: null });
        if (typing) return (document.activeElement as HTMLElement).blur();
        if (s.drawingId) return s.set({ drawingId: null });
        if (s.selection.length || s.selectedLines.length) return s.set({ selection: [], selectedLines: [] });
        const path = boardPath(s.ws, s.currentBoardId);
        if (path.length > 1) navigate(path[path.length - 2].id);
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        return s.set({ modal: { type: "search" } });
      }
      if (typing || s.modal) return;
      if ((document.activeElement as HTMLElement | null)?.closest?.("[data-keys]")) return;
      const k = e.key.toLowerCase();
      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        s.set({ spaceDown: true });
        return;
      }
      if (mod) {
        if (k === "z" && !e.shiftKey) (e.preventDefault(), s.undo());
        else if ((k === "z" && e.shiftKey) || k === "y") (e.preventDefault(), s.redo());
        else if (k === "d") (e.preventDefault(), duplicateSelection());
        else if (k === "c") copySelection();
        else if (k === "x") copySelection(true);
        else if (k === "a") {
          e.preventDefault();
          s.set({ selection: Object.values(s.ws.cards).filter((c) => c.boardId === s.currentBoardId && !c.deleted && !c.parentId).map((c) => c.id) });
        } else if (k === "=" || k === "+") (e.preventDefault(), zoomBy(1.2));
        else if (k === "-") (e.preventDefault(), zoomBy(1 / 1.2));
        else if (k === "0") (e.preventDefault(), zoomTo(1, undefined, true));
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        return deleteSelection();
      }
      if (e.key === "!" || (e.shiftKey && e.code === "Digit1")) return zoomToFit();
      if (e.key.startsWith("Arrow") && s.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        s.mutate(
          (d) => {
            for (const id of s.selection) {
              const c = d.cards[id];
              if (c && !c.parentId) {
                c.x += dx;
                c.y += dy;
              }
            }
          },
          { coalesce: "nudge" }
        );
        return;
      }
      if (e.altKey) return;
      const map: Record<string, Parameters<typeof createFromTool>[0]> = {
        n: "note", t: "todo", l: "link", b: "board", c: "column", m: "comment", d: "sketch", i: "upload-image", u: "upload-file",
      };
      if (map[k]) {
        e.preventDefault();
        createFromTool(map[k], freeSpot(map[k]));
      } else if (k === "h") s.set({ tool: s.tool === "hand" ? "select" : "hand" });
      else if (k === "v") s.set({ tool: "select" });
      else if (e.key === "?") s.set({ modal: { type: "shortcuts" } });
      else if (e.key === "/") (e.preventDefault(), s.set({ modal: { type: "search" } }));
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === " ") S().set({ spaceDown: false });
    };
    const blur = () => S().set({ spaceDown: false });
    const paste = (e: ClipboardEvent) => {
      if (isTyping() || S().modal) return;
      const dt = e.clipboardData;
      if (!dt) return;
      const files = Array.from(dt.files);
      if (files.length) {
        e.preventDefault();
        uploadFiles(files);
        return;
      }
      const text = dt.getData("text/plain");
      if (tryPasteText(text)) {
        e.preventDefault();
        return;
      }
      if (!text.trim()) return;
      e.preventDefault();
      if (isUrl(text)) createCard("link", undefined, { data: { url: normalizeUrl(text), status: "idle" } });
      else createCard("note", undefined, { data: { html: textToHtml(text) } });
    };
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("paste", paste);
    };
  }, []);

  return (
    <div className={"app" + (presenting ? " presenting" : "")}>
      {!presenting && sidebarOpen && <Sidebar />}
      <div className="main">
        {!presenting && <TopBar />}
        <div className="stage">
          {!presenting && <LeftToolbar />}
          <div className="canvas-wrap">
            <Canvas />
            {!presenting && <UnsortedPanel />}
            {!presenting && <ZoomControls />}
            {presenting && (
              <button
                className="exit-present"
                onClick={() => {
                  S().set({ presenting: false });
                  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                }}
              >
                Exit presentation (Esc)
              </button>
            )}
            {!loaded && <div className="loading">Loading your workspace…</div>}
          </div>
        </div>
      </div>
      <ContextMenu />
      <Modals />
      <Toasts />
      <input
        id="global-file-input"
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFilesPicked(files);
        }}
      />
    </div>
  );
}

async function save(ws: Workspace) {
  try {
    await saveWorkspace(ws);
    if (S().ws === ws) S().set({ saveState: "saved" });
  } catch {
    S().set({ saveState: "error" });
  }
}

export { vpOf };
