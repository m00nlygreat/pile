const heroHighlights = [
  {
    title: "붙여넣기 한 번이면 업로드 완료",
    description:
      "텍스트와 파일, URL을 Ctrl+V 혹은 드롭으로 즉시 공유하고 채널 보드에 자동 정렬합니다."
  },
  {
    title: "실시간으로 함께 보는 업데이트",
    description:
      "Server-Sent Events 기반의 브로드캐스터가 탭과 기기 사이를 실시간으로 동기화합니다."
  }
];

const featureCards = [
  {
    eyebrow: "익명으로 바로 참여",
    title: "로그인 없이 수집 시작",
    description:
      "새로운 방문자는 anon_id 쿠키로 식별하고 자동 생성된 닉네임으로 채팅하듯 업로드합니다."
  },
  {
    eyebrow: "자료를 목적에 맞게 정리",
    title: "보드·채널 구조",
    description:
      "강의나 세션 단위의 보드 아래 과제, 공유, 교안 같은 채널을 구성해 흐름을 나눌 수 있습니다."
  },
  {
    eyebrow: "모든 입력 통합",
    title: "텍스트·링크·파일 지원",
    description:
      "링크는 메타태그를 불러와 카드화하고, 파일은 로컬 업로드 디렉터리에 정리해 보관합니다."
  },
  {
    eyebrow: "현장의 속도에 맞춘 설계",
    title: "세션 블록 추적",
    description:
      "보드의 차시(anchor + block) 정보를 이용해 아이템을 세션별로 묶고 헤더로 표시합니다."
  }
];

const timelineSteps = [
  {
    title: "보드 생성 및 공유",
    description:
      "관리자는 비밀번호 한 번으로 로그인해 보드를 만들고, 자동으로 생성된 기본 채널을 바로 사용합니다."
  },
  {
    title: "참여자 초대",
    description:
      "URL을 공유하면 참가자가 별도 가입 없이 닉네임을 발급받고 곧바로 업로드를 시작합니다."
  },
  {
    title: "업로드 & 실시간 갱신",
    description:
      "붙여넣기 또는 파일 드롭으로 아이템을 추가하면 SSE 스트림이 다른 탭에도 즉시 업데이트를 전송합니다."
  },
  {
    title: "정리와 수거",
    description:
      "관리자는 채널 순서를 재정렬하고 불필요한 항목을 삭제하며, 세션 별로 모인 자료를 나중에 수거합니다."
  }
];

const capabilityGroups = [
  {
    title: "협업을 위한 핵심 기능",
    items: [
      "채널 단위 실시간 피드",
      "파일 업로드 MIME 화이트리스트 및 용량 제한",
      "텍스트 입력 Markdown 지원",
      "링크 프리뷰를 위한 OpenGraph 파싱"
    ]
  },
  {
    title: "현장 운영 편의",
    items: [
      "보드별 세션 헤더 표시 및 시간 블록 계산",
      "붙여넣기/드래그 앤 드롭 통합 처리",
      "참여자 익명 닉네임 자동 생성",
      "관리자 모드에서 채널 생성·정렬·삭제"
    ]
  },
  {
    title: "안전한 공유",
    items: [
      "로컬 디스크 업로드 경로 격리 및 보안 필터",
      "간단한 레이트 리밋으로 스팸 차단",
      "모든 아이템 메타데이터 감사 로그",
      "보드별 접근 토큰(선택)으로 외부 유출 방지"
    ]
  }
];

const stats = [
  {
    value: "3초",
    label: "평균 업로드 소요 시간"
  },
  {
    value: "∞",
    label: "동시 접속 탭 실시간 스트림"
  },
  {
    value: "20MB",
    label: "기본 파일 업로드 제한"
  }
];

const heroColumns = [
  {
    name: "공유",
    items: [
      {
        title: "강의 링크 모음",
        meta: "https://example.com/workshop",
        pill: "세션 1"
      },
      {
        title: "참고 자료 PDF",
        meta: "uploads/2025/03/교안.pdf"
      }
    ]
  },
  {
    name: "과제 제출",
    items: [
      {
        title: "조별 발표 자료",
        meta: "파일 · 12MB",
        pill: "업데이트됨"
      },
      {
        title: "과제 질문",
        meta: "텍스트 · 2분 전"
      }
    ]
  },
  {
    name: "피드백",
    items: [
      {
        title: "오늘 실습에서 좋았던 점",
        meta: "김푸른고래",
        pill: "실시간"
      },
      {
        title: "추가 요청사항",
        meta: "익명 · 18:30 블록"
      }
    ]
  }
];

