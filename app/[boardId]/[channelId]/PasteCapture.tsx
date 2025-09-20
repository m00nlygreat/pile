"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const successTimeoutMs = 1800;

type PasteCaptureProps = {
  boardSlug: string;
  channelId: string;
};

type PasteStatus = "idle" | "posting" | "success" | "error";

export default function PasteCapture({ boardSlug, channelId }: PasteCaptureProps) {
  const router = useRouter();
  const [status, setStatus] = useState<PasteStatus>("idle");
  const [message, setMessage] = useState(
    "이 채널에서 붙여넣으면 즉시 아이템이 생성됩니다.",
  );
  const isPostingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      updateStatus("posting", "붙여넣은 텍스트를 업로드하는 중입니다...");

      try {
        const response = await fetch(`/api/boards/${boardSlug}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "text",
            text: content,
            channelId,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          updateStatus("error", data?.error ?? "아이템 생성에 실패했습니다.");
          return;
        }

        updateStatus("success", "텍스트가 업로드되었어요.");
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
      updateStatus("posting", "붙여넣은 링크를 분석하는 중입니다...");

      const preparedUrl =
        /^https?:\/\//i.test(urlValue) ? urlValue : `https://${urlValue.replace(/^\/*/, "")}`;

      try {
        const response = await fetch(`/api/boards/${boardSlug}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "link",
            url: preparedUrl,
            channelId,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          updateStatus("error", data?.error ?? "링크 업로드에 실패했습니다.");
          return;
        }

        updateStatus("success", "링크가 업로드되었어요.");
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
      updateStatus("posting", "붙여넣은 이미지를 업로드하는 중입니다...");

      const formData = new FormData();
      formData.append("type", "file");
      formData.append("channelId", channelId);

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
          updateStatus("error", data?.error ?? "이미지 업로드에 실패했습니다.");
          return;
        }

        updateStatus("success", "이미지가 업로드되었어요.");
        router.refresh();
      } catch (error) {
        updateStatus("error", "네트워크 오류가 발생했습니다.");
      } finally {
        isPostingRef.current = false;
      }
    }

    function updateStatus(nextStatus: PasteStatus, nextMessage: string) {
      setStatus(nextStatus);
      setMessage(nextMessage);

      if (nextStatus === "success") {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          setStatus("idle");
          setMessage("다음 붙여넣기도 곧바로 등록됩니다.");
          timeoutRef.current = null;
        }, successTimeoutMs);
      }
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [boardSlug, channelId, router]);

  return (
    <div className={`paste-indicator paste-indicator-${status}`} aria-live="polite">
      {message}
    </div>
  );
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
