"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="item-delete-button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("이 아이템을 삭제할까요?")) {
          return;
        }

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
      }}
      aria-label={pending ? "삭제 중" : "아이템 삭제"}
      data-state={pending ? "pending" : "idle"}
    >
      <span aria-hidden="true">{pending ? <SpinnerIcon /> : <TrashIcon />}</span>
      <span className="sr-only">{pending ? "삭제 중" : "아이템 삭제"}</span>
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
