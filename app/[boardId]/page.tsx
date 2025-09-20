import type { Metadata } from "next";

import { getBoardChannelContext } from "@/lib/board-data";
import { getActiveAnonProfile, getActiveAnonUserId, isAdminRequest } from "@/lib/anon-server";

import BoardShell from "./BoardShell";

type PageParams = {
  boardId: string;
};

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const context = getBoardChannelContext(params.boardId);

  if (!context.boardExists) {
    return {
      title: `${params.boardId} 보드를 시작해보세요 | pile`,
      description: "첫 아이템을 붙여넣으면 보드가 자동으로 생성됩니다.",
    };
  }

  const channelName = context.activeChannel?.name ?? "기본 채널";

  return {
    title: `${context.board.name} · ${channelName} | pile`,
    description: context.board.description ?? `${context.board.name} 보드입니다.`,
  };
}

export default function BoardPage({
  params,
}: {
  params: PageParams;
}) {
  const context = getBoardChannelContext(params.boardId);
  const viewerAnonId = getActiveAnonUserId();
  const viewerIsAdmin = isAdminRequest();
  const viewerProfile = getActiveAnonProfile();

  return (
    <BoardShell
      context={context}
      viewerAnonId={viewerAnonId}
      viewerIsAdmin={viewerIsAdmin}
      viewerProfile={viewerProfile}
      allowPlaceholder
    />
  );
}
