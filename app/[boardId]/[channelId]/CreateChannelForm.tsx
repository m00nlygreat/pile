"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function CreateChannelForm({
  boardSlug,
  className,
  onSuccess,
  onCancel,
}: {
  boardSlug: string;
  className?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const formClassName = ["channel-create-form", className].filter(Boolean).join(" ");

  return (
    <form
      className={formClassName}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) {
          return;
        }

        const trimmed = name.trim();
        if (trimmed.length === 0) {
          setError("채널 이름을 입력해주세요.");
          return;
        }

        startTransition(async () => {
          setError(null);
          const response = await fetch(`/api/boards/${boardSlug}/channels`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ name: trimmed }),
          });

          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { error?: string } | null;
            setError(body?.error ?? "채널을 추가하지 못했습니다.");
            return;
          }

          setName("");
          onSuccess?.();
          router.refresh();
        });
      }}
    >
      <h3>새 채널 추가</h3>
      <label className="stack">
        <span>채널 이름</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          placeholder="예: 과제 제출"
          required
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="channel-create-actions">
        <button type="submit" disabled={pending}>
          {pending ? "추가 중" : "채널 추가"}
        </button>
        {onCancel ? (
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              if (!pending) {
                onCancel();
              }
            }}
          >
            취소
          </button>
        ) : null}
      </div>
    </form>
  );
}
