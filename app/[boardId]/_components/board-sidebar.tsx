import { BoardSidebarNav } from "../sidebar-nav";

type ChannelNavItem = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
};

type BoardSidebarProps = {
  boardSlug: string;
  boardName: string;
  boardDescription: string | null;
  channels: ChannelNavItem[];
};

export function BoardSidebar({
  boardSlug,
  boardName,
  boardDescription,
  channels,
}: BoardSidebarProps) {
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-board">
        <span className="workspace-board-slug">/{boardSlug}</span>
        <h1>{boardName}</h1>
        {boardDescription ? (
          <p>{boardDescription}</p>
        ) : (
          <p className="workspace-board-muted">설명이 아직 등록되지 않았습니다.</p>
        )}
      </div>
      <BoardSidebarNav boardSlug={boardSlug} channels={channels} />
    </aside>
  );
}
