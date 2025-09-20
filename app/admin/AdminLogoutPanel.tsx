"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function AdminLogoutPanel({
  adminName,
}: {
  adminName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section className="panel">
      <h2>관리자 모드</h2>
      <p className="panel-muted">
        <strong>{adminName}</strong>님, 현재 관리자 권한이 활성화되어 있습니다.
      </p>
      <button
        type="button"
        className="ghost-button"
        disabled={pending}
        onClick={() => {
          if (pending) {
            return;
          }

          startTransition(async () => {
            const response = await fetch("/api/admin/logout", {
              method: "POST",
              credentials: "include",
            });

            if (!response.ok) {
              return;
            }

            router.refresh();
          });
        }}
      >
        {pending ? "로그아웃 중" : "로그아웃"}
      </button>
    </section>
  );
}
