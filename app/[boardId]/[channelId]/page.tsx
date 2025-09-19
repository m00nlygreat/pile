import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels, items } from "@/db/schema";

import { ChannelComposer } from "./channel-composer";

const ITEM_TYPE_LABELS: Record<"text" | "file" | "link", string> = {
  text: "텍스트",
  file: "파일",
  link: "링크",
};

const ITEM_TYPE_ICONS: Record<"text" | "file" | "link", string> = {
  text: "Aa",
  file: "📎",
  link: "🔗",
};

type ChannelPageProps = {
  params: {
    boardId: string;
    channelId: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ChannelPageProps): Promise<Metadata> {
  const boardSlug = decodeURIComponent(params.boardId);
  const channelSlug = decodeURIComponent(params.channelId);

  const record = db
    .select({
      boardName: boards.name,
      channelName: channels.name,
    })
    .from(boards)
    .innerJoin(channels, eq(channels.boardId, boards.id))
    .where(and(eq(boards.slug, boardSlug), eq(channels.slug, channelSlug)))
    .limit(1)
    .all()[0];

  if (!record) {
    return {
      title: "채널을 찾을 수 없습니다 | pile",
      description: "요청한 채널을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${record.channelName} · ${record.boardName} | pile`,
    description: `${record.boardName} 보드의 ${record.channelName} 채널 메시지입니다.`,
  };
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const boardSlug = decodeURIComponent(params.boardId);
  const channelSlug = decodeURIComponent(params.channelId);

  const channelRecord = db
    .select({
      boardId: boards.id,
      boardSlug: boards.slug,
      boardName: boards.name,
      boardDescription: boards.description,
      boardDefaultChannelId: boards.defaultChannelId,
      channelId: channels.id,
      channelSlug: channels.slug,
      channelName: channels.name,
    })
    .from(boards)
    .innerJoin(channels, eq(channels.boardId, boards.id))
    .where(and(eq(boards.slug, boardSlug), eq(channels.slug, channelSlug)))
    .limit(1)
    .all()[0];

  if (!channelRecord) {
    notFound();
  }

  const channelList = db
    .select({
      id: channels.id,
      name: channels.name,
      slug: channels.slug,
      createdAt: channels.createdAt,
      orderIndex: channels.orderIndex,
    })
    .from(channels)
    .where(eq(channels.boardId, channelRecord.boardId))
    .orderBy(asc(channels.orderIndex), asc(channels.createdAt))
    .all()
    .map((channel) => ({
      ...channel,
      isDefault: channel.id === channelRecord.boardDefaultChannelId,
    }));

  const channelItems = db
    .select({
      id: items.id,
      type: items.type,
      textMd: items.textMd,
      linkUrl: items.linkUrl,
      linkTitle: items.linkTitle,
      linkDesc: items.linkDesc,
      createdAt: items.createdAt,
    })
    .from(items)
    .where(
      and(
        eq(items.boardId, channelRecord.boardId),
        eq(items.channelId, channelRecord.channelId),
      ),
    )
    .orderBy(asc(items.createdAt), asc(items.id))
    .all();

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-board">
          <span className="workspace-board-slug">
            /{channelRecord.boardSlug}
          </span>
          <h1>{channelRecord.boardName}</h1>
          {channelRecord.boardDescription ? (
            <p>{channelRecord.boardDescription}</p>
          ) : (
            <p className="workspace-board-muted">
              설명이 아직 등록되지 않았습니다.
            </p>
          )}
        </div>
        <nav className="workspace-nav" aria-label="채널">
          <header className="workspace-nav-header">
            <h2>채널</h2>
            <p>총 {channelList.length}개</p>
          </header>
          {channelList.length === 0 ? (
            <p className="workspace-nav-empty">아직 채널이 없습니다.</p>
          ) : (
            <ul className="workspace-nav-list">
              {channelList.map((channel) => {
                const isActive = channel.slug === channelRecord.channelSlug;

                return (
                  <li key={channel.id}>
                    <Link
                      href={`/${channelRecord.boardSlug}/${channel.slug}`}
                      className="channel-link"
                      data-active={isActive ? "true" : "false"}
                    >
                      <div className="channel-link-main">
                        <span aria-hidden className="channel-link-hash">
                          #
                        </span>
                        <span className="channel-link-name">{channel.name}</span>
                        {channel.isDefault ? (
                          <span className="channel-badge">기본</span>
                        ) : null}
                      </div>
                      <span className="channel-link-slug">
                        /{channelRecord.boardSlug}/{channel.slug}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>
      <section className="workspace-content">
        <div className="channel-view">
          <header className="channel-header">
            <div className="channel-heading">
              <span aria-hidden className="channel-hash">
                #
              </span>
              <h1>{channelRecord.channelName}</h1>
            </div>
            <p className="channel-subtitle">
              {channelItems.length === 0
                ? "아직 메시지가 없습니다."
                : `총 ${channelItems.length}개 메시지`}
            </p>
          </header>
          <div className="channel-scroll">
            {channelItems.length === 0 ? (
              <div className="channel-empty-state">
                <h2>첫 메시지를 남겨보세요</h2>
                <p>
                  클립보드에서 붙여넣거나 파일을 드롭하면 이곳에 대화처럼 쌓입니다.
                </p>
              </div>
            ) : (
              <ol className="message-list">
                {channelItems.map((item) => {
              const createdAtLabel = item.createdAt
                ? item.createdAt.toLocaleString("ko-KR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "시간 정보 없음";
              const createdAtIso = item.createdAt
                ? item.createdAt.toISOString()
                : undefined;

              let body: ReactNode;

              if (item.type === "text") {
                const textContent = item.textMd ?? "";
                if (textContent.trim().length === 0) {
                  body = (
                    <p className="message-text message-text--muted">
                      내용이 비어 있습니다.
                    </p>
                  );
                } else {
                  body = (
                    <div className="message-text">
                      <div className="message-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a({ node: _node, ...props }) {
                              return (
                                <a
                                  {...props}
                                  target={props.target ?? "_blank"}
                                  rel={props.rel ?? "noreferrer"}
                                />
                              );
                            },
                          }}
                        >
                          {textContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                }
              } else if (item.type === "link") {
                body = item.linkUrl ? (
                  <div className="message-link">
                    <a href={item.linkUrl} target="_blank" rel="noreferrer">
                      {item.linkTitle ?? item.linkUrl}
                    </a>
                    {item.linkDesc ? <p>{item.linkDesc}</p> : null}
                  </div>
                ) : (
                  <p className="message-text message-text--muted">
                    링크 정보가 아직 준비되지 않았습니다.
                  </p>
                );
              } else {
                body = (
                  <p className="message-text message-text--muted">
                    파일 메시지는 곧 미리보기를 지원할 예정입니다.
                  </p>
                );
              }

              return (
                <li key={item.id} className="message">
                  <span
                    aria-hidden
                    className="message-avatar"
                    data-type={item.type}
                  >
                    {ITEM_TYPE_ICONS[item.type]}
                  </span>
                  <div className="message-content">
                    <div className="message-meta">
                      <span className="message-author">익명</span>
                      <span className="message-separator" aria-hidden>
                        ·
                      </span>
                      {createdAtIso ? (
                        <time
                          className="message-timestamp"
                          dateTime={createdAtIso}
                        >
                          {createdAtLabel}
                        </time>
                      ) : (
                        <span className="message-timestamp">
                          {createdAtLabel}
                        </span>
                      )}
                      <span className="message-type">
                        {ITEM_TYPE_LABELS[item.type]}
                      </span>
                    </div>
                    {body}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
          <ChannelComposer
            boardSlug={channelRecord.boardSlug}
            channelSlug={channelRecord.channelSlug}
            channelName={channelRecord.channelName}
          />
        </div>
      </div>
    </section>
  </div>
  );
}
