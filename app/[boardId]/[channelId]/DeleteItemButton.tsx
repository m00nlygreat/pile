"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export default function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  const resetConfirmState = () => {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }

    setConfirming(false);
  };

  const requestConfirmState = () => {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
    }

    setConfirming(true);
    confirmTimeoutRef.current = setTimeout(() => {
      setConfirming(false);
      confirmTimeoutRef.current = null;
    }, 3500);
  };

  const handleDelete = () => {
    if (!confirming) {
      requestConfirmState();
      return;
    }

    resetConfirmState();

    startTransition(async () => {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        console.error("아이템 삭제 실패", await response.json().catch(() => null));
        return;
      }

      router.refresh();
    });
  };

  const handleReset = () => {
    if (pending) {
      return;
    }

    resetConfirmState();
  };

  const label = pending
    ? "삭제 중"
    : confirming
      ? "정말 삭제할까요? 다시 클릭하면 삭제됩니다"
      : "아이템 삭제";

  return (
    <button
      type="button"
      className="item-delete-button"
      disabled={pending}
      onClick={handleDelete}
      onMouseLeave={handleReset}
      onBlur={handleReset}
      aria-label={label}
      data-state={pending ? "pending" : confirming ? "confirm" : "idle"}
    >
      <span aria-hidden="true">
        {pending ? <SpinnerIcon /> : confirming ? <ConfirmIcon /> : <TrashIcon />}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="item-delete-spinner">
      <path d="M21 12a9 9 0 1 1-9-9" />
    </svg>
  );
}

function ConfirmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 22h20L12 2z" />
      <line x1="12" y1="9" x2="12" y2="13.5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
