"use client";

import { useEffect, useState } from "react";

type Source = {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
};

type Selection = {
  file: string | null;
  line: number | null;
  column: number | null;
  tag: string;
  text: string;
  placeholder: string | null;
  nameAttr: string | null;
  ariaLabel: string | null;
  idAttr: string | null;
  classList: string | null;
  role: string | null;
  href: string | null;
  type: string | null;
  nearestLabel: string | null;
  nearestHeading: string | null;
  selector: string;
  componentStack: string[];
};

function buildSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  let depth = 0;
  while (current && current.tagName && depth < 5) {
    let seg = current.tagName.toLowerCase();
    if (current.id) {
      seg += `#${current.id}`;
      parts.unshift(seg);
      break;
    }
    const cls = (current.getAttribute("class") || "")
      .split(/\s+/)
      .filter((c) => c && !c.startsWith("hover:") && !c.startsWith("focus:"))
      .slice(0, 2)
      .join(".");
    if (cls) seg += `.${cls}`;
    const parentEl: HTMLElement | null = current.parentElement;
    const cur: HTMLElement = current;
    if (parentEl) {
      const sameTag = Array.from(parentEl.children).filter(
        (c) => (c as HTMLElement).tagName === cur.tagName,
      );
      if (sameTag.length > 1) {
        const idx = sameTag.indexOf(cur) + 1;
        seg += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(seg);
    current = parentEl;
    depth += 1;
  }
  return parts.join(" > ");
}

function findNearestLabel(el: HTMLElement): string | null {
  // <label for="id"> association
  const id = el.getAttribute("id");
  if (id) {
    const byFor = document.querySelector(`label[for="${id}"]`);
    if (byFor?.textContent) return byFor.textContent.trim().slice(0, 80);
  }
  // Ancestor <label>
  const ancestor = el.closest("label");
  if (ancestor?.textContent) return ancestor.textContent.trim().slice(0, 80);
  // Preceding sibling label within parent
  const parent = el.parentElement;
  if (parent) {
    const label = parent.querySelector("label");
    if (label?.textContent) return label.textContent.trim().slice(0, 80);
  }
  return null;
}

function findNearestHeading(el: HTMLElement): string | null {
  let current: HTMLElement | null = el;
  while (current) {
    // Check preceding siblings of current for a heading
    let sibling = current.previousElementSibling as HTMLElement | null;
    while (sibling) {
      if (/^h[1-6]$/i.test(sibling.tagName)) return sibling.textContent?.trim().slice(0, 80) || null;
      const h = sibling.querySelector?.("h1,h2,h3,h4,h5,h6");
      if (h?.textContent) return h.textContent.trim().slice(0, 80);
      sibling = sibling.previousElementSibling as HTMLElement | null;
    }
    current = current.parentElement;
  }
  return null;
}

function findFiber(el: HTMLElement): unknown {
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
  if (!key) return null;
  return (el as unknown as Record<string, unknown>)[key];
}

function readSource(fiber: unknown): Source | null {
  let current = fiber as { _debugSource?: Source; return?: unknown } | null;
  while (current) {
    if (current._debugSource) return current._debugSource;
    current = current.return as typeof current;
  }
  return null;
}

function readComponentStack(fiber: unknown): string[] {
  const stack: string[] = [];
  let current = fiber as
    | { type?: unknown; return?: unknown }
    | null;
  while (current && stack.length < 8) {
    const t = current.type as
      | { displayName?: string; name?: string }
      | string
      | undefined;
    if (typeof t === "function" || typeof t === "object") {
      const name =
        (t as { displayName?: string; name?: string })?.displayName ||
        (t as { displayName?: string; name?: string })?.name;
      if (name) stack.push(name);
    }
    current = current.return as typeof current;
  }
  return stack;
}

export default function CodeGrab() {
  const [active, setActive] = useState(false);
  const [hover, setHover] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setHover(null);
      return;
    }

    const onMove = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && el.closest("[data-code-grab-ui]")) return;
      setHover(el);
    };

    const onClick = async (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || el.closest("[data-code-grab-ui]")) return;
      e.preventDefault();
      e.stopPropagation();

      const fiber = findFiber(el);
      const source = fiber ? readSource(fiber) : null;
      const stack = fiber ? readComponentStack(fiber) : [];

      const selection: Selection = {
        file: source?.fileName ?? null,
        line: source?.lineNumber ?? null,
        column: source?.columnNumber ?? null,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || "").trim().slice(0, 160),
        placeholder: el.getAttribute("placeholder"),
        nameAttr: el.getAttribute("name"),
        ariaLabel: el.getAttribute("aria-label"),
        idAttr: el.getAttribute("id"),
        classList: el.getAttribute("class")?.slice(0, 200) ?? null,
        role: el.getAttribute("role"),
        href: el.getAttribute("href"),
        type: el.getAttribute("type"),
        nearestLabel: findNearestLabel(el),
        nearestHeading: findNearestHeading(el),
        selector: buildSelector(el),
        componentStack: stack,
      };

      try {
        await fetch("/api/dev/grab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selection),
        });
      } catch {}

      const descriptor =
        selection.nearestLabel ||
        selection.placeholder ||
        selection.ariaLabel ||
        selection.text ||
        selection.selector;
      const label = source
        ? `${source.fileName}:${source.lineNumber}`
        : `<${stack[0] || selection.tag}> ${descriptor.slice(0, 60)}`;

      try {
        await navigator.clipboard?.writeText(label);
      } catch {}

      setToast(`Grabbed ${label}`);
      window.setTimeout(() => setToast(null), 3500);
      setActive(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setActive(false);
      }
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [active]);

  const rect = active && hover ? hover.getBoundingClientRect() : null;

  return (
    <div data-code-grab-ui>
      <button
        type="button"
        onClick={() => setActive((a) => !a)}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 2147483647,
          background: active ? "#ef4444" : "#111827",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: 999,
          fontSize: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          border: "1px solid rgba(255,255,255,0.2)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
          cursor: "pointer",
        }}
        title={active ? "Click or press Esc to cancel" : "Click to select an element"}
      >
        {active ? "● grabbing · esc" : "◎ grab"}
      </button>

      {rect && (
        <div
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            border: "2px solid #3b82f6",
            background: "rgba(59,130,246,0.18)",
            pointerEvents: "none",
            zIndex: 2147483646,
            transition: "all 60ms linear",
          }}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 64,
            right: 16,
            zIndex: 2147483647,
            background: "#111827",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            maxWidth: 420,
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
