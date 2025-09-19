"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CHARACTER_LIMIT = 4000;
const BASE_HINT =
  "복사한 텍스트를 Ctrl+V 또는 ⌘+V로 붙여넣으면 바로 업로드합니다.";

type ComposerStatus = "idle" | "uploading" | "success" | "error";

type ChannelComposerProps = {
  boardSlug: string;
  channelSlug: string;
  channelName: string;
};

type PreviewState = {
  snippet: string;
  length: number;
  truncated: boolean;
};

function formatCount(count: number): string {
  return count.toLocaleString("ko-KR");
}

function buildPreview(text: string): PreviewState {
  const limit = 160;
  if (text.length <= limit) {
    return { snippet: text, length: text.length, truncated: false };
  }

  return {
    snippet: text.slice(0, limit),
    length: text.length,
    truncated: true,
  };
}

export function ChannelComposer({
  boardSlug,
  channelSlug,
  channelName,
}: ChannelComposerProps) {
  const router = useRouter();
  const headingId = useId();

  const [status, setStatus] = useState<ComposerStatus>("idle");
  const [hint, setHint] = useState(BASE_HINT);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const resetTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const isUploadingRef = useRef(false);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const setStatusWithHint = useCallback(
    (nextStatus: ComposerStatus, message: string) => {
      if (!isMountedRef.current) {
        return;
      }

      clearResetTimer();
      setStatus(nextStatus);
      setHint(message);

      if (nextStatus === "success" || nextStatus === "error") {
        resetTimerRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) {
            return;
          }
          setStatus("idle");
          setHint(BASE_HINT);
        }, 3600);
      }
    },
    [clearResetTimer],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearResetTimer();
      abortControllerRef.current?.abort();
    };
  }, [clearResetTimer]);

  const uploadText = useCallback(
    async (textToUpload: string) => {
      if (!isMountedRef.current) {
        return;
      }

      const previewState = buildPreview(textToUpload);
      setPreview(previewState);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      isUploadingRef.current = true;

      const lengthLabel = formatCount(textToUpload.length);
      setStatusWithHint(
        "uploading",
        `텍스트 ${lengthLabel}자를 업로드하는 중입니다...`,
      );

      try {
        const response = await fetch(
          `/api/boards/${encodeURIComponent(boardSlug)}/channels/${encodeURIComponent(channelSlug)}/items`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: textToUpload }),
            signal: abortController.signal,
          },
        );

        if (!response.ok) {
          let message = "텍스트를 업로드하지 못했습니다.";
          try {
            const data = (await response.json()) as { error?: unknown };
            if (
              data &&
              typeof data.error === "string" &&
              data.error.trim().length > 0
            ) {
              message = data.error;
            }
          } catch (error) {
            // 응답이 JSON이 아니라면 기본 메시지를 유지합니다.
          }

          setStatusWithHint("error", message);
          return;
        }

        setStatusWithHint(
          "success",
          `텍스트 ${lengthLabel}자를 업로드했습니다!`,
        );
        if (isMountedRef.current) {
          router.refresh();
        }
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError") {
          return;
        }
        setStatusWithHint(
          "error",
          "네트워크 오류로 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        isUploadingRef.current = false;
      }
    },
    [boardSlug, channelSlug, router, setStatusWithHint],
  );

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

      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      if (clipboardData.files && clipboardData.files.length > 0) {
        event.preventDefault();
        setStatusWithHint(
          "error",
          "현재는 텍스트 붙여넣기만 지원합니다. 파일은 드롭 영역을 통해 업로드해 주세요.",
        );
        return;
      }

      const rawText = clipboardData.getData("text/plain");
      if (!rawText) {
        return;
      }

      event.preventDefault();

      if (isUploadingRef.current) {
        setStatusWithHint(
          "uploading",
          "이전 붙여넣기를 처리하는 중입니다. 잠시만 기다려 주세요.",
        );
        return;
      }

      const normalized = rawText.replace(/\r\n/g, "\n");
      const trimmed = normalized.trim();

      if (trimmed.length === 0) {
        setStatusWithHint("error", "붙여넣은 텍스트가 비어 있습니다.");
        return;
      }

      if (normalized.length > CHARACTER_LIMIT) {
        setPreview(buildPreview(normalized));
        setStatusWithHint(
          "error",
          `텍스트는 최대 ${formatCount(CHARACTER_LIMIT)}자까지 업로드할 수 있습니다. (현재 ${formatCount(normalized.length)}자)`,
        );
        return;
      }

      uploadText(normalized);
    }

    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [setStatusWithHint, uploadText]);

  const statusClassName = [
    "composer-status",
    status === "success"
      ? "composer-status--success"
      : status === "error"
        ? "composer-status--error"
        : status === "uploading"
          ? "composer-status--active"
          : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className="channel-composer"
      aria-labelledby={`${headingId}-title`}
    >
      <div className="composer-header">
        <h2 id={`${headingId}-title`} className="composer-title">
          텍스트 붙여넣기
        </h2>
        <p className="composer-subtitle">
          <span className="composer-channel">
            <span aria-hidden>#</span>
            {channelName}
          </span>
          <span> 채널로 붙여넣은 텍스트를 즉시 업로드합니다.</span>
        </p>
      </div>
      <div className="composer-shortcuts" aria-hidden>
        <div className="composer-shortcuts-keys">
          <kbd>Ctrl</kbd>
          <span className="composer-key-plus">+</span>
          <kbd>V</kbd>
        </div>
        <span className="composer-shortcuts-separator">또는</span>
        <div className="composer-shortcuts-keys">
          <kbd>⌘</kbd>
          <span className="composer-key-plus">+</span>
          <kbd>V</kbd>
        </div>
      </div>
      <p
        className={statusClassName}
        role="status"
        aria-busy={status === "uploading" ? "true" : "false"}
      >
        {hint}
      </p>
      {preview ? (
        <div className="composer-preview">
          <span className="composer-preview-label">
            마지막 붙여넣기 · {formatCount(preview.length)}자
          </span>
          <pre className="composer-preview-text">{preview.snippet}</pre>
          {preview.truncated ? (
            <span className="composer-preview-more">
              전체 내용은 메시지 목록에서 확인할 수 있습니다.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