export default function HomePage() {
  return (
    <main>
      <section className="hero section">
        <div className="hero-glow" aria-hidden />
        <div className="hero-inner">
          <div className="hero-content">
            <span className="badge" aria-label="pile 소개 배지">
              # 실시간 보드 플랫폼
            </span>
            <h1 className="hero-heading">
              로그인 없이 던져놓고 모두가 동시에 확인하는 강의용 보드
            </h1>
            <p className="hero-description">
              pile은 강의·워크숍 현장에서 링크, 파일, 텍스트 메모를 순식간에 모으는 온라인
              보드입니다. 익명 참여와 실시간 SSE 스트림을 기본으로 하여 참여자 모두가 같은
              화면을 함께 봅니다.
            </p>
            <div className="hero-cta">
              <a className="btn-primary" href="#features">
                시작 가이드 보기
              </a>
              <span style={{ color: "var(--color-text-muted)" }}>
                데이터는 로컬 SQLite와 업로드 디렉터리에 안전하게 저장됩니다.
              </span>
            </div>
            <div className="hero-highlight">
              {heroHighlights.map((highlight) => (
                <div className="hero-highlight-card" key={highlight.title}>
                  <strong>{highlight.title}</strong>
                  <span>{highlight.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-visual" aria-hidden>
            <div className="hero-board">
              {heroColumns.map((column) => (
                <div className="hero-board-column" key={column.name}>
                  <div className="hero-board-title">
                    <span aria-hidden>#</span>
                    {column.name}
                  </div>
                  {column.items.map((item) => (
                    <div className="hero-item" key={item.title}>
                      <strong>{item.title}</strong>
                      <small>{item.meta}</small>
                      {item.pill ? (
                        <span className="hero-status-pill">{item.pill}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="section-content">
          <h2 className="section-title">pile이 강의 현장에서 사랑받는 이유</h2>
          <p className="section-subtitle">
            보드, 채널, 아이템으로 구성된 단순한 구조는 누구나 익숙하게 사용할 수 있고,
            익명 쿠키와 실시간 스트림 덕분에 별도의 온보딩 없이 자료가 쌓입니다.
          </p>
          <div className="grid grid-cols-2-md">
            {featureCards.map((card) => (
              <article className="card" key={card.title}>
                <span className="badge" aria-hidden>
                  {card.eyebrow}
                </span>
                <h3 style={{ fontSize: "1.4rem", marginBottom: "0.8rem" }}>{card.title}</h3>
                <p style={{ color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="section-content">
          <h2 className="section-title">처음 방문부터 수거까지, 4단계 플로우</h2>
          <p className="section-subtitle">
            관리자와 참여자 모두가 헤매지 않도록 설정했습니다. 링크 공유와 붙여넣기만 알면
            사용할 수 있는 워크숍용 자료 수집 루틴입니다.
          </p>
          <div className="timeline">
            {timelineSteps.map((step) => (
              <div className="timeline-step" key={step.title}>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="capabilities">
        <div className="section-content">
          <h2 className="section-title">현장 운영에 필요한 기능을 빠짐없이 담았습니다</h2>
          <p className="section-subtitle">
            로컬 SQLite 데이터베이스와 업로드 디렉터리를 활용하는 단일 서버 배포를 전제로
            설계되어, 오프라인 강의실에서도 안정적으로 동작합니다.
          </p>
          <div className="grid grid-cols-3-md">
            {capabilityGroups.map((group) => (
              <article className="card" key={group.title}>
                <h3 style={{ marginTop: 0 }}>{group.title}</h3>
                <ul className="feature-list">
                  {group.items.map((item) => (
                    <li key={item}>
                      <span>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="stats">
        <div className="section-content">
          <h2 className="section-title">수업 흐름을 끊지 않는 퍼포먼스</h2>
          <p className="section-subtitle">
            SSE 기반 브로드캐스터와 SQLite 트랜잭션 최적화 덕분에 강의 중에도 지연 없이
            자료가 쌓입니다. 단일 컨테이너 배포로 관리 부담도 줄였습니다.
          </p>
          <div className="stats-row">
            {stats.map((stat) => (
              <div className="stats-card" key={stat.label}>
                <strong>{stat.value}</strong>
                <span style={{ color: "var(--color-text-muted)" }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="cta">
        <div className="section-content">
          <h2 className="section-title">지금 바로 pile 보드를 열어 보세요</h2>
          <p className="section-subtitle">
            Docker 한 번으로 서버를 띄우고, 원하는 강의 슬러그로 보드를 개설하세요. 자료는
            모두 `./data` 디렉터리에 보관되며 언제든 백업이 가능합니다.
          </p>
          <div className="card" style={{ display: "grid", gap: "1.5rem" }}>
            <div>
              <strong style={{ fontSize: "1.6rem" }}>시작을 위한 체크리스트</strong>
              <p style={{ color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
                관리자 비밀번호를 설정하고, 세션 블록 시간을 입력한 뒤 기본 채널을 구성하면
                준비 완료입니다.
              </p>
            </div>
            <ul className="feature-list">
              <li>
                <span>1</span>
                <span>환경 변수로 관리자 계정(이름/비밀번호)을 지정합니다.</span>
              </li>
              <li>
                <span>2</span>
                <span>Docker 혹은 Node 20 환경에서 `npm run build && npm start`를 실행합니다.</span>
              </li>
              <li>
                <span>3</span>
                <span>보드 slug를 공유하고 참여자에게 붙여넣기/드롭 사용을 안내합니다.</span>
              </li>
            </ul>
            <div>
              <a className="btn-primary" href="#">
                데모 보드 열어보기
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-nav">
            <a href="#features">기능 소개</a>
            <a href="#how-it-works">사용 흐름</a>
            <a href="#capabilities">기술 구성</a>
            <a href="#cta">시작하기</a>
          </div>
          <small>
            © {new Date().getFullYear()} pile. 오프라인/온라인 강의 자료를 위한 실시간 공유
            보드.
          </small>
        </div>
      </footer>
    </main>
  );
}
