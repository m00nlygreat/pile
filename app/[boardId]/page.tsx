import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels } from "@/db/schema";

export const dynamic = "force-dynamic";

type BoardPageProps = {
  params: {
    boardId: string;
  };
};

export async function generateMetadata(
  { params }: BoardPageProps,
): Promise<Metadata> {
  const boardSlug = decodeURIComponent(params.boardId);
  const boardRecord = db
    .select({
      name: boards.name,
      description: boards.description,
    })
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!boardRecord) {
    return {
      title: "보드를 찾을 수 없습니다 | pile",
      description: "요청한 보드를 찾을 수 없습니다.",
    };
  }

  return {
    title: `${boardRecord.name} | pile`,
    description:
      boardRecord.description ?? "pile에서 진행 중인 강의 보드입니다.",
  };
}

export default async function BoardPage({ params }: BoardPageProps) {
  const boardSlug = decodeURIComponent(params.boardId);

  const board = db
    .select()
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!board) {
    notFound();
  }

  const channelList = db
    .select({
      id: channels.id,
      name: channels.name,
      slug: channels.slug,
      orderIndex: channels.orderIndex,
      createdAt: channels.createdAt,
    })
    .from(channels)
    .where(eq(channels.boardId, board.id))
    .orderBy(asc(channels.orderIndex), asc(channels.createdAt))
    .all();

  return (
    <main className="shell">
      <section className="panel">
        <div className="board-header">
          <div className="board-title-row">
            <h1>{board.name}</h1>
            <span className="board-slug">/{board.slug}</span>
          </div>
          {board.description ? (
            <p className="board-description">{board.description}</p>
          ) : (
            <p className="board-description board-description--muted">
              설명이 아직 등록되지 않았습니다.
            </p>
          )}
          <dl className="board-meta">
            <div>
              <dt>기본 채널</dt>
              <dd>
                {board.defaultChannelId
                  ? `#${
                      channelList.find(
                        (channel) => channel.id === board.defaultChannelId,
                      )?.name ?? "공유"
                    }`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>세션 길이</dt>
              <dd>{board.sessionBlockMinutes}분</dd>
            </div>
            <div>
              <dt>세션 기준 시각</dt>
              <dd>{board.sessionAnchor}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>채널</h2>
          <span className="panel-subtitle">
            총 {channelList.length}개 채널이 준비되었습니다.
          </span>
        </div>
        {channelList.length === 0 ? (
          <p className="panel-muted">아직 생성된 채널이 없습니다.</p>
        ) : (
          <ul className="channel-list">
            {channelList.map((channel) => (
              <li key={channel.id} className="channel-item">
                <div className="channel-row">
                  <div className="channel-title">
                    <span aria-hidden className="channel-hash">
                      #
                    </span>
                    <strong>{channel.name}</strong>
                  </div>
                  {channel.id === board.defaultChannelId ? (
                    <span className="channel-badge">기본</span>
                  ) : null}
                </div>
                <p className="channel-slug">
                  /{board.slug}/{channel.slug}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
