import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { boards, channels } from "@/db/schema";

import { BoardSidebarNav } from "./sidebar-nav";

type BoardLayoutProps = {
  children: ReactNode;
  params: {
    boardId: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { boardId: string };
}): Promise<Metadata> {
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

export default async function BoardLayout({
  children,
  params,
}: BoardLayoutProps) {
  const boardSlug = decodeURIComponent(params.boardId);

  const boardRecord = db
    .select({
      id: boards.id,
      name: boards.name,
      slug: boards.slug,
      description: boards.description,
      defaultChannelId: boards.defaultChannelId,
    })
    .from(boards)
    .where(eq(boards.slug, boardSlug))
    .limit(1)
    .all()[0];

  if (!boardRecord) {
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
    .where(eq(channels.boardId, boardRecord.id))
    .orderBy(asc(channels.orderIndex), asc(channels.createdAt))
    .all()
    .map((channel) => ({
      ...channel,
      isDefault: channel.id === boardRecord.defaultChannelId,
    }));

  const boardDisplayName = boardRecord.name ?? boardRecord.slug;
  const hasChannels = channelList.length > 0;

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-board">
          <span className="workspace-board-slug">/{boardRecord.slug}</span>
          <h1>{boardRecord.name}</h1>
          {boardRecord.description ? (
            <p>{boardRecord.description}</p>
          ) : (
            <p className="workspace-board-muted">
              설명이 아직 등록되지 않았습니다.
            </p>
          )}
        </div>
        <BoardSidebarNav
          boardSlug={boardRecord.slug}
          channels={channelList}
        />
      </aside>
      <section className="workspace-content">
        {hasChannels ? (
          children
        ) : (
          <div className="channel-view">
            <div className="channel-scroll">
              <div className="channel-empty-state">
                <h2>첫 채널을 만들어보세요</h2>
                <p>
                  {boardDisplayName} 보드에는 아직 채널이 없습니다. 관리자 모드에서
                  채널을 추가해 자료를 정리할 주제를 만들어보세요.
                </p>
                <p>
                  채널이 생성되면 이 화면은 자동으로 첫 번째 채널로 이동합니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
