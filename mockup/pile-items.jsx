// pile-items.jsx — item card + per-type renderers
const { I, fmtSize, fmtTime, relTime, renderMarkdown, avatarTone, initials, ytId } = window.PileData;

const POLL_EMOJIS = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
const POLL_SPLIT_RE = /(```poll\n[\s\S]*?```)/;

/* striped placeholder for any imagery we don't actually have */
function Placeholder({ label, h = 150, tone = "62 0.02 70" }) {
  const id = "ph" + Math.random().toString(36).slice(2, 7);
  return (
    <div className="ph" style={{ height: h }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={id} width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="9" height="9" fill={`oklch(0.93 0.012 80)`} />
            <line x1="0" y1="0" x2="0" y2="9" stroke={`oklch(0.88 0.02 75)`} strokeWidth="4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      <span className="ph-label">{label}</span>
    </div>
  );
}

function Avatar({ user, s = 26 }) {
  return (
    <span className="avatar" style={{ width: s, height: s, background: avatarTone(user.nick), fontSize: s * 0.42 }}>
      {user.admin ? <I.shield s={s * 0.5} /> : initials(user.display || user.nick)}
    </span>
  );
}

/* ---- poll block ---- */
function PollBlock({ choices, itemId, reactions, myId, onReact }) {
  const limited = choices.slice(0, 10);
  const myVoteEmoji = POLL_EMOJIS.slice(0, limited.length).find(
    em => (reactions[em] || []).includes(myId)
  ) || null;
  const totalVotes = limited.reduce((s, _, i) => s + (reactions[POLL_EMOJIS[i]] || []).length, 0);

  const handleVote = (idx) => {
    const em = POLL_EMOJIS[idx];
    if (myVoteEmoji && myVoteEmoji !== em) onReact(itemId, myVoteEmoji); // remove old
    onReact(itemId, em); // toggle new
  };

  return (
    <div className="poll">
      <div className="poll-head"><I.poll s={12} /> 투표</div>
      <div className="poll-choices">
        {limited.map((choice, i) => {
          const em = POLL_EMOJIS[i];
          const count = (reactions[em] || []).length;
          const pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
          const voted = myVoteEmoji === em;
          return (
            <button key={i} className={`poll-choice${voted ? " voted" : ""}`} onClick={() => handleVote(i)}>
              <span className="poll-bar" style={{ "--w": pct + "%" }}></span>
              <span className="poll-em">{em}</span>
              <span className="poll-text">{choice}</span>
              <span className="poll-count">{count > 0 ? count : ""}</span>
              <span className="poll-pct">{totalVotes > 0 ? pct + "%" : ""}</span>
            </button>
          );
        })}
      </div>
      <div className="poll-footer">
        <span>{totalVotes > 0 ? `총 ${totalVotes}표` : "아직 투표가 없어요"}</span>
        {myVoteEmoji && <span className="poll-hint">선택됨 · 다시 누르면 취소</span>}
      </div>
    </div>
  );
}

/* ---- type bodies ---- */
function TextBody({ item, reactions, myId, onReact }) {
  const parts = item.body.split(POLL_SPLIT_RE);
  if (parts.length === 1) {
    return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.body) }} />;
  }
  const pollFence = parts[1] || "";
  const choices = pollFence
    .replace(/^```poll\n/, "").replace(/```$/, "")
    .split("\n")
    .map(l => { const m = l.match(/^\s*\d+\.\s+(.+)$/); return m ? m[1].trim() : null; })
    .filter(Boolean);
  return (
    <div className="md">
      {parts[0] && parts[0].trim() && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(parts[0]) }} />}
      <PollBlock choices={choices} itemId={item.id}
        reactions={reactions} myId={myId} onReact={onReact} />
      {parts[2] && parts[2].trim() && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(parts[2]) }} />}
    </div>
  );
}

function LinkBody({ item }) {
  const lk = item.link;
  const yt = lk.youtube || ytId(lk.url || "");
  if (yt) {
    return (
      <a className="link-yt" href={lk.url} target="_blank" rel="noopener">
        <div className="yt-thumb">
          <Placeholder label="YouTube 임베드 · video embed" h={184} />
          <span className="yt-play"><I.play s={22} /></span>
          <span className="yt-badge">youtube.com</span>
        </div>
        <span className="yt-title">{lk.title}</span>
      </a>
    );
  }
  return (
    <a className="link-card" href={lk.url} target="_blank" rel="noopener">
      {lk.image && <div className="link-img"><Placeholder label="대표 이미지 · og:image" h={132} /></div>}
      <div className="link-meta">
        <span className="link-site"><I.link s={12} /> {lk.site}</span>
        <span className="link-title">{lk.title}</span>
        {lk.desc && <span className="link-desc">{lk.desc}</span>}
        <span className="link-url">{lk.url}</span>
      </div>
    </a>
  );
}

