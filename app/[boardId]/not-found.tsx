type BoardWorkspaceNotFoundProps = {
  boardSlug?: string;
};

export function BoardWorkspaceNotFound({
  boardSlug,
}: BoardWorkspaceNotFoundProps) {
  const displaySlug = boardSlug ? `/${boardSlug}` : "/unknown-board";

  return (
    <div className="workspace">
      <aside className="workspace-sidebar">
        <div className="workspace-board">
          <span className="workspace-board-slug">{displaySlug}</span>
          <h1>보드를 찾을 수 없습니다</h1>
          <p className="workspace-board-muted">
            요청하신 보드 또는 채널이 존재하지 않거나 삭제되었을 수 있습니다.
          </p>
        </div>
        <nav className="workspace-nav" aria-label="채널">
          <header className="workspace-nav-header">
            <h2>채널</h2>
            <p>총 0개</p>
          </header>
          <p className="workspace-nav-empty">
            이 보드에서 불러올 채널이 없습니다.
          </p>
        </nav>
      </aside>
      <main className="workspace-content">
        <div className="channel-empty-state">
          <h2>보드 또는 채널을 찾을 수 없어요</h2>
          <p>
            주소가 정확한지 다시 확인하거나 관리자가 공유한 최신 링크를 이용해 주세요.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BoardNotFound() {
  return <BoardWorkspaceNotFound />;
}
