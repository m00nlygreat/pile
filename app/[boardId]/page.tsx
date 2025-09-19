import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels, items } from "@/db/schema";

const ITEM_TYPE_LABELS: Record<"text" | "file" | "link", string> = {
  text: "텍스트",
  file: "파일",
  link: "링크",
};

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

  const boardItems = db
    .select({
      id: items.id,
      channelId: items.channelId,
      type: items.type,
      textMd: items.textMd,
      linkUrl: items.linkUrl,
      linkTitle: items.linkTitle,
      linkDesc: items.linkDesc,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(eq(items.boardId, board.id))
    .orderBy(desc(items.createdAt))
    .all();

  const itemsByChannel = new Map<string, (typeof boardItems)[number][]>();

  for (const item of boardItems) {
    const list = itemsByChannel.get(item.channelId);
    if (list) {
      list.push(item);
    } else {
      itemsByChannel.set(item.channelId, [item]);
    }
  }

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
            {channelList.map((channel) => {
              const channelItems = itemsByChannel.get(channel.id) ?? [];

              return (
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
                  {channelItems.length === 0 ? (
                    <p className="channel-empty">
                      아직 이 채널에 등록된 아이템이 없습니다.
                    </p>
                  ) : (
                    <ul className="channel-items">
                      {channelItems.map((item) => {
                        const createdAtLabel = item.createdAt
                          ? item.createdAt.toLocaleString("ko-KR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-";
                        const createdAtIso = item.createdAt
                          ? item.createdAt.toISOString()
                          : undefined;

                        let body: ReactNode;

                        if (item.type === "text") {
                          body = (
                            <p className="item-body">
                              {item.textMd ?? "내용이 비어 있습니다."}
                            </p>
                          );
                        } else if (item.type === "link") {
                          if (item.linkUrl) {
                            body = (
                              <div className="item-link">
                                <a href={item.linkUrl} target="_blank" rel="noreferrer">
                                  {item.linkTitle ?? item.linkUrl}
                                </a>
                                {item.linkDesc ? <p>{item.linkDesc}</p> : null}
                              </div>
                            );
                          } else {
                            body = (
                              <p className="item-body item-body--muted">
                                링크 정보가 아직 준비되지 않았습니다.
                              </p>
                            );
                          }
                        } else {
                          body = (
                            <p className="item-body item-body--muted">
                              파일 항목은 곧 보드 화면에서 미리보기를 제공할 예정입니다.
                            </p>
                          );
                        }

                        return (
                          <li key={item.id} className="item-card">
                            <header className="item-meta">
                              <span className="item-type">
                                {ITEM_TYPE_LABELS[item.type]}
                              </span>
                              {createdAtIso ? (
                                <time
                                  className="item-created"
                                  dateTime={createdAtIso}
                                >
                                  {createdAtLabel}
                                </time>
                              ) : (
                                <span className="item-created">{createdAtLabel}</span>
                              )}
                            </header>
                            {body}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
