export default function ChannelNotFound() {
  return (
    <div className="channel-view">
      <header className="channel-header">
        <div className="channel-heading">
          <span aria-hidden className="channel-hash">#</span>
          <h1>채널을 찾을 수 없습니다</h1>
        </div>
        <p className="channel-subtitle">
          요청하신 채널이 존재하지 않거나 이미 삭제되었을 수 있습니다.
        </p>
      </header>
      <div className="channel-scroll">
        <div className="channel-empty-state">
          <h2>보드 또는 채널을 찾을 수 없어요</h2>
          <p>
            다른 채널을 선택하거나 보드 주소를 다시 확인해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
