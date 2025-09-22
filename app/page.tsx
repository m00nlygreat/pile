const essentials = [
  {
    title: "익명 입장",
    body: "방문 즉시 anon_id 쿠키와 닉네임이 발급되어 바로 자료를 올릴 수 있습니다."
  },
  {
    title: "붙여넣기 중심",
    body: "텍스트·링크·파일을 채널 안으로 붙여 넣거나 드롭하면 끝입니다."
  },
  {
    title: "실시간 유지",
    body: "SSE 스트림이 열린 탭마다 같은 화면을 보여 줍니다."
  }
];

const stack = [
  "Next.js 14 · App Router",
  "SQLite + Drizzle ORM",
  "Server-Sent Events",
  "로컬 디스크 업로드"
];

export default function HomePage() {
  const year = new Date().getFullYear();

  return (
    <main className="shell">
      <header className="hero">
        <span className="wordmark" aria-label="pile wordmark">실시간 붙여넣기 보드</span>
        <h1>PILE</h1>
        <p>
          링크, 파일, 메모를 붙여 넣으면 채널별로 정돈됩니다. 서버는 SQLite와 로컬 디스크
          하나면 충분합니다.
        </p>
        <div className="cta-row">
          <a className="cta" href="#essentials">
            구성 보기
          </a>
          <span>실시간 SSE · Markdown 입력 · 파일 업로드</span>
        </div>
      </header>

      <section className="detail-grid" id="essentials">
        {essentials.map((item) => (
          <article className="detail-card" key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className="spec">
        <h2>기본 스택</h2>
        <ul>
          {stack.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="footnote">
          자료는 <code>./data</code> 아래 SQLite 데이터베이스와 업로드 디렉터리에 남습니다.
        </p>
      </section>

      <footer className="footer">
        <small>© {year} pile</small>
      </footer>
    </main>
  );
}
