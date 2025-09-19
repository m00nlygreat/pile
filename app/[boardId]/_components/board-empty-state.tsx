type BoardEmptyStateProps = {
  boardDisplayName: string;
  boardSlug: string;
};

export function BoardEmptyState({
  boardDisplayName,
  boardSlug,
}: BoardEmptyStateProps) {
  return (
    <div className="channel-view">
      <div className="channel-scroll">
        <div className="channel-empty-state">
          <h2>첫 채널을 만들어보세요</h2>
          <p>
            {boardDisplayName} 보드(/{boardSlug})에는 아직 채널이 없습니다. 관리자 모드에서
            채널을 추가해 자료를 정리할 주제를 만들어보세요.
          </p>
          <p>채널이 생성되면 이 화면은 자동으로 첫 번째 채널로 이동합니다.</p>
        </div>
      </div>
    </div>
  );
}
