// pile-app.jsx — board shell, composer, interactions, tweaks
const { useState, useEffect, useRef, useCallback } = React;
const PD = window.PileData;
const { I, isUrl, ytId, fmtSize, USERS, CHANNELS, SEED_ITEMS } = PD;
const { ItemCard } = window.PileItems;

const ACCENTS = {
  clay: "oklch(0.58 0.11 45)",
  ink: "oklch(0.32 0.02 60)",
  sage: "oklch(0.55 0.06 150)",
  blue: "oklch(0.55 0.10 245)"
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "oklch(0.58 0.11 45)",
  "pileMode": "stack",
  "columns": "two",
  "density": "comfortable",
  "texture": true
} /*EDITMODE-END*/;

let UID = 1000;
const uid = () => "n" + ++UID;

/* ------------------------------- toast hook ------------------------------- */
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, icon) => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);
  return [toasts, push];
}

/* --------------------------- session grouping ----------------------------- */
function groupBySession(items) {
  const sessions = [...new Set(items.map((i) => i.session))].sort((a, b) => a - b);
  // kept for compat but unused
}
function dateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function groupByDate(items) {
  const keys = [...new Set(items.map((i) => dateKey(i.t)))].sort().reverse();
  return keys.map((key) => ({
    key,
    ts: items.filter((i) => dateKey(i.t) === key).sort((a, b) => b.t - a.t)[0].t,
    items: items.filter((i) => dateKey(i.t) === key).sort((a, b) => b.t - a.t)
  }));
}
function dateLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(today);yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yest.toDateString()) return "어제";
  const wd = "일월화수목금토"[d.getDay()];
  if (d.getFullYear() === today.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

/* -------------------------- runtime item builders ------------------------- */
function buildFromText(text, user, session, channel) {
  const trimmed = text.trim();
  if (isUrl(trimmed)) {
    const url = trimmed;
    const yt = ytId(url);
    let host = url;
    try {host = new URL(url).hostname.replace(/^www\./, "");} catch (e) {}
    return {
      id: uid(), channel, type: "link", user, session, t: Date.now(),
      link: yt ?
      { url, title: "붙여넣은 영상", site: "youtube.com", youtube: yt } :
      { url, title: host + " 에서 가져온 링크", site: host,
        desc: "메타데이터를 불러오는 중입니다… 가져오지 못하면 원본 URL이 유지됩니다.",
        image: "og" }
    };
  }
  return { id: uid(), channel, type: "text", user, session, t: Date.now(), body: text };
}
function buildFromFile(file, user, session, channel) {
  return {
    id: uid(), channel, type: "file", user, session, t: Date.now(),
    file: { name: file.name, mime: file.type || "application/octet-stream", size: file.size,
      preview: file.type && file.type.startsWith("image/") ? "drop" : null }
  };
}

/* ----------------------------- pinned section ----------------------------- */
function PinnedSection({ items, me, admin, onDelete, onCopy, onReact, reactions, onTogglePin, dense }) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, Math.max(0, items.length - 1));
  if (items.length === 0) return null;
  const hasMany = items.length > 1;
  const prev = () => setIdx(i => (i - 1 + items.length) % items.length);
  const next = () => setIdx(i => (i + 1) % items.length);
  // behind = next items in circular order, up to 2
  const behind = [];
  for (let d = 1; d <= Math.min(2, items.length - 1); d++)
    behind.push({ it: items[(safeIdx + d) % items.length], dist: d });
  return (
    <div className="pinned-section">
      <div className="pinned-head">
        <I.pin s={13} />
        <span className="pinned-lbl">고정된 게시물</span>
        {hasMany && (
          <span className="pinned-nav">
            <button className="pnav-btn" onClick={prev} title="이전">‹</button>
            <span className="pnav-pos">{safeIdx + 1} / {items.length}</span>
            <button className="pnav-btn" onClick={next} title="다음">›</button>
          </span>
        )}
      </div>
      <div className="pinned-pile">
        {/* behind cards — absolute, lower z-index, rotated */}
        {[...behind].reverse().map(({ it, dist }) => (
          <div key={it.id} className="pinned-slot behind" style={{ "--dist": dist }}>
            <ItemCard item={it} me={me} admin={admin}
              onDelete={onDelete} onCopy={onCopy} onReact={onReact}
              reactions={reactions[it.id] || {}}
              dense={dense} isNew={false} isPinned={true} onTogglePin={onTogglePin} />
          </div>
        ))}
        {/* current card — relative, drives container height */}
        <div className="pinned-slot cur">
          <ItemCard item={items[safeIdx]} me={me} admin={admin}
            onDelete={onDelete} onCopy={onCopy} onReact={onReact}
            reactions={reactions[items[safeIdx].id] || {}}
            dense={dense} isNew={false} isPinned={true} onTogglePin={onTogglePin} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- composer ------------------------------- */
function Composer({ onSubmit, onPaste }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef(null);
  useEffect(() => {if (open && ref.current) ref.current.focus();}, [open]);
  const submit = () => {if (draft.trim()) {onSubmit(draft);setDraft("");setOpen(false);}};
  return (
    <div className={`composer ${open ? "open" : ""}`}>
      {!open ?
      <button className="composer-rest" onClick={() => setOpen(true)}>
          <span className="ck"><kbd>⌘</kbd><kbd>V</kbd></span>
          <span className="composer-hint">여기에 붙여넣기 — 텍스트 · 링크 · 파일을 던져 두세요</span>
          <span className="composer-cta"><I.clip s={15} /> 붙여넣기</span>
        </button> :

      <div className="composer-edit">
          <textarea ref={ref} value={draft} placeholder="텍스트나 링크를 붙여넣고 Enter… (Markdown 지원)"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();if (e.key === "Escape") {setOpen(false);setDraft("");}}} />
          <div className="composer-foot">
            <span className="composer-tip">텍스트는 그대로, URL은 링크로, 이미지는 파일로 자동 분류됩니다</span>
            <span className="composer-btns">
              <button className="btn-ghost" onClick={() => {setOpen(false);setDraft("");}}>취소</button>
              <button className="btn-pri" onClick={submit} disabled={!draft.trim()}>올리기<kbd>⌘↵</kbd></button>
            </span>
          </div>
        </div>
      }
    </div>);

}

