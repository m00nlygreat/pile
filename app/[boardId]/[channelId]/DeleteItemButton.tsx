"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="ghost-button"
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
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
