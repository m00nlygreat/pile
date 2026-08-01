"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { I } from "@/components/icons";
import { forgetBoard, readRecentBoards } from "@/lib/recent-boards";
import type { BoardSummary } from "@/lib/types";

const WORDS = ["ocean", "forest", "canyon", "meadow", "harbor", "summit", "valley", "ridge"];

function randomId() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${word}-${num}`;
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [recentBoards, setRecentBoards] = useState<string[]>([]);
  const [adminBoards, setAdminBoards] = useState<BoardSummary[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null);
  const router = useRouter();
  const unvisitedAdminBoards = adminBoards.filter((board) => !recentBoards.includes(board.id));

  useEffect(() => {
    setRecentBoards(readRecentBoards());
    const controller = new AbortController();
    fetch("/api/admin/boards", { cache: "no-store", signal: controller.signal })
      .then((res) => {
        setIsAdmin(res.ok);
        return res.ok ? res.json() as Promise<{ boards?: BoardSummary[] }> : null;
      })
      .then((data) => setAdminBoards(data?.boards ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  function navigate(raw: string) {
    const id = raw.trim().replace(/\s+/g, "-").toLowerCase();
    if (id) router.push(`/${encodeURIComponent(id)}`);
  }

  async function deleteBoard(boardId: string, displayName = boardId) {
    if (deletingBoardId || !window.confirm(`${displayName} 보드와 모든 내용을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;

    setDeletingBoardId(boardId);
    try {
      const response = await fetch(`/api/admin/boards/${encodeURIComponent(boardId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      forgetBoard(boardId);
      setRecentBoards((boards) => boards.filter((saved) => saved !== boardId));
      setAdminBoards((boards) => boards.filter((board) => board.id !== boardId));
    } catch {
      window.alert("보드를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeletingBoardId(null);
    }
  }

  function BoardDeleteButton({ boardId, displayName }: { boardId: string; displayName?: string }) {
    const deleting = deletingBoardId === boardId;
    return (
      <button
        className="recent-board-delete"
        type="button"
        aria-label={`${displayName ?? boardId} 보드 ${deleting ? "삭제 중" : "삭제"}`}
        title="보드 삭제"
        disabled={Boolean(deletingBoardId)}
        onClick={() => deleteBoard(boardId, displayName)}
      >
        <I.trash s={15} />
      </button>
    );
  }

  return (
    <main className="home-main">
      <div className="logo" style={{ fontSize: 28, marginBottom: 18 }}>
        <div className="logo-mark" style={{ width: 24, height: 24 }}>
          <span style={{ width: 14, opacity: 0.55, marginLeft: 7 }} />
          <span style={{ width: 21, opacity: 0.78 }} />
          <span style={{ width: 24 }} />
        </div>
        pile
      </div>

      <p style={{ fontSize: 15, color: "var(--muted)", textAlign: "center", maxWidth: 340, margin: "0 0 36px", lineHeight: 1.6 }}>
        로그인 없이 빠르게 자료를 쌓는 협업 보드
      </p>

      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 400, marginBottom: 14 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate(input)}
          placeholder="보드 주소 입력…"
          style={{
            flex: 1,
            fontFamily: "var(--mono)",
            fontSize: 14,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1.5px solid var(--hair-2)",
            background: "var(--surface)",
            color: "var(--ink)",
            outline: "none",
          }}
        />
        <button className="btn-pri" onClick={() => navigate(input)} disabled={!input.trim()}>
          이동
        </button>
      </div>

      <button
        onClick={() => navigate(randomId())}
        style={{ fontSize: 13, color: "var(--accent-ink)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline", textDecorationColor: "color-mix(in oklch, var(--accent) 35%, transparent)", textUnderlineOffset: 3 }}
      >
        새 보드 만들기 →
      </button>

      {recentBoards.length > 0 && (
        <section className="recent-boards" aria-labelledby="recent-boards-title">
          <div className="recent-boards-head">
            <h2 id="recent-boards-title">최근 방문한 보드</h2>
            <span>{recentBoards.length}</span>
          </div>
          <div className="recent-board-list">
            {recentBoards.map((boardId) => (
              <div className="recent-board-link" key={boardId}>
                <Link className="recent-board-target" href={`/${encodeURIComponent(boardId)}`}>
                  <span className="recent-board-mark" aria-hidden="true"><i /><i /><i /></span>
                  <span>{boardId}</span>
                  <b aria-hidden="true">→</b>
                </Link>
                {isAdmin && <BoardDeleteButton boardId={boardId} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {unvisitedAdminBoards.length > 0 && (
        <section className="recent-boards admin-boards" aria-labelledby="admin-boards-title">
          <div className="recent-boards-head">
            <h2 id="admin-boards-title">방문하지 않은 보드</h2>
            <span>{unvisitedAdminBoards.length}</span>
          </div>
          <div className="recent-board-list">
            {unvisitedAdminBoards.map((board) => (
              <div className="recent-board-link admin-board-link" key={board.id}>
                <Link
                  className="recent-board-target"
                  href={`/${encodeURIComponent(board.id)}`}
                  aria-label={`${board.displayName} 보드로 이동`}
                >
                  <span className="recent-board-mark" aria-hidden="true"><i /><i /><i /></span>
                  <span className="admin-board-name">{board.displayName}</span>
                  <b aria-hidden="true">→</b>
                </Link>
                <BoardDeleteButton boardId={board.id} displayName={board.displayName} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
