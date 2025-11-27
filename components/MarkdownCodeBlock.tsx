"use client";

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PreProps = ComponentPropsWithoutRef<"pre">;

export const InlineCodeCopyDisabledContext = createContext(false);

export function MarkdownCodeBlock({ children, className, ...rest }: PreProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const codeText = useMemo(() => {
    const codeChild = Children.toArray(children).find(
      (child) => isValidElement(child) && child.type === "code",
    );

    if (isValidElement(codeChild)) {
      return extractText(codeChild.props.children);
    }

    return extractText(children);
  }, [children]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!codeText) {
      return;
    }

    try {
      await copyTextToClipboard(codeText);

      setCopied(true);
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy code block", error);
    }
  }, [codeText]);

  return (
    <InlineCodeCopyDisabledContext.Provider value={true}>
      <div className="code-block">
        <pre className={className} {...rest}>
          {children}
        </pre>
        <button
          type="button"
          className={`code-copy${copied ? " copied" : ""}`}
          onClick={handleCopy}
          aria-label="코드 복사"
          title={copied ? "복사됨" : "복사"}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </InlineCodeCopyDisabledContext.Provider>
  );
}

export function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (isValidElement(node)) {
    return extractText(node.props.children);
  }

  return "";
}

export async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15V5.8A1.8 1.8 0 0 1 6.8 4h9.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 12 4 4 8-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
