"use client";

import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
} from "react";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CHARACTER_LIMIT = 4000;

type ChannelComposerProps = {
  boardSlug: string;
  channelSlug: string;
  channelName: string;
};

export function ChannelComposer({
  boardSlug,
  channelSlug,
  channelName,
}: ChannelComposerProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hintId = useId();

  const [text, setText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReceivedPaste, setHasReceivedPaste] = useState(false);

  const normalizedText = text.replace(/\r\n/g, "\n");
  const trimmedText = normalizedText.trim();
  const characterCount = normalizedText.length;
  const isOverLimit = trimmedText.length > CHARACTER_LIMIT;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const maxHeight = 320;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${Math.max(nextHeight, 120)}px`;
  }, [normalizedText]);

  useEffect(() => {
    function handleWindowPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const clipboardText = event.clipboardData?.getData("text/plain");
      if (!clipboardText) {
        return;
      }

      event.preventDefault();
      const normalized = clipboardText.replace(/\r\n/g, "\n");
      setText(normalized);
      setHasReceivedPaste(true);
      setErrorMessage(null);

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }

        textarea.focus();
        const length = textarea.value.length;
        textarea.setSelectionRange(length, length);
      });
    }

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, []);

  function focusTextarea() {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setText(event.target.value);
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (event.target.value.length === 0) {
      setHasReceivedPaste(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const normalized = text.replace(/\r\n/g, "\n");
    const cleaned = normalized.trim();

    if (cleaned.length === 0) {
      setErrorMessage("내용을 입력하거나 붙여넣어 주세요.");
      focusTextarea();
      return;
    }

    if (cleaned.length > CHARACTER_LIMIT) {
      setErrorMessage(
        `텍스트는 최대 ${CHARACTER_LIMIT.toLocaleString("ko-KR")}자까지 업로드할 수 있습니다.`,
      );
      focusTextarea();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/boards/${encodeURIComponent(boardSlug)}/channels/${encodeURIComponent(channelSlug)}/items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: cleaned }),
        },
      );

      if (!response.ok) {
        let message = "텍스트를 업로드하지 못했습니다.";
        try {
          const data = (await response.json()) as { error?: unknown };
          if (data && typeof data.error === "string" && data.error.length > 0) {
            message = data.error;
          }
        } catch (error) {
          // 응답이 JSON이 아니라면 기본 메시지를 유지합니다.
        }

        setErrorMessage(message);
        return;
      }

      setText("");
      setHasReceivedPaste(false);
      router.refresh();
    } catch (error) {
      setErrorMessage("네트워크 오류로 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
      focusTextarea();
    }
  }

  let hintMessage = "복사한 텍스트를 Ctrl+V로 붙여넣어 보세요.";
  if (errorMessage) {
    hintMessage = errorMessage;
  } else if (isOverLimit) {
    hintMessage = `텍스트는 최대 ${CHARACTER_LIMIT.toLocaleString("ko-KR")}자까지 업로드할 수 있습니다. 현재 ${trimmedText.length.toLocaleString("ko-KR")}자입니다.`;
  } else if (trimmedText.length > 0) {
    hintMessage = "Ctrl+Enter 또는 ⌘+Enter로 바로 업로드할 수 있습니다.";
  } else if (hasReceivedPaste) {
    hintMessage = "붙여넣은 텍스트가 비어 있습니다. 다시 시도해 주세요.";
  }

  const hintClassName = errorMessage || isOverLimit
    ? "composer-hint composer-hint--error"
    : "composer-hint";

  const isSubmitDisabled =
    isSubmitting || trimmedText.length === 0 || isOverLimit;

  const counterClassName = isOverLimit
    ? "composer-counter composer-counter--alert"
    : "composer-counter";

  return (
    <form
      className="channel-composer"
      onSubmit={handleSubmit}
      aria-labelledby={`${hintId}-title`}
    >
      <div className="composer-header">
        <h2 id={`${hintId}-title`} className="composer-title">
          텍스트 붙여넣기
        </h2>
        <p className="composer-subtitle">
          <span className="composer-channel">
            <span aria-hidden>#</span>
            {channelName}
          </span>
          <span> 채널로 업로드합니다.</span>
        </p>
      </div>
      <textarea
        ref={textareaRef}
        className="composer-textarea"
        placeholder="Ctrl+V로 붙여넣거나 직접 입력하세요."
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-describedby={hintId}
        aria-invalid={errorMessage || isOverLimit ? "true" : "false"}
        spellCheck={false}
        rows={3}
      />
      <p id={hintId} className={hintClassName} aria-live="polite">
        {hintMessage}
      </p>
      <div className="composer-actions">
        <span className={counterClassName} aria-live="polite">
          {characterCount.toLocaleString("ko-KR")}자
        </span>
        <button
          type="submit"
          className="composer-submit"
          disabled={isSubmitDisabled}
        >
          {isSubmitting ? "업로드 중..." : "텍스트 업로드"}
        </button>
      </div>
    </form>
  );
}