function FileBody({ item }) {
  const f = item.file;
  const isImg = f.mime.startsWith("image/");
  if (isImg) {
    return (
      <div className="file-img">
        <Placeholder label={`이미지 미리보기 · ${f.name}`} h={196} />
        <div className="file-foot">
          <I.image s={14} />
          <span className="file-name">{f.name}</span>
          <span className="file-sz">{fmtSize(f.size)}</span>
          <button className="file-dl" title="다운로드"><I.download s={14} /></button>
        </div>
      </div>
    );
  }
  const ext = f.name.split(".").pop().toUpperCase();
  return (
    <a className="file-doc" href="#" onClick={(e) => e.preventDefault()}>
      <span className="file-ext">{ext}</span>
      <span className="file-doc-meta">
        <span className="file-name">{f.name}</span>
        <span className="file-sz">{f.mime} · {fmtSize(f.size)}</span>
      </span>
      <span className="file-dl"><I.download s={16} /></span>
    </a>
  );
}

/* ---- reactions ---- */
const PRESET_EMOJIS = ["👍","❤️","🔥","😂","👀","✅","💡","🤔","🎉","😮","🙏","⭐"];

function Reactions({ itemId, reactions = {}, myId, onReact, filterEmojis = [] }) {
  const { useState: us, useRef: ur, useEffect: ue } = React;
  const [open, setOpen] = us(false);
  const ref = ur(null);

  // close picker on outside click
  ue(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const entries = Object.entries(reactions).filter(([emoji, ids]) => ids.length > 0 && !filterEmojis.includes(emoji));

  return (
    <div className="rxn-row" ref={ref}>
      {entries.map(([emoji, ids]) => {
        const mine = ids.includes(myId);
        return (
          <button key={emoji} className={`rxn-pill ${mine ? "mine" : ""}`}
            onClick={() => onReact(itemId, emoji)}>
            <span className="rxn-em">{emoji}</span>
            <span className="rxn-count">{ids.length}</span>
          </button>
        );
      })}
      <div className="rxn-add-wrap">
        <button className={`rxn-add ${open ? "open" : ""}`} title="리액션 추가"
          onClick={() => setOpen((o) => !o)}>+</button>
        {open && (
          <div className="rxn-picker">
            {PRESET_EMOJIS.map((em) => (
              <button key={em} className="rxn-pick-btn"
                onClick={() => { onReact(itemId, em); setOpen(false); }}>
                {em}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TYPE_LABEL = { text: "텍스트", link: "링크", file: "파일", poll: "투표" };
const TypeIcon = { text: I.text, link: I.link, file: I.file, poll: I.poll };

function ItemCard({ item, me, admin, onDelete, onCopy, onReact, reactions, style, dense, isNew, isPinned, onTogglePin }) {
  const isPoll = item.type === "text" && /```poll\n/.test(item.body);
  const effectiveType = isPoll ? "poll" : item.type;
  const TI = TypeIcon[effectiveType];
  const canDelete = admin || item.user.id === me.id;
  const mine = item.user.id === me.id;
  return (
    <article className={`card ${dense ? "dense" : ""} ${mine ? "mine" : ""} ${isNew ? "is-new" : ""}`} style={style} data-type={item.type}>
      <div className="card-head">
        <Avatar user={item.user} s={dense ? 22 : 26} />
        <span className="card-author">{item.user.display || item.user.nick}</span>
        {item.user.admin && <span className="badge-admin">관리자</span>}
        {mine && !item.user.admin && <span className="badge-me">나</span>}
        <span className="card-type"><TI s={12} /> {TYPE_LABEL[effectiveType]}</span>
        <span className="card-time" title={fmtTime(item.t)}>{relTime(item.t)}</span>
        <span className="card-actions">
          {admin && onTogglePin && (
            <button className={`ia ia-pin ${isPinned ? "is-pinned" : ""}`}
              title={isPinned ? "고정 해제" : "상단 고정"} onClick={() => onTogglePin(item)}>
              <I.pin s={15} />
            </button>
          )}
          <button className="ia" title="복사" onClick={() => onCopy(item)}><I.copy s={15} /></button>
          {canDelete && <button className="ia ia-del" title="삭제" onClick={() => onDelete(item)}><I.trash s={15} /></button>}
        </span>
      </div>
      <div className="card-body">
        {item.type === "text" && <TextBody item={item} reactions={reactions} myId={me.id} onReact={onReact} />}
        {item.type === "link" && <LinkBody item={item} />}
        {item.type === "file" && <FileBody item={item} />}
      </div>
      <Reactions itemId={item.id} reactions={reactions} myId={me.id} onReact={onReact} />
    </article>
  );
}

window.PileItems = { ItemCard, Avatar, Placeholder };
