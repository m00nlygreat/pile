"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const maxNameLength = 30;

export type ViewerProfile = {
  anonId: string;
  nickname: string;
  displayName: string | null;
};

type PatchResponse = {
  ok?: boolean;
  anonId?: string;
  nickname?: string | null;
  displayName?: string | null;
  error?: string;
};

type GetResponse = {
  ok?: boolean;
  anonId?: string;
  nickname?: string | null;
  displayName?: string | null;
  error?: string;
};

export default function ViewerNameBadge({
  profile,
  viewerIsAdmin,
}: {
  profile: ViewerProfile | null;
  viewerIsAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profileState, setProfileState] = useState<ViewerProfile | null>(profile);
  const effectiveProfile = profileState ?? profile;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDisplayName, setCurrentDisplayName] = useState(effectiveProfile?.displayName ?? "");
  const [inputValue, setInputValue] = useState(effectiveProfile?.displayName ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const displayFallback = effectiveProfile?.nickname ?? "익명 사용자";

  useEffect(() => {
    setProfileState(profile);
    setCurrentDisplayName(profile?.displayName ?? "");
    setInputValue(profile?.displayName ?? "");
    setEditing(false);
    setError(null);
  }, [profile]);

  const resolvedAnonId = effectiveProfile?.anonId ?? null;

  useEffect(() => {
    if (resolvedAnonId) {
      return;
    }

    let cancelled = false;

    const ensureProfile = async (attempt = 0): Promise<void> => {
      if (cancelled) {
        return;
      }

      try {
        const profileResponse = await fetch("/api/anon/profile", { method: "GET", cache: "no-store" });

        if (profileResponse.status === 401 && attempt < 2) {
          await fetch("/api/anon/identify", {
            method: "POST",
            cache: "no-store",
          });

          await new Promise((resolve) => setTimeout(resolve, 120));
          return ensureProfile(attempt + 1);
        }

        if (!profileResponse.ok) {
          return;
        }

        const data = (await profileResponse.json().catch(() => null)) as GetResponse | null;
        if (!data?.anonId || cancelled) {
          return;
        }

        const nextProfile: ViewerProfile = {
          anonId: data.anonId,
          nickname: data.nickname ?? "익명 사용자",
          displayName: data.displayName ?? null,
        };

        setProfileState(nextProfile);
        setCurrentDisplayName(nextProfile.displayName ?? "");
        setInputValue(nextProfile.displayName ?? "");
      } catch {
        // ignore fetch errors; user can retry via manual refresh
      }
    };

    void ensureProfile();

    return () => {
      cancelled = true;
    };
  }, [resolvedAnonId]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const label = currentDisplayName.trim().length > 0 ? currentDisplayName : displayFallback;

  if (viewerIsAdmin) {
    return (
      <div className="board-anon-badge">
        <button
          type="button"
          className="anon-name-button anon-name-button-logout"
          onClick={async () => {
            if (saving) {
              return;
            }

            setSaving(true);
            setError(null);

            try {
              await fetch("/api/admin/logout", {
                method: "POST",
                credentials: "same-origin",
              });
              if (pathname) {
                router.push(pathname);
              }
              router.refresh();
            } catch {
              setError("로그아웃에 실패했습니다.");
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
        >
          <span className="anon-name-label">로그아웃</span>
        </button>
        {error ? <p className="anon-name-error">{error}</p> : null}
      </div>
    );
  }

  async function commit(nextValue: string) {
    const anonId = effectiveProfile?.anonId;
    if (!anonId) {
      setEditing(false);
      return;
    }

    const trimmed = nextValue.trim();

    if (saving) {
      return;
    }

    if (trimmed === currentDisplayName.trim()) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/anon/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName: trimmed.length === 0 ? null : trimmed }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as PatchResponse | null;
        setError(body?.error ?? "이름을 저장하지 못했습니다.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as PatchResponse | null;
      const nextDisplay = payload?.displayName ?? "";
      const nextNickname = payload?.nickname ?? effectiveProfile?.nickname ?? "익명 사용자";
      const nextAnonId = payload?.anonId ?? anonId;

      const nextProfile: ViewerProfile = {
        anonId: nextAnonId,
        nickname: nextNickname,
        displayName: nextDisplay.length > 0 ? nextDisplay : null,
      };

      setProfileState(nextProfile);
      setCurrentDisplayName(nextDisplay);
      setInputValue(nextDisplay);
      setEditing(false);
      router.refresh();
    } catch (error) {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const hasProfile = Boolean(effectiveProfile?.anonId);

  return (
    <div className={`board-anon-badge${editing ? " board-anon-badge-editing" : ""}`}>
      {editing && hasProfile ? (
        <form
          className="anon-name-form"
          onSubmit={(event) => {
            event.preventDefault();
            void commit(inputValue);
          }}
        >
          <input
            ref={inputRef}
            className="anon-name-input"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            maxLength={maxNameLength}
            placeholder="이름을 입력하세요"
            disabled={saving}
            onBlur={() => {
              if (!saving) {
                void commit(inputValue);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setEditing(false);
                setInputValue(currentDisplayName);
                setError(null);
              }
            }}
            aria-label="익명 이름 변경"
          />
          <button type="submit" className="anon-name-save" disabled={saving}>
            {saving ? "저장 중" : "저장"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="anon-name-button"
          onClick={() => {
            if (!hasProfile) {
              return;
            }
            setEditing(true);
            setInputValue(currentDisplayName || displayFallback);
          }}
          disabled={!hasProfile}
        >
          <span className="anon-name-label">{label}</span>
        </button>
      )}
      {error ? <p className="anon-name-error">{error}</p> : null}
    </div>
  );
}