/* ---------------------------------- topbar -------------------------------- */
function Topbar({ board, me, admin, onToggleAdmin, onRename, onCopyUrl, peers, multiStatus }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.display);
  return (
    <header className="topbar">
      <div className="tb-left">
        <span className="logo"><span className="logo-mark"><span></span><span></span><span></span></span>pile</span>
        <button className="board-url" onClick={onCopyUrl} title="보드 URL 복사">
          <span className="bu-host">pile.so/</span><span className="bu-id">{board}</span>
          <I.copy s={13} />
        </button>
      </div>
      <div className="tb-right">
        {Object.keys(peers).length > 0 && <PeerPips peers={peers} />}
        <div className="live-badge" title={multiStatus === 'live' ? '실시간 연결됨' : '연결 중…'}>
          <span className={`live-dot ${multiStatus === 'live' ? 'on' : ''}`} />
          {multiStatus === 'live' ? `${Object.keys(peers).length + 1}명` : '연결 중'}
        </div>
        {editing ?
        <span className="name-edit">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {if (e.key === "Enter") {onRename(name);setEditing(false);}if (e.key === "Escape") setEditing(false);}} />
            <button className="ne-ok" onClick={() => {onRename(name);setEditing(false);}}><I.check s={14} /></button>
          </span> :

        <button className="user-chip" onClick={() => setEditing(true)} title="표시 이름 변경">
            <I.user s={14} /> {me.display || me.nick}
          </button>
        }
        <button className={`admin-toggle ${admin ? "on" : ""}`} onClick={onToggleAdmin} title="관리자 모드">
          <I.shield s={14} /> {admin ? "관리자" : "관리자 로그인"}
        </button>
      </div>
    </header>);

}

/* ------------------------------- channel tabs ----------------------------- */
function Channels({ channels, current, counts, onPick, admin, onAdd }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  return (
    <nav className="channels">
      <div className="ch-scroll">
        {channels.map((c) =>
        <button key={c.id} className={`chip ${current === c.id ? "on" : ""}`} onClick={() => onPick(c.id)}>
            <I.hash s={13} />{c.name}
            {counts[c.id] ? <span className="ch-count">{counts[c.id]}</span> : null}
          </button>
        )}
        {admin && (adding ?
        <span className="ch-add-edit">
            <input autoFocus value={val} placeholder="채널 이름" onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {if (e.key === "Enter" && val.trim()) {onAdd(val.trim());setVal("");setAdding(false);}if (e.key === "Escape") setAdding(false);}} />
          </span> :

        <button className="chip ch-add" onClick={() => setAdding(true)}><I.plus s={13} /> 채널</button>)
        }
      </div>
    </nav>);

}

