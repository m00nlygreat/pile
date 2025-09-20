"use client";

import { useEffect, useRef, useState } from "react";

type CopyItemButtonProps = {
  type: "text" | "file" | "link";
  textMd: string | null;
  linkUrl: string | null;
  fileHref: string | null;
  fileMime: string | null;
};

type CopyState = "idle" | "copied" | "error";

export default function CopyItemButton({ type, textMd, linkUrl, fileHref, fileMime }: CopyItemButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (!navigator.clipboard) {
      setErrorState();
      return;
    }

    try {
      if (type === "text") {
        const content = textMd?.trim();
        if (!content) {
          throw new Error("No text to copy");
        }
        await navigator.clipboard.writeText(content);
      } else if (type === "link") {
        if (!linkUrl) {
          throw new Error("No link to copy");
        }
        await navigator.clipboard.writeText(linkUrl);
      } else if (type === "file") {
        if (!fileHref || !fileMime?.toLowerCase().startsWith("image/")) {
          throw new Error("Only image files can be copied to clipboard");
        }

        const response = await fetch(fileHref);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        if (typeof window.ClipboardItem === "undefined") {
          throw new Error("ClipboardItem API unavailable");
        }

        const clipboardItem = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        throw new Error("Unsupported item type");
      }

      setState("copied");
    } catch (error) {
      console.error("Failed to copy item", error);
      setErrorState();
      return;
    }

    scheduleReset();
  }

  function setErrorState() {
    setState("error");
    scheduleReset();
  }

  function scheduleReset() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setState("idle");
    }, 2000);
  }

  return (
    <button
      type="button"
      className="item-copy-button"
      onClick={handleCopy}
      aria-label={state === "copied" ? "복사 완료" : state === "error" ? "복사 실패" : "아이템 복사"}
      data-state={state}
    >
      <span aria-hidden="true">
        {state === "copied" ? <CheckIcon /> : state === "error" ? <AlertIcon /> : <CopyIcon />}
      </span>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "복사 완료" : state === "error" ? "복사 실패" : "아이템 복사"}
      </span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
