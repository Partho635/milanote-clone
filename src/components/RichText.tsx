"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { S, useStore } from "@/lib/store";

const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "A", "UL", "OL", "LI", "H1", "H2", "H3", "P", "DIV", "BR", "BLOCKQUOTE", "CODE", "PRE", "SPAN", "MARK"]);

function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 1) {
        const el = child as HTMLElement;
        if (["SCRIPT", "STYLE", "META", "LINK", "TITLE", "IFRAME", "OBJECT"].includes(el.tagName)) {
          el.remove();
          continue;
        }
        walk(el);
        if (!ALLOWED.has(el.tagName)) {
          const frag = document.createDocumentFragment();
          while (el.firstChild) frag.appendChild(el.firstChild);
          if (/^(TR|TABLE|SECTION|ARTICLE|HEADER|FOOTER|H4|H5|H6)$/.test(el.tagName)) frag.appendChild(document.createElement("br"));
          el.replaceWith(frag);
          continue;
        }
        const href = el.getAttribute("href");
        for (const a of Array.from(el.attributes)) el.removeAttribute(a.name);
        if (el.tagName === "A" && href && /^https?:/i.test(href)) el.setAttribute("href", href);
      } else if (child.nodeType !== 3) child.parentNode?.removeChild(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

export function placeCaretEnd(el: HTMLElement) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
}

interface Props {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  focusKey?: string;
}

export function RichText({ html, onChange, placeholder, className, focusKey }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const wantFocus = useStore((s) => !!focusKey && s.focusRequest === focusKey);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html;
  }, [html]);

  useEffect(() => {
    if (wantFocus && ref.current) {
      ref.current.focus();
      placeCaretEnd(ref.current);
      S().set({ focusRequest: null });
    }
  }, [wantFocus]);

  return (
    <div
      ref={ref}
      className={"rt " + (className || "")}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-rt
      data-placeholder={placeholder}
      onInput={() => {
        const el = ref.current!;
        if (el.innerHTML === "<br>" || el.innerHTML === "<div><br></div>") el.innerHTML = "";
        onChange(el.innerHTML);
      }}
      onPaste={(e) => {
        e.stopPropagation();
        const dt = e.clipboardData;
        if (dt.files.length) return;
        e.preventDefault();
        const h = dt.getData("text/html");
        if (h) document.execCommand("insertHTML", false, sanitize(h));
        else document.execCommand("insertText", false, dt.getData("text/plain"));
      }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a && (e.ctrlKey || e.metaKey)) window.open(a.getAttribute("href") || "", "_blank");
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") ref.current?.blur();
        if ((e.ctrlKey || e.metaKey) && e.altKey) {
          const map: Record<string, string> = { "1": "h1", "2": "h2", "0": "div", "3": "h6" };
          const tag = map[e.code.replace("Digit", "")];
          if (tag) {
            e.preventDefault();
            document.execCommand("formatBlock", false, tag);
          }
        }
        e.stopPropagation();
      }}
    />
  );
}