/* ----------------------------------- app ---------------------------------- */
function App() {
  const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [items, setItems] = useState(SEED_ITEMS);
  const [pinnedIds, setPinnedIds] = useState(new Set(["it1"]));
  const [reactions, setReactions] = useState({
    "it1": { "🔥": ["u_a", "u_b"], "✅": ["u_admin"] },
    "it2": { "👍": ["u_c", "me"], "💡": ["u_b"] },
    "it3": { "💡": ["u_a", "u_admin", "u_c"], "❤️": ["me"] },
    "it5": { "😂": ["u_b"] },
    "it6": { "👀": ["u_a", "me"] },
    "it8": { "1️⃣": ["u_a", "u_b"], "2️⃣": ["u_c"] }
  });
  const scrollRef = useRef(null);
  const [channels, setChannels] = useState(CHANNELS);
  const [channel, setChannel] = useState("default");
  const [me, setMe] = useState(USERS.me);
  const [admin, setAdmin] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [newId, setNewId] = useState(null);
  const [toasts, toast] = useToasts();
  const dragDepth = useRef(0);

  const board = "frontend-101";
  const curSession = Math.max(...SEED_ITEMS.map((i) => i.session));

  const addItem = useCallback((item) => {
    setItems((prev) => [...prev, item]);
    setNewId(item.id);
    setTimeout(() => setNewId(null), 900);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const me2 = admin ? { ...me, display: me.display, admin: true } : me;

  /* ── 멀티플레이어 ── */
  const { peers, feedScrollTop, status: multiStatus, broadcastItem } = window.useMultiplayer({
    roomId: board,
    myName: me.display || me.nick,
    feedRef: scrollRef,
    onReceiveItem: addItem
  });

  const onSubmitText = (text) => {
    const it = buildFromText(text, me2, curSession, channel);
    addItem(it);
    broadcastItem(it);
    toast(it.type === "link" ? "링크를 올렸어요" : "텍스트를 올렸어요", it.type === "link" ? I.link : I.text);
  };
  const onFiles = (files) => {
    [...files].forEach((f, k) => setTimeout(() => {
      const it = buildFromFile(f, me2, curSession, channel);
      addItem(it);
      broadcastItem(it);
    }, k * 120));
    toast(`${files.length}개 파일을 올렸어요`, I.file);
  };

  // global paste
  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") return; // let composer handle
      const dt = e.clipboardData;
      if (!dt) return;
      const imgs = [...dt.items].filter((it) => it.kind === "file" && it.type.startsWith("image/"));
      if (imgs.length) {
        e.preventDefault();
        const f = imgs[0].getAsFile();
        const it = buildFromFile({ name: `붙여넣은-이미지-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.png`, type: "image/png", size: f ? f.size : 184320 }, me2, curSession, channel);
        addItem(it);toast("이미지를 붙여넣었어요", I.image);return;
      }
      const text = dt.getData("text/plain");
      if (text && text.trim()) {e.preventDefault();onSubmitText(text);}
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  });

  // drag & drop
  const dragHandlers = {
    onDragEnter: (e) => {e.preventDefault();dragDepth.current++;setDragOver(true);},
    onDragOver: (e) => e.preventDefault(),
    onDragLeave: (e) => {e.preventDefault();dragDepth.current--;if (dragDepth.current <= 0) setDragOver(false);},
    onDrop: (e) => {
      e.preventDefault();dragDepth.current = 0;setDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);else
      {const txt = e.dataTransfer.getData("text/plain");if (txt) onSubmitText(txt);}
    }
  };

  const onTogglePin = useCallback((item) => {
    const wasPin = pinnedIds.has(item.id);
    setPinnedIds((prev) => {const s = new Set(prev);wasPin ? s.delete(item.id) : s.add(item.id);return s;});
    toast(wasPin ? "고정을 해제했어요" : "상단에 고정했어요", I.pin);
  }, [pinnedIds]);

  const onDelete = (item) => {
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    setPinnedIds((prev) => {const s = new Set(prev);s.delete(item.id);return s;});
    toast(item.type === "file" ? "파일과 함께 삭제했어요" : "삭제했어요", I.trash);
  };
  const onCopy = (item) => {
    const txt = item.type === "text" ? item.body : item.type === "link" ? item.link.url : item.file.name;
    if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {});
    toast("클립보드에 복사했어요", I.copy);
  };
  const onReact = (itemId, emoji) => {
    setReactions((prev) => {
      const item = prev[itemId] || {};
      const ids = item[emoji] || [];
      const myId = me2.id;
      const next = ids.includes(myId) ?
      ids.filter((id) => id !== myId) :
      [...ids, myId];
      return { ...prev, [itemId]: { ...item, [emoji]: next } };
    });
  };

  const onCopyUrl = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(`https://pile.so/${board}`).catch(() => {});
    toast("보드 URL을 복사했어요", I.share);
  };
  const onAddChannel = (name) => {
    const id = "c" + uid();
    setChannels((prev) => [...prev, { id, name }]);
    setChannel(id);
    toast(`#${name} 채널을 만들었어요`, I.hash);
  };

  const counts = {};
  items.forEach((i) => {counts[i.channel] = (counts[i.channel] || 0) + 1;});
  const channelItems = items.filter((i) => i.channel === channel);
  const pinnedItems = channelItems.filter((it) => pinnedIds.has(it.id));
  const groups = groupByDate(channelItems);
  const dense = t.density === "compact";

  return (
    <div className={`app ${t.texture ? "tex" : ""} pile-${t.pileMode} col-${t.columns} ${dense ? "is-dense" : ""}`}
    style={{ "--accent": t.accent }} {...dragHandlers}>
      <Topbar board={board} me={me2} admin={admin}
      onToggleAdmin={() => {setAdmin((a) => !a);toast(admin ? "관리자 모드를 껐어요" : "관리자 모드 · 모든 아이템 관리 가능", I.shield);}}
      onRename={(n) => {setMe((m) => ({ ...m, display: n }));}}
      onCopyUrl={onCopyUrl}
      peers={peers}
      multiStatus={multiStatus} />
      <Channels channels={channels} current={channel} counts={counts} onPick={setChannel} admin={admin} onAdd={onAddChannel} />

      <main className="feed" ref={scrollRef}>
        <div className="feed-inner">
          <Composer onSubmit={onSubmitText} />
          <PinnedSection items={pinnedItems} me={me2} admin={admin}
          onDelete={onDelete} onCopy={onCopy} onReact={onReact}
          reactions={reactions} onTogglePin={onTogglePin} dense={dense} />
          {groups.length === 0 ?
          <div className="empty">
              <div className="empty-pile"><span></span><span></span><span></span></div>
              <h3>아직 더미가 비어 있어요</h3>
              <p>위에 무엇이든 붙여넣거나 파일을 끌어다 놓으면<br />이 채널에 첫 자료가 쌓입니다.</p>
            </div> :
          groups.map((g) =>
          <section className="session" key={g.key}>
              <div className="session-head">
                <span className="session-date-lbl">{dateLabel(g.ts)}</span>
                <span className="session-line"></span>
                <span className="session-count">{g.items.length}개</span>
              </div>
              <div className="session-items">
                {g.items.map((it, idx) =>
              <ItemCard key={it.id} item={it} me={me2} admin={admin}
              onDelete={onDelete} onCopy={onCopy} onReact={onReact}
              reactions={reactions[it.id] || {}}
              isPinned={false} onTogglePin={onTogglePin}
              dense={dense} isNew={it.id === newId}
              style={t.pileMode === "stack" ? { "--rot": (idx % 3 - 1) * 0.7 + "deg" } : undefined} />
              )}
              </div>
            </section>
          )}
          <div className="feed-end">— 더미의 끝 —</div>
        </div>
      </main>

      {dragOver &&
      <div className="drop-overlay">
          <div className="drop-card"><I.download s={30} /><strong>여기에 놓으세요</strong><span>파일은 미리보기 또는 다운로드로, 텍스트는 아이템으로 쌓입니다</span></div>
        </div>
      }

      <div className="toasts">
        {toasts.map((tt) =>
        <div className="toast" key={tt.id}>{tt.icon && <tt.icon s={15} />}<span>{tt.msg}</span></div>
        )}
      </div>

      <TweaksUI t={t} setTweak={setTweak} />
      <CursorLayer peers={peers} feedScrollTop={feedScrollTop} />
    </div>);

}

/* --------------------------------- tweaks --------------------------------- */
function TweaksUI({ t, setTweak }) {
  const { TweaksPanel, TweakSection, TweakColor, TweakRadio } = window;
  return (
    <TweaksPanel>
      <TweakSection label="모양 · Appearance" />
      <TweakColor label="강조색" value={t.accent}
      options={[ACCENTS.clay, ACCENTS.ink, ACCENTS.sage, ACCENTS.blue]}
      onChange={(v) => setTweak("accent", v)} />
      <TweakRadio label="질감" value={t.texture ? "on" : "off"} options={["on", "off"]}
      onChange={(v) => setTweak("texture", v === "on")} />
      <TweakSection label="더미 · Pile" />
      <TweakRadio label="쌓는 방식" value={t.pileMode} options={["feed", "stack"]}
      onChange={(v) => setTweak("pileMode", v)} />
      <TweakRadio label="열" value={t.columns} options={["one", "two"]}
      onChange={(v) => setTweak("columns", v)} />
      <TweakRadio label="밀도" value={t.density} options={["comfortable", "compact"]}
      onChange={(v) => setTweak("density", v)} />
    </TweaksPanel>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);