import type { ChannelRecord, ItemRecord, UserRecord } from "@/lib/types";

export const DEFAULT_CHANNELS = [
  { id: "default", name: "일반" },
  { id: "homework", name: "과제" },
  { id: "qna", name: "Q&A" },
  { id: "resources", name: "자료실" },
];

export const USERS: Record<string, UserRecord> = {
  me: { id: "me", nick: "느긋한 펭귄", display: "느긋한 펭귄", admin: false },
  a: { id: "u_a", nick: "조용한 다람쥐", display: "민지", admin: false },
  b: { id: "u_b", nick: "성실한 두루미", display: "성실한 두루미", admin: false },
  c: { id: "u_c", nick: "호기심 여우", display: "준호", admin: false },
  admin: { id: "u_admin", nick: "강사", display: "강사 · 김선우", admin: true },
};

const NOW = Date.now();
const min = 60 * 1000;
const S1 = NOW - 25 * 60 * min;
const S2 = NOW - 22 * min;

export const seedChannels = (boardId: string): ChannelRecord[] =>
  DEFAULT_CHANNELS.map((channel, position) => ({ ...channel, boardId, position }));

export const seedItems = (boardId: string): ItemRecord[] => [
  {
    id: "it1",
    boardId,
    channel: "default",
    type: "text",
    user: USERS.admin,
    session: S1,
    t: S1 + 2 * min,
    pinned: true,
    body: "## 2차시 · 컴포넌트 설계 안내\n오늘은 **재사용 가능한 컴포넌트**를 직접 만들어 봅니다. 시작 전 아래를 확인해 주세요.\n\n- [x] 저장소 클론 완료\n- [x] `pnpm install` 실행\n- [ ] 개발 서버 `pnpm dev` 확인\n\n> 막히는 부분은 Q&A 채널에 바로 올려 주세요.",
  },
  {
    id: "it2",
    boardId,
    channel: "default",
    type: "link",
    user: USERS.b,
    session: S1,
    t: S1 + 14 * min,
    pinned: false,
    link: {
      url: "https://developer.mozilla.org/ko/docs/Web/CSS/CSS_grid_layout",
      title: "CSS 그리드 레이아웃 - MDN Web Docs",
      site: "developer.mozilla.org",
      desc: "CSS 그리드 레이아웃은 행과 열로 이루어진 2차원 레이아웃 시스템으로, 복잡한 레이아웃을 직관적으로 구성할 수 있습니다.",
      image: "grid",
    },
  },
  {
    id: "it3",
    boardId,
    channel: "default",
    type: "text",
    user: USERS.a,
    session: S1,
    t: S1 + 41 * min,
    pinned: false,
    body: "제출용 함수 초안이에요. 네이밍 피드백 부탁드려요 🙏\n\n```js\nfunction groupBySession(items, len) {\n  const map = new Map();\n  for (const it of items) {\n    const key = Math.floor(it.t / len) * len;\n    (map.get(key) ?? map.set(key, []).get(key)).push(it);\n  }\n  return map;\n}\n```",
  },
  {
    id: "it4",
    boardId,
    channel: "default",
    type: "file",
    user: USERS.c,
    session: S2,
    t: S2 + 3 * min,
    pinned: false,
    file: { name: "wireframe-board-v2.png", mime: "image/png", size: 842000, preview: "wire" },
  },
  {
    id: "it5",
    boardId,
    channel: "default",
    type: "link",
    user: USERS.me,
    session: S2,
    t: S2 + 9 * min,
    pinned: false,
    link: {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "레이아웃 디버깅 라이브",
      site: "youtube.com",
      youtube: "dQw4w9WgXcQ",
    },
  },
  {
    id: "it6",
    boardId,
    channel: "default",
    type: "text",
    user: USERS.me,
    session: S2,
    t: S2 + 12 * min,
    pinned: false,
    body: "| 항목 | 상태 | 담당 |\n| --- | --- | --- |\n| 카드 레이아웃 | 진행중 | 나 |\n| 붙여넣기 | 완료 | 민지 |\n| 파일 업로드 | 대기 | 준호 |",
  },
  {
    id: "it7",
    boardId,
    channel: "default",
    type: "file",
    user: USERS.b,
    session: S2,
    t: S2 + 16 * min,
    pinned: false,
    file: { name: "2차시-실습자료.pdf", mime: "application/pdf", size: 2410000 },
  },
  {
    id: "it8",
    boardId,
    channel: "default",
    type: "text",
    user: USERS.admin,
    session: S2,
    t: S2 + 7 * min,
    pinned: false,
    body: "다음 주 세션 방식을 정해요 — 투표해 주세요!\n\n```poll\n1. 라이브 코딩 세션\n2. 코드 리뷰 중심\n3. 개인 과제 + Q&A\n```",
  },
];

export const seedReactions: Record<string, Record<string, string[]>> = {
  it1: { "🔥": ["u_a", "u_b"], "✅": ["u_admin"] },
  it2: { "👍": ["u_c", "me"], "💡": ["u_b"] },
  it3: { "💡": ["u_a", "u_admin", "u_c"], "❤️": ["me"] },
  it5: { "😂": ["u_b"] },
  it6: { "👀": ["u_a", "me"] },
  it8: { "1️⃣": ["u_a", "u_b"], "2️⃣": ["u_c"] },
};
