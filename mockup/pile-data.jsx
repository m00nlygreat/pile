// pile-data.jsx — sample data, icons, helpers, and a small safe markdown renderer
// Exposed on window for the other babel scripts.

/* ---------------------------------- icons --------------------------------- */
// Minimal stroke icons. size via props.s
function Icon({ d, s = 16, fill = "none", stroke = "currentColor", sw = 1.6, children, vb = 24 }) {
  return (
    <svg width={s} height={s} viewBox={`0 0 ${vb} ${vb}`} fill={fill} stroke={stroke}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d ? <path d={d} /> : children}
    </svg>
  );
}
const I = {
  copy: (p) => <Icon {...p} children={<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>} />,
  link: (p) => <Icon {...p} d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />,
  file: (p) => <Icon {...p} children={<><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></>} />,
  image: (p) => <Icon {...p} children={<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5L5 20" /></>} />,
  text: (p) => <Icon {...p} d="M5 6h14M5 12h14M5 18h9" />,
  trash: (p) => <Icon {...p} d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />,
  plus: (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  check: (p) => <Icon {...p} d="M5 12l5 5L20 6" />,
  clip: (p) => <Icon {...p} children={<><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /></>} />,
  download: (p) => <Icon {...p} d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />,
  play: (p) => <Icon {...p} fill="currentColor" stroke="none" children={<path d="M8 5v14l11-7z" />} />,
  user: (p) => <Icon {...p} children={<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>} />,
  shield: (p) => <Icon {...p} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />,
  hash: (p) => <Icon {...p} d="M6 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  x: (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  share: (p) => <Icon {...p} children={<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4" /></>} />,
  pin: (p) => <Icon {...p} d="M9 4h6l-1 6 3 3v2H7v-2l3-3z M12 15v5" />,
  poll: (p) => <Icon {...p} children={<><rect x="4" y="13" width="4" height="7" rx="1.5"/><rect x="10" y="8" width="4" height="12" rx="1.5"/><rect x="16" y="4" width="4" height="16" rx="1.5"/></>} />,
  bars: (p) => <Icon {...p} d="M4 6h16M4 12h10M4 18h6" />,
};

/* --------------------------------- helpers -------------------------------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
function fmtTime(d) {
  const dt = new Date(d);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function relTime(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return Math.floor(diff / 60) + "분 전";
  if (diff < 86400) return Math.floor(diff / 3600) + "시간 전";
  return Math.floor(diff / 86400) + "일 전";
}
function isUrl(s) {
  return /^https?:\/\/[^\s]+$/i.test(s.trim());
}
function ytId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

/* ----------------------------- markdown (safe) ---------------------------- */
// Escapes HTML first, then applies a limited markdown subset → returns HTML string.
// Demonstrates the PRD's "dangerous HTML is stripped" contract: raw tags never survive.
function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, (_, c) => `<code class="md-code">${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  while (i < lines.length) {
    let ln = lines[i];
    // code fence
    if (/^```/.test(ln)) {
      const lang = ln.slice(3).trim();
      let code = "";
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + "\n"; i++; }
      i++;
      html += `<pre class="md-pre"><div class="md-pre-bar"><span>${esc(lang || "code")}</span></div><code>${esc(code.replace(/\n$/, ""))}</code></pre>`;
      continue;
    }
    // table
    if (/\|/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && /\|/.test(lines[i + 1])) {
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(ln);
      i += 2;
      let rows = "";
      while (i < lines.length && /\|/.test(lines[i])) { rows += "<tr>" + cells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>"; i++; }
      html += `<table class="md-table"><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
      continue;
    }
    // heading
    let h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const lv = h[1].length; html += `<h${lv} class="md-h md-h${lv}">${inline(h[2])}</h${lv}>`; i++; continue; }
    // blockquote
    if (/^>\s?/.test(ln)) { html += `<blockquote class="md-quote">${inline(ln.replace(/^>\s?/, ""))}</blockquote>`; i++; continue; }
    // checklist / list block
    if (/^\s*[-*]\s+\[[ x]\]/.test(ln) || /^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
      const ordered = /^\s*\d+\.\s+/.test(ln);
      let items = "";
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        let it = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
        const chk = it.match(/^\[([ x])\]\s+(.*)$/);
        if (chk) {
          const done = chk[1] === "x";
          items += `<li class="md-task ${done ? "done" : ""}"><span class="md-box">${done ? "✓" : ""}</span><span>${inline(chk[2])}</span></li>`;
        } else {
          items += `<li>${inline(it)}</li>`;
        }
        i++;
      }
      const cls = /md-task/.test(items) ? "md-list md-tasks" : "md-list";
      html += ordered ? `<ol class="${cls}">${items}</ol>` : `<ul class="${cls}">${items}</ul>`;
      continue;
    }
    // hr
    if (/^---+$/.test(ln)) { html += '<hr class="md-hr" />'; i++; continue; }
    // blank
    if (/^\s*$/.test(ln)) { i++; continue; }
    // paragraph (gather until blank)
    let para = ln; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|>|```|---+$|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]) && !/\|/.test(lines[i])) {
      para += " " + lines[i]; i++;
    }
    html += `<p class="md-p">${inline(para)}</p>`;
  }
  return html;
}

