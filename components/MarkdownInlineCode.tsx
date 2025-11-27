"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, KeyboardEvent } from "react";

import { InlineCodeCopyDisabledContext, copyTextToClipboard, extractText } from "./MarkdownCodeBlock";

type CodeProps = ComponentPropsWithoutRef<"code">;

export function MarkdownInlineCode({ children, className, ...rest }: CodeProps) {
  const disabled = useContext(InlineCodeCopyDisabledContext);
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const codeText = useMemo(() => extractText(children), [children]);

  useEffect(
    () => () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    if (disabled || !codeText) {
      return;
    }

    try {
      await copyTextToClipboard(codeText);
      setCopied(true);
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Failed to copy inline code", error);
    }
  }, [codeText, disabled]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCopy();
      }
    },
    [disabled, handleCopy],
  );

  const classes = [];
  if (className) {
    classes.push(className);
  }
  if (!disabled) {
    classes.push("code-inline-copyable");
  }
  if (copied) {
    classes.push("copied");
  }

  return (
    <code
      className={classes.join(" ") || undefined}
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? undefined : 0}
      role={disabled ? undefined : "button"}
      aria-label={disabled ? undefined : "코드 복사"}
      {...rest}
    >
      {children}
    </code>
  );
}
