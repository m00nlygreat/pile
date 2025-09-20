"use client";

import { useEffect, useRef, useState } from "react";
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
  const isPostingRef = useRef(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          void submitImage(file);
          return;
        }
      }

      const text = event.clipboardData?.getData("text/plain") ?? "";
      const normalized = text.replace(/\r\n/g, "\n").trim();

      if (!normalized) {
        return;
      }

      if (isLikelyUrl(normalized)) {
        event.preventDefault();
        void submitLink(normalized);
        return;
      }

      void submitText(normalized);
    }

    async function submitText(content: string) {
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
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
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
    }

    async function submitLink(urlValue: string) {
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
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
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
    }

    async function submitImage(file: File) {
      if (isPostingRef.current) {
        return;
      }

      isPostingRef.current = true;
      updateStatus("posting", null);

      const formData = new FormData();
      formData.append("type", "file");
      if (channelId) {
        formData.append("channelId", channelId);
      }

      const fileName = deriveFileName(file);
      formData.append("file", file, fileName);

      try {
        const response = await fetch(`/api/boards/${boardSlug}/items`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
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
    }

    function updateStatus(nextStatus: PasteStatus, nextMessage: string | null) {
      setMessage(nextMessage);

      if (nextStatus === "success" || nextStatus === "error") {
        triggerBodyPulse(nextStatus);
      }

      if (nextStatus === "error" && nextMessage) {
        if (errorTimeoutRef.current) {
          clearTimeout(errorTimeoutRef.current);
        }

        errorTimeoutRef.current = setTimeout(() => {
          setMessage(null);
          errorTimeoutRef.current = null;
        }, successTimeoutMs);
      }
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, [boardSlug, channelId, router]);

  return (
    <div className="sr-only" aria-live="polite">
      {message}
    </div>
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

  // Allow URLs without protocol but with www.
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
    tint = "radial-gradient(circle at top, rgba(34, 197, 94, 0.18) 0%, rgba(5, 11, 22, 1) 70%)";
  } else if (status === "error") {
    tint = "radial-gradient(circle at top, rgba(248, 113, 113, 0.24) 0%, rgba(5, 11, 22, 1) 70%)";
  }

  if (!tint) {
    return;
  }

  body.style.setProperty("--bg-current", tint);

  if (bodyPulseTimeout) {
    clearTimeout(bodyPulseTimeout);
  }

  const duration = status === "error" ? 900 : 650;

  bodyPulseTimeout = setTimeout(() => {
    body.style.setProperty("--bg-current", "var(--bg-base)");
    bodyPulseTimeout = null;
  }, duration);
}