/* --------------------------------- avatars -------------------------------- */
// Deterministic warm-tone avatar color from a name.
function avatarTone(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const hue = 20 + (h % 60); // warm band 20–80
  return `oklch(0.82 0.06 ${hue})`;
}
function initials(name) {
  const n = name.replace(/^(조용한|느긋한|성실한|호기심|졸린|날쌘|푸근한|단단한)\s*/, "");
  return n.slice(0, 1);
}

/* ----------------------------- sample dataset ----------------------------- */
const NOW = Date.now();
const min = 60 * 1000;
const SESSION_LEN = 90 * min;

const USERS = {
  me: { id: "me", nick: "느긋한 펭귄", display: "느긋한 펭귄", admin: false },
  a: { id: "u_a", nick: "조용한 다람쥐", display: "민지", admin: false },
  b: { id: "u_b", nick: "성실한 두루미", display: "성실한 두루미", admin: false },
  c: { id: "u_c", nick: "호기심 여우", display: "준호", admin: false },
  admin: { id: "u_admin", nick: "관리자", display: "관리자 · 김선우", admin: true },
};

// S1 = yesterday, S2 = today (recent)
const S1 = NOW - 25 * 60 * min;
const S2 = NOW - 22 * min;

const CHANNELS = [
  { id: "default", name: "일반" },
  { id: "homework", name: "과제" },
  { id: "qna", name: "Q&A" },
  { id: "resources", name: "자료실" },
];

const SEED_ITEMS = [
  {
    id: "it1", channel: "default", type: "text", user: USERS.admin, session: S1, t: S1 + 2 * min,
    body: `## 2차시 · 컴포넌트 설계 안내\n오늘은 **재사용 가능한 컴포넌트**를 직접 만들어 봅니다. 시작 전 아래를 확인해 주세요.\n\n- [x] 저장소 클론 완료\n- [x] \`pnpm install\` 실행\n- [ ] 개발 서버 \`pnpm dev\` 확인\n\n> 막히는 부분은 Q&A 채널에 바로 올려 주세요.`,
  },
  {
    id: "it2", channel: "default", type: "link", user: USERS.b, session: S1, t: S1 + 14 * min,
    link: { url: "https://developer.mozilla.org/ko/docs/Web/CSS/CSS_grid_layout",
      title: "CSS 그리드 레이아웃 - MDN Web Docs", site: "developer.mozilla.org",
      desc: "CSS 그리드 레이아웃은 행과 열로 이루어진 2차원 레이아웃 시스템으로, 복잡한 레이아웃을 직관적으로 구성할 수 있습니다.",
      image: "grid" },
  },
  {
    id: "it3", channel: "default", type: "text", user: USERS.a, session: S1, t: S1 + 41 * min,
    body: "제출용 함수 초안이에요. 네이밍 피드백 부탁드려요 🙏\n\n```js\nfunction groupBySession(items, len) {\n  const map = new Map();\n  for (const it of items) {\n    const key = Math.floor(it.t / len) * len;\n    (map.get(key) ?? map.set(key, []).get(key)).push(it);\n  }\n  return map;\n}\n```",
  },
  {
    id: "it4", channel: "default", type: "file", user: USERS.c, session: S2, t: S2 + 3 * min,
    file: { name: "wireframe-board-v2.png", mime: "image/png", size: 842_000, preview: "wire" },
  },
  {
    id: "it5", channel: "default", type: "link", user: USERS.me, session: S2, t: S2 + 9 * min,
    link: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "레이아웃 디버깅 라이브", site: "youtube.com", youtube: "dQw4w9WgXcQ" },
  },
  {
    id: "it6", channel: "default", type: "text", user: USERS.me, session: S2, t: S2 + 12 * min,
    body: "| 항목 | 상태 | 담당 |\n| --- | --- | --- |\n| 카드 레이아웃 | 진행중 | 나 |\n| 붙여넣기 | 완료 | 민지 |\n| 파일 업로드 | 대기 | 준호 |",
  },
  {
    id: "it7", channel: "default", type: "file", user: USERS.b, session: S2, t: S2 + 16 * min,
    file: { name: "2차시-실습자료.pdf", mime: "application/pdf", size: 2_410_000 },
  },
  {
    id: "it8", channel: "default", type: "text", user: USERS.admin, session: S2, t: S2 + 7 * min,
    body: `다음 주 세션 방식을 정해요 — 투표해 주세요!\n\n\`\`\`poll\n1. 라이브 코딩 세션\n2. 코드 리뷰 중심\n3. 개인 과제 + Q&A\n\`\`\``,
  },
];
window.PileData = {
  I, esc, fmtSize, fmtTime, relTime, isUrl, ytId, renderMarkdown,
  avatarTone, initials, USERS, CHANNELS, SEED_ITEMS, SESSION_LEN, NOW,
};
