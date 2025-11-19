"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type BoardUrlHeaderProps = {
  boardUrl: string;
  boardSlug: string;
};

export default function BoardUrlHeader({ boardUrl, boardSlug }: BoardUrlHeaderProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(boardUrl, {
      margin: 1,
      width: 560,
      color: { dark: "#020617", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardUrl]);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dialogOpen]);

  const displayOrigin = useMemo(() => {
    try {
      const parsed = new URL(boardUrl);
      return `${parsed.protocol}//${parsed.host}/`;
    } catch {
      if (boardUrl.endsWith(boardSlug)) {
        const withoutSlug = boardUrl.slice(0, boardUrl.length - boardSlug.length);
        return withoutSlug.endsWith("/") ? withoutSlug : `${withoutSlug}/`;
      }

      return "";
    }
  }, [boardUrl, boardSlug]);

  const showDialog = () => setDialogOpen(true);
  const hideDialog = () => setDialogOpen(false);

  return (
    <>
      <div className="board-url">
        <button
          type="button"
          className="board-url-qr-button"
          onClick={showDialog}
          aria-label="보드 QR 코드 보기"
        >
          <span aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" role="presentation">
              <path
                d="M2.25 2.25h4.5v4.5h-4.5zM11.25 2.25h4.5v4.5h-4.5zM2.25 11.25h4.5v4.5h-4.5zM11.25 11.25h1.5v-1.5h3v1.5h-1.5v1.5h1.5v3h-1.5v-1.5h-1.5v1.5h-1.5v-3h1.5v-1.5h-1.5z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </span>
        </button>
        <span className="board-path" aria-label="보드 주소">
          <span className="board-path-domain">{displayOrigin}</span>
          <span className="board-path-slug">{boardSlug}</span>
        </span>
      </div>

      {dialogOpen ? (
        <div className="board-qr-overlay" role="dialog" aria-modal="true" onClick={hideDialog}>
          <div
            className="board-qr-card"
            onClick={(event) => event.stopPropagation()}
            aria-live="polite"
          >
            <div className="board-qr-image">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="현재 보드를 여는 QR 코드" width="240" height="240" />
              ) : (
                <span className="board-qr-loading">QR 코드를 만드는 중…</span>
              )}
            </div>
            <code className="board-qr-link">{boardUrl}</code>
            <button type="button" className="ghost-button board-qr-close" onClick={hideDialog}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
