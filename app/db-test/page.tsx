import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { randomUUID } from "node:crypto";

import { eq, desc } from "drizzle-orm";

import { db } from "@/db/client";
import { createBoardWithDefaultChannel } from "@/db/commands";
import { boards } from "@/db/schema";

export const metadata: Metadata = {
  title: "DB 테스트 | pile",
  description: "SQLite에 값을 저장하고 즉시 읽어오는 간단한 확인 페이지"
};

export default async function DbTestPage() {
  const recentBoards = db
    .select()
    .from(boards)
    .orderBy(desc(boards.createdAt))
    .limit(10)
    .all();

  return (
    <main className="shell">
      <section className="panel">
        <h1>SQLite 연결 점검</h1>
        <p>
          Drizzle ORM과 better-sqlite3 조합으로 데이터를 추가하고 즉시 목록을 확인할 수 있는
          테스트 페이지입니다.
        </p>
        <p className="panel-meta">현재 저장된 보드는 {recentBoards.length}개입니다.</p>
      </section>

      <section className="panel">
        <h2>새 보드 추가</h2>
        <form action={createBoard} className="db-test-form">
          <label>
            <span>보드 이름</span>
            <input
              name="name"
              required
              placeholder="예: 5주차 세미나"
              autoComplete="off"
            />
          </label>
          <label>
            <span>설명 (선택)</span>
            <textarea
              name="description"
              rows={2}
              placeholder="간단한 메모를 남겨보세요."
              autoComplete="off"
            />
          </label>
          <label>
            <span>슬러그 (선택)</span>
            <input
              name="slug"
              placeholder="영문 소문자, 숫자, 하이픈"
              autoComplete="off"
            />
            <small>미입력 시 이름을 기반으로 자동 생성합니다.</small>
          </label>
          <button type="submit">보드 저장</button>
        </form>
      </section>

      <section className="panel">
        <h2>최근 생성된 보드</h2>
        {recentBoards.length === 0 ? (
          <p className="panel-muted">아직 저장된 보드가 없습니다.</p>
        ) : (
          <ul className="db-test-list">
            {recentBoards.map((board) => (
              <li key={board.id} className="db-test-item">
                <header className="db-test-row">
                  <div className="db-test-title">
                    <strong>{board.name}</strong>
                    <a className="db-test-slug" href={`/${board.slug}`}>
                      /{board.slug}
                    </a>
                  </div>
                  <form action={deleteBoard}>
                    <input type="hidden" name="boardId" value={board.id} />
                    <button type="submit" className="ghost-button">
                      삭제
                    </button>
                  </form>
                </header>
                {board.description ? (
                  <p className="db-test-description">{board.description}</p>
                ) : null}
                <dl className="db-test-meta">
                  <div>
                    <dt>ID</dt>
                    <dd>{board.id}</dd>
                  </div>
                  <div>
                    <dt>생성 시각</dt>
                    <dd>
                      {board.createdAt
                        ? board.createdAt.toLocaleString("ko-KR", {
                            dateStyle: "short",
                            timeStyle: "medium"
                          })
                        : "-"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

async function createBoard(formData: FormData) {
  "use server";

  const rawName = formData.get("name");
  const rawSlug = formData.get("slug");
  const rawDescription = formData.get("description");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) {
    return;
  }

  const slugFromInput =
    typeof rawSlug === "string"
      ? rawSlug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      : "";

  const slugFromName = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  let slug = slugFromInput || slugFromName || "board";

  const conflict = db
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.slug, slug))
    .limit(1)
    .all();

  if (conflict.length > 0) {
    slug = `${slug}-${randomUUID().slice(0, 4)}`;
  }

  const description =
    typeof rawDescription === "string" && rawDescription.trim().length > 0
      ? rawDescription.trim()
      : null;

  createBoardWithDefaultChannel(db, {
    name,
    slug,
    description
  });

  revalidatePath("/db-test");
}

async function deleteBoard(formData: FormData) {
  "use server";

  const rawId = formData.get("boardId");
  if (typeof rawId !== "string" || rawId.length === 0) {
    return;
  }

  db.delete(boards)
    .where(eq(boards.id, rawId))
    .run();

  revalidatePath("/db-test");
}
