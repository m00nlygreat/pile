"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const successTimeoutMs = 1800;

type PasteCaptureProps = {
  boardSlug: string;
  channelId?: string | null;
};

type PasteStatus = "idle" | "posting" | "success" | "error";

let bodyPulseTimeout: ReturnType<typeof setTimeout> | null = null;

export default function PasteCapture({ boardSlug, channelId }: PasteCaptureProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<PasteStatus>("idle");
  const [isDropActive, setIsDropActive] = useState(false);
  const isPostingRef = useRef(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounterRef = useRef(0);

  const updateStatus = useCallback((nextStatus: PasteStatus, nextMessage: string | null) => {
    setStatus(nextStatus);
    setMessage(nextMessage);

    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }

    if (statusResetTimeoutRef.current) {
      clearTimeout(statusResetTimeoutRef.current);
      statusResetTimeoutRef.current = null;
    }

    if (nextStatus === "success" || nextStatus === "error") {
      triggerBodyPulse(nextStatus);
      statusResetTimeoutRef.current = setTimeout(() => {
        setStatus("idle");
        statusResetTimeoutRef.current = null;
      }, successTimeoutMs);
    }

    if (nextStatus === "error" && nextMessage) {
      errorTimeoutRef.current = setTimeout(() => {
        setMessage(null);
        errorTimeoutRef.current = null;
      }, successTimeoutMs);
    }
  }, []);

  const submitText = useCallback(
    async (content: string) => {
      if (isPostingRef.current) {
        return;
      }

      isPostingRef.current = true;
      updateStatus("posting", null);

      try {
        const response = await fetch(`/api/boards/${boardSlug}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildJsonPayload({ type: "text", text: content, channelId })),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          updateStatus("error", data?.error ?? null);
          return;
        }

        updateStatus("success", null);
        router.refresh();
      } catch (error) {
        updateStatus("error", "네트워크 오류가 발생했습니다.");
      } finally {
        isPostingRef.current = false;
      }
    },
    [boardSlug, channelId, router, updateStatus],
  );

  const submitLink = useCallback(
    async (urlValue: string) => {
      if (isPostingRef.current) {
        return;
      }

      isPostingRef.current = true;
      updateStatus("posting", null);

      const preparedUrl =
        /^https?:\/\//i.test(urlValue) ? urlValue : `https://${urlValue.replace(/^\/*/, "")}`;

      try {
        const response = await fetch(`/api/boards/${boardSlug}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildJsonPayload({ type: "link", url: preparedUrl, channelId })),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          updateStatus("error", data?.error ?? null);
          return;
        }

        updateStatus("success", null);
        router.refresh();
      } catch (error) {
        updateStatus("error", "네트워크 오류가 발생했습니다.");
      } finally {
        isPostingRef.current = false;
      }
    },
    [boardSlug, channelId, router, updateStatus],
  );

  const submitFiles = useCallback(
    async (files: File[]) => {
      const validFiles = files.filter((file) => file && file.size > 0);
      if (validFiles.length === 0) {
        return;
      }

      if (isPostingRef.current) {
        return;
      }

      isPostingRef.current = true;
      updateStatus("posting", null);

      try {
        let hasError = false;
        let successCount = 0;

        for (const file of validFiles) {
          const formData = new FormData();
          formData.append("type", "file");
          if (channelId) {
            formData.append("channelId", channelId);
          }

          const fileName = deriveFileName(file);
          formData.append("file", file, fileName);

          const response = await fetch(`/api/boards/${boardSlug}/items`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            updateStatus("error", data?.error ?? null);
            hasError = true;
            break;
          }

          successCount += 1;
        }

        if (hasError) {
          if (successCount > 0) {
            router.refresh();
          }
          return;
        }

        if (successCount > 0) {
          updateStatus("success", null);
          router.refresh();
        }
      } catch (error) {
        updateStatus("error", "네트워크 오류가 발생했습니다.");
      } finally {
        isPostingRef.current = false;
      }
    },
    [boardSlug, channelId, router, updateStatus],
  );

  const processClipboardText = useCallback(
    (text: string): "link" | "text" | null => {
      const normalized = text.replace(/\r\n/g, "\n").trim();

      if (!normalized) {
        return null;
      }

      if (isLikelyUrl(normalized)) {
        void submitLink(normalized);
        return "link";
      }

      void submitText(normalized);
      return "text";
    },
    [submitLink, submitText],
  );

  const handleManualPasteClick = useCallback(async () => {
    if (isPostingRef.current) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      updateStatus("error", "브라우저가 클립보드 읽기를 지원하지 않아요.");
      return;
    }

    try {
      const clipboard = navigator.clipboard as Clipboard & {
        read?: () => Promise<ClipboardItem[]>;
        readText?: () => Promise<string>;
      };

      if (typeof clipboard.read === "function") {
        const items = await clipboard.read();
        const imageFiles: File[] = [];
        let textCandidate: string | null = null;

        for (const item of items) {
          const imageType = item.types.find((type) => type.toLowerCase().startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const mime = blob.type || imageType;
            const file = new File([blob], buildClipboardFileName(mime), { type: mime });
            imageFiles.push(file);
            continue;
          }

          if (item.types.includes("text/plain")) {
            const blob = await item.getType("text/plain");
            const text = await blob.text();
            if (text && text.trim().length > 0) {
              textCandidate = text;
            }
          }
        }

        if (imageFiles.length > 0) {
          await submitFiles(imageFiles);
          return;
        }

        if (textCandidate !== null && processClipboardText(textCandidate)) {
          return;
        }
      }

      if (typeof clipboard.readText === "function") {
        const text = await clipboard.readText();
        if (processClipboardText(text)) {
          return;
        }
      }

      updateStatus("error", "클립보드에서 붙여넣을 수 있는 내용을 찾지 못했어요.");
    } catch (error) {
      if (isClipboardPermissionError(error)) {
        updateStatus("error", "브라우저에서 붙여넣기 권한을 허용해주세요.");
        return;
      }

      updateStatus("error", "클립보드를 읽는 중 오류가 발생했습니다.");
    }
  }, [processClipboardText, submitFiles, updateStatus]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (shouldIgnorePasteTarget()) {
        return;
      }

      const clipboardItems = Array.from(event.clipboardData?.items ?? []);
      const imageItem = clipboardItems.find(
        (item) => item.kind === "file" && item.type.toLowerCase().startsWith("image/"),
      );

      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          event.preventDefault();
          void submitFiles([file]);
          return;
        }
      }

      const text = event.clipboardData?.getData("text/plain") ?? "";
      const outcome = processClipboardText(text);
      if (outcome === "link") {
        event.preventDefault();
      }
    }

    function hasFilePayload(event: DragEvent): boolean {
      const types = event.dataTransfer?.types;
      if (!types) {
        return false;
      }

      for (let index = 0; index < types.length; index += 1) {
        if (types[index] === "Files") {
          return true;
        }
      }

      return false;
    }

    function handleDragEnter(event: DragEvent) {
      if (!hasFilePayload(event) || shouldIgnoreDropTarget(event.target)) {
        return;
      }

      dragCounterRef.current += 1;
      setIsDropActive(true);
      event.preventDefault();
    }

    function handleDragOver(event: DragEvent) {
      if (!hasFilePayload(event) || shouldIgnoreDropTarget(event.target)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    }

    function handleDragLeave(event: DragEvent) {
      if (!hasFilePayload(event)) {
        return;
      }

      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDropActive(false);
      }
    }

    function handleDrop(event: DragEvent) {
      if (!hasFilePayload(event) || shouldIgnoreDropTarget(event.target)) {
        return;
      }

      event.preventDefault();
      dragCounterRef.current = 0;
      setIsDropActive(false);

      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file && file.size > 0);
      if (files.length > 0) {
        void submitFiles(files);
      }
    }

    window.addEventListener("paste", handlePaste);
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
        statusResetTimeoutRef.current = null;
      }
      dragCounterRef.current = 0;
    };
  }, [processClipboardText, submitFiles]);

  const buttonLabel =
    status === "posting"
      ? "붙여넣는 중..."
      : status === "success"
        ? "붙여넣었어요!"
        : status === "error"
          ? "다시 시도하기"
          : "붙여넣기";

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {message}
      </div>
      {isDropActive ? (
        <div className="drop-overlay" role="presentation">
          <div className="drop-overlay-card">
            <span className="drop-overlay-label">파일을 놓으면 업로드합니다</span>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="mobile-paste-button"
        data-status={status}
        onClick={() => {
          void handleManualPasteClick();
        }}
        aria-busy={status === "posting"}
        disabled={status === "posting"}
      >
        <span className="mobile-paste-button-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" role="img">
            <path
              d="M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="8"
              y="2"
              width="8"
              height="4"
              rx="1"
              ry="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 10.5v5.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="m10 13.9 2 1.9 2-1.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="mobile-paste-button-label">{buttonLabel}</span>
      </button>
    </>
  );
}

function buildJsonPayload(
  payload:
    | { type: "text"; text: string; channelId?: string | null }
    | { type: "link"; url: string; channelId?: string | null },
): Record<string, unknown> {
  const { channelId, ...rest } = payload;
  return channelId ? { ...rest, channelId } : rest;
}

function shouldIgnoreDropTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const interactive = target.closest("input, textarea, [contenteditable='true'], [contenteditable='']");
  return Boolean(interactive);
}

function shouldIgnorePasteTarget(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const active = document.activeElement as HTMLElement | null;
  if (!active) {
    return false;
  }

  const tagName = active.tagName?.toLowerCase();
  if (tagName === "input" || tagName === "textarea") {
    return true;
  }

  if (active.isContentEditable) {
    return true;
  }

  return false;
}

function isLikelyUrl(value: string): boolean {
  if (!value || value.length > 2048) {
    return false;
  }

  if (/^https?:\/\//i.test(value)) {
    return true;
  }

  if (/^www\.[^\s]+\.[a-z]{2,}$/i.test(value)) {
    return true;
  }

  return false;
}

function deriveFileName(file: File): string {
  if (file.name && file.name.trim().length > 0) {
    return file.name;
  }

  const mime = (file.type || "").toLowerCase();

  if (mime === "image/png") {
    return `clipboard-${Date.now()}.png`;
  }

  if (mime === "image/jpeg" || mime === "image/jpg") {
    return `clipboard-${Date.now()}.jpg`;
  }

  if (mime === "image/gif") {
    return `clipboard-${Date.now()}.gif`;
  }

  if (mime === "image/webp") {
    return `clipboard-${Date.now()}.webp`;
  }

  if (mime === "image/svg+xml") {
    return `clipboard-${Date.now()}.svg`;
  }

  return `clipboard-${Date.now()}.png`;
}

function buildClipboardFileName(mime: string): string {
  const normalized = (mime || "").toLowerCase();

  if (normalized === "image/png") {
    return `clipboard-${Date.now()}.png`;
  }

  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return `clipboard-${Date.now()}.jpg`;
  }

  if (normalized === "image/gif") {
    return `clipboard-${Date.now()}.gif`;
  }

  if (normalized === "image/webp") {
    return `clipboard-${Date.now()}.webp`;
  }

  if (normalized === "image/svg+xml") {
    return `clipboard-${Date.now()}.svg`;
  }

  return `clipboard-${Date.now()}.png`;
}

function isClipboardPermissionError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError" || error.name === "NotFoundError")
  );
}

function triggerBodyPulse(status: PasteStatus) {
  if (typeof document === "undefined") {
    return;
  }

  const body = document.body;
  if (!body) {
    return;
  }

  let tint: string | null = null;
  if (status === "success") {
    tint = "rgba(34, 197, 94, 0.32)";
  } else if (status === "error") {
    tint = "rgba(248, 113, 113, 0.4)";
  }

  if (!tint) {
    return;
  }

  body.style.setProperty("--bg-pulse-color", tint);
  body.style.setProperty("--bg-pulse-opacity", "1");

  if (bodyPulseTimeout) {
    clearTimeout(bodyPulseTimeout);
  }

  const duration = status === "error" ? 900 : 650;

  bodyPulseTimeout = setTimeout(() => {
    body.style.setProperty("--bg-pulse-opacity", "0");
    bodyPulseTimeout = null;
  }, duration);
}
