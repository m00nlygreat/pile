"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AdminLoginForm({
  adminName,
}: {
  adminName: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) {
          return;
        }

        const trimmed = password.trim();
        if (trimmed.length === 0) {
          setError("비밀번호를 입력해주세요.");
          return;
        }

        startTransition(async () => {
          setError(null);
          const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ password: trimmed }),
          });

          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            setError(body?.error ?? "로그인에 실패했습니다.");
            return;
          }

          setPassword("");
          router.refresh();
        });
      }}
    >
      <h2>관리자 로그인</h2>
      <p className="panel-muted">
        관리자 비밀번호를 입력하면 <strong>{adminName}</strong> 이름으로 관리자 권한이 활성화됩니다.
      </p>
      <label className="stack">
        <span>비밀번호</span>
        <input
          type="password"
          value={password}
          disabled={pending}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="관리자 비밀번호"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? "확인 중" : "로그인"}
      </button>
    </form>
  );
}
