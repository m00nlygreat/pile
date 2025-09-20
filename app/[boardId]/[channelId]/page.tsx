import type { Metadata } from "next";

import { getBoardChannelContext } from "@/lib/board-data";
import { getActiveAnonProfile, getActiveAnonUserId, isAdminRequest } from "@/lib/anon-server";

import BoardShell from "../BoardShell";

type PageParams = {
  boardId: string;
  channelId: string;
};

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const context = getBoardChannelContext(params.boardId, params.channelId);

  if (!context.boardExists || !context.activeChannel) {
    return {
      title: "채널을 찾을 수 없음 | pile",
      description: "요청하신 보드 또는 채널이 존재하지 않습니다.",
    };
  }

  return {
    title: `${context.board.name} · ${context.activeChannel.name} | pile`,
    description:
      context.board.description ?? `${context.board.name} 보드의 ${context.activeChannel.name} 채널`,
  };
}

export default function BoardChannelPage({
  params,
}: {
  params: PageParams;
}) {
  const context = getBoardChannelContext(params.boardId, params.channelId);
  const viewerAnonId = getActiveAnonUserId();
  const viewerIsAdmin = isAdminRequest();
  const viewerProfile = getActiveAnonProfile();

  return (
    <BoardShell
      context={context}
      viewerAnonId={viewerAnonId}
      viewerIsAdmin={viewerIsAdmin}
      viewerProfile={viewerProfile}
      allowPlaceholder={false}
    />
  );
}
