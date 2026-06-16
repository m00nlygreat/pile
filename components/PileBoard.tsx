"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { I } from "@/components/icons";
import { renderMarkdown } from "@/components/markdown";
import type { BoardPayload, ChannelRecord, FilePayload, ItemRecord, LinkPayload, UserRecord } from "@/lib/types";

const ACCENTS = {
  clay: "oklch(0.58 0.11 45)",
  ink: "oklch(0.32 0.02 60)",
  sage: "oklch(0.55 0.06 150)",
  blue: "oklch(0.55 0.10 245)",
};
const POLL_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const PRESET_EMOJIS = ["👍", "❤️", "🔥", "😂", "👀", "✅", "💡", "🤔", "🎉", "😮", "🙏", "⭐"];
const NAMES = ["느긋한 펭귄", "조용한 다람쥐", "성실한 두루미", "호기심 여우", "단단한 고래", "푸근한 사슴"];

type Tweaks = {
  accentName: keyof typeof ACCENTS;
  texture: boolean;
  pileMode: "feed" | "stack";
  columns: "one" | "two";
  density: "comfortable" | "compact";
};
type Toast = { id: string; msg: string; Icon?: (p: { s?: number }) => ReactElement };
type Peer = { name: string; color: string; x: number; docY: number };
type TrysteroAction = { send: (...args: unknown[]) => void; onMessage?: unknown };
type TrysteroRoom = {
  makeAction: (name: string) => TrysteroAction;
  onPeerJoin?: (peerId: string) => void;
  onPeerLeave?: (peerId: string) => void;
  leave?: () => void;
};

const tweakDefaults: Tweaks = { accentName: "clay", texture: true, pileMode: "stack", columns: "two", density: "comfortable" };

function uid(prefix = "n") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isUrl(s: string) {
  return /^https?:\/\/[^\s]+$/i.test(s.trim());
}

function ytId(url: string) {
  return url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)?.[1] ?? null;
}

function siteOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(d: number) {
  return new Date(d).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function relTime(d: number) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function avatarTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `oklch(0.82 0.06 ${20 + (h % 60)})`;
}

function initials(name: string) {
  return name.replace(/^(조용한|느긋한|성실한|호기심|졸린|날쌘|푸근한|단단한)\s*/, "").slice(0, 1);
}

function dateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "오늘";
  if (d.toDateString() === yest.toDateString()) return "어제";
  const wd = "일월화수목금토"[d.getDay()];
  if (d.getFullYear() === today.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, Icon?: Toast["Icon"]) => {
    const id = uid("toast");
    setToasts((prev) => [...prev, { id, msg, Icon }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 2200);
  }, []);
  return [toasts, push] as const;
}

function saveBoardUser(boardId: string, user: UserRecord) {
  fetch(`/api/boards/${encodeURIComponent(boardId)}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  }).catch(() => undefined);
}

function useLocalUser(boardId: string) {
  const [me, setMe] = useState<UserRecord>({ id: "me", nick: NAMES[0], display: NAMES[0], admin: false });
  useEffect(() => {
    const key = `pile:user:${boardId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const user = JSON.parse(saved) as UserRecord;
      const next = { ...user, admin: false };
      localStorage.setItem(key, JSON.stringify(next));
      setMe(next);
      saveBoardUser(boardId, next);
    }
    else {
      const name = NAMES[Math.floor(Math.random() * NAMES.length)];
      const next = { id: uid("me"), nick: name, display: name, admin: false };
      localStorage.setItem(key, JSON.stringify(next));
      setMe(next);
      saveBoardUser(boardId, next);
    }
  }, [boardId]);
  const update = useCallback((next: UserRecord) => {
    const key = `pile:user:${boardId}`;
    const user = { ...next, admin: false };
    localStorage.setItem(key, JSON.stringify(user));
    setMe(user);
    saveBoardUser(boardId, user);
  }, [boardId]);
  return [me, update] as const;
}

function useTweaks() {
  const [tweaks, setTweaks] = useState<Tweaks>(tweakDefaults);
  useEffect(() => {
    const saved = localStorage.getItem("pile:tweaks");
    if (saved) setTweaks({ ...tweakDefaults, ...(JSON.parse(saved) as Partial<Tweaks>) });
  }, []);
  const setTweak = useCallback(<K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    setTweaks((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("pile:tweaks", JSON.stringify(next));
      return next;
    });
  }, []);
  return [tweaks, setTweak] as const;
}

function useMultiplayer({ boardId, myName, feedRef, onReceiveItem }: { boardId: string; myName: string; feedRef: React.RefObject<HTMLDivElement | null>; onReceiveItem: (item: ItemRecord) => void }) {
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [status, setStatus] = useState<"connecting" | "live">("connecting");
  const [feedScrollTop, setFeedScrollTop] = useState(0);
  const actions = useRef<Record<string, TrysteroAction>>({});
  const onReceiveRef = useRef(onReceiveItem);

  useEffect(() => {
    onReceiveRef.current = onReceiveItem;
  }, [onReceiveItem]);
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const onScroll = () => setFeedScrollTop(feed.scrollTop);
    feed.addEventListener("scroll", onScroll, { passive: true });
    return () => feed.removeEventListener("scroll", onScroll);
  }, [feedRef]);
  useEffect(() => {
    let room: TrysteroRoom | null = null;
    let cancelled = false;
    const peerColor = (id: string) => {
      const colors = ["oklch(0.55 0.13 245)", "oklch(0.52 0.13 145)", "oklch(0.55 0.13 320)", "oklch(0.56 0.13 30)", "oklch(0.52 0.13 190)", "oklch(0.54 0.13 60)"];
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
      return colors[Math.abs(h) % colors.length];
    };
    if (!window.isSecureContext || !globalThis.crypto?.subtle) {
      setStatus("connecting");
      return () => {
        cancelled = true;
      };
    }

    import("trystero").then((tr) => {
      if (cancelled) return;
      try {
        room = tr.joinRoom({ appId: "pile-board-v1" }, boardId) as unknown as TrysteroRoom;
      } catch {
        setStatus("connecting");
        return;
      }
      const curAct = room.makeAction("cur");
      const namAct = room.makeAction("nam");
      const itmAct = room.makeAction("itm");
      actions.current = { curAct, namAct, itmAct };
      room.onPeerJoin = (pid: string) => {
        setPeers((p) => ({ ...p, [pid]: { name: "…", color: peerColor(pid), x: -999, docY: -1 } }));
        setStatus("live");
        namAct.send(myName, { target: pid });
      };
      room.onPeerLeave = (pid: string) => setPeers((p) => Object.fromEntries(Object.entries(p).filter(([id]) => id !== pid)));
      curAct.onMessage = ([x, docY]: [number, number], meta?: { peerId?: string }) => {
        const peerId = meta?.peerId;
        if (peerId) setPeers((p) => (p[peerId] ? { ...p, [peerId]: { ...p[peerId], x, docY } } : p));
      };
      namAct.onMessage = (name: string, meta?: { peerId?: string }) => {
        const peerId = meta?.peerId;
        if (peerId) setPeers((p) => ({ ...p, [peerId]: { ...(p[peerId] ?? { color: peerColor(peerId), x: -999, docY: -1 }), name } }));
      };
      itmAct.onMessage = (item: ItemRecord) => onReceiveRef.current(item);
      setStatus("live");
    }).catch(() => {
      if (!cancelled) setStatus("connecting");
    });
    return () => {
      cancelled = true;
      room?.leave?.();
    };
  }, [boardId, myName]);
  useEffect(() => {
    actions.current.namAct?.send(myName);
  }, [myName]);
  useEffect(() => {
    let raf = 0;
    let pending: [number, number] | null = null;
    const onMove = (e: MouseEvent) => {
      pending = [e.clientX, e.clientY + (feedRef.current?.scrollTop ?? 0)];
      if (!raf) {
        raf = requestAnimationFrame(() => {
          if (pending) actions.current.curAct?.send(pending);
          pending = null;
          raf = 0;
        });
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [feedRef]);
  const broadcastItem = useCallback((item: ItemRecord) => actions.current.itmAct?.send(item), []);
  return { peers, feedScrollTop, status, broadcastItem };
}

function buildLink(url: string): LinkPayload {
  const yt = ytId(url);
  const site = yt ? "youtube.com" : siteOf(url);
  return yt
    ? { url, title: "붙여넣은 영상", site, youtube: yt }
    : { url, title: `${site} 에서 가져온 링크`, site, desc: "메타데이터를 불러오는 중입니다. 가져오지 못하면 원본 URL이 유지됩니다.", image: "og" };
}

async function fileToPayload(file: File): Promise<FilePayload> {
  const dataUrl = file.type.startsWith("image/")
    ? await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      })
    : null;
  return { name: file.name, mime: file.type || "application/octet-stream", size: file.size, preview: file.type.startsWith("image/") ? "drop" : null, dataUrl };
}

export function PileBoard({ boardId, initialData }: { boardId: string; initialData: BoardPayload }) {
  const [channels, setChannels] = useState(initialData.channels);
  const [items, setItems] = useState(initialData.items);
  const [reactions, setReactions] = useState(initialData.reactions);
  const [channel, setChannel] = useState(initialData.channels[0]?.id ?? "default");
  const [admin, setAdmin] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [me, setMe] = useLocalUser(boardId);
  const [tweaks, setTweak] = useTweaks();
  const [toasts, toast] = useToasts();
  const feedRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  const me2 = admin ? { ...me, admin: true, id: me.id, nick: me.nick, display: me.display || me.nick } : me;
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/session")
      .then((res) => (res.ok ? res.json() as Promise<{ admin?: boolean }> : null))
      .then((data) => {
        if (!cancelled && data) setAdmin(Boolean(data.admin));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const addItem = useCallback((item: ItemRecord) => {
    setItems((prev) => (prev.some((old) => old.id === item.id) ? prev : [item, ...prev]));
    setNewId(item.id);
    window.setTimeout(() => setNewId(null), 900);
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  }, []);
  const { peers, feedScrollTop, status, broadcastItem } = useMultiplayer({ boardId, myName: me2.display || me2.nick, feedRef, onReceiveItem: addItem });

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    items.forEach((item) => (next[item.channel] = (next[item.channel] ?? 0) + 1));
    return next;
  }, [items]);
  const channelItems = items.filter((item) => item.channel === channel).sort((a, b) => b.t - a.t);
  const pinnedItems = channelItems.filter((item) => item.pinned);
  const groups = [...new Set(channelItems.map((item) => dateKey(item.t)))].sort().reverse().map((key) => {
    const groupItems = channelItems.filter((item) => dateKey(item.t) === key).sort((a, b) => b.t - a.t);
    return { key, ts: groupItems[0]?.t ?? Date.now(), items: groupItems };
  });
  const dense = tweaks.density === "compact";

  const postItem = async (payload: { type: ItemRecord["type"]; body?: string; link?: LinkPayload; file?: FilePayload }) => {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, channel, user: me2 }),
    });
    if (!res.ok) {
      toast("올릴 수 없어요", I.file);
      return null;
    }
    const item = (await res.json()) as ItemRecord;
    addItem(item);
    broadcastItem(item);
    return item;
  };
  const submitText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const item = await postItem(isUrl(trimmed) ? { type: "link", link: buildLink(trimmed) } : { type: "text", body: text });
    if (item) toast(item.type === "link" ? "링크를 올렸어요" : "텍스트를 올렸어요", item.type === "link" ? I.link : I.text);
  };
  const submitFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.size <= 20 * 1024 * 1024);
    await Promise.all(list.map(async (file, index) => {
      await new Promise((resolve) => window.setTimeout(resolve, index * 120));
      await postItem({ type: "file", file: await fileToPayload(file) });
    }));
    if (list.length) toast(`${list.length}개 파일을 올렸어요`, I.file);
  };

  useEffect(() => {
    const h = (e: ClipboardEvent) => {
      const tag = ((e.target as HTMLElement | null)?.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input") return;
      const dt = e.clipboardData;
      if (!dt) return;
      const images = Array.from(dt.items).filter((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (images[0]) {
        e.preventDefault();
        const file = images[0].getAsFile();
        if (file) {
          submitFiles([new File([file], `붙여넣은-이미지-${Date.now()}.png`, { type: file.type || "image/png" })]);
          toast("이미지를 붙여넣었어요", I.image);
        }
        return;
      }
      const text = dt.getData("text/plain");
      if (text.trim()) {
        e.preventDefault();
        submitText(text);
      }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  });

  const toggleAdmin = async () => {
    const enabled = !admin;
    const password = enabled ? window.prompt("관리자 비밀번호를 입력하세요.") : undefined;
    if (enabled && password === null) return;
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, password }),
    });
    if (!res.ok) {
      setAdmin(false);
      toast("비밀번호가 올바르지 않아요", I.shield);
      return;
    }
    setAdmin(enabled);
    toast(enabled ? "관리자 모드 · 모든 아이템 관리 가능" : "관리자 모드를 껐어요", I.shield);
  };
  const addChannel = async (name: string) => {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return toast("관리자 권한이 필요해요", I.shield);
    const next = (await res.json()) as ChannelRecord;
    setChannels((prev) => [...prev, next]);
    setChannel(next.id);
    toast(`#${name} 채널을 만들었어요`, I.hash);
  };
  const togglePin = async (item: ItemRecord) => {
    const pinned = !item.pinned;
    const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) });
    if (!res.ok) return toast("관리자 권한이 필요해요", I.shield);
    setItems((prev) => prev.map((old) => (old.id === item.id ? { ...old, pinned } : old)));
    toast(pinned ? "상단에 고정했어요" : "고정을 해제했어요", I.pin);
  };
  const deleteItem = async (item: ItemRecord) => {
    const res = await fetch(`/api/items/${encodeURIComponent(item.id)}?userId=${encodeURIComponent(me2.id)}`, { method: "DELETE" });
    if (!res.ok) return toast("삭제 권한이 없어요", I.trash);
    setItems((prev) => prev.filter((old) => old.id !== item.id));
    toast(item.type === "file" ? "파일과 함께 삭제했어요" : "삭제했어요", I.trash);
  };
  const copyItem = (item: ItemRecord) => {
    const text = item.type === "text" ? item.body ?? "" : item.type === "link" ? item.link?.url ?? "" : item.file?.name ?? "";
    navigator.clipboard?.writeText(text).catch(() => undefined);
    toast("클립보드에 복사했어요", I.copy);
  };
  const react = async (itemId: string, emoji: string) => {
    const res = await fetch(`/api/items/${encodeURIComponent(itemId)}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, userId: me2.id, boardId }),
    });
    if (res.ok) setReactions(((await res.json()) as { reactions: BoardPayload["reactions"] }).reactions);
  };
  const renameMe = useCallback((display: string) => {
    const next = { ...me, display };
    setMe(next);
    setItems((prev) => prev.map((item) => (item.user.id === me.id ? { ...item, user: { ...item.user, nick: next.nick, display: next.display } } : item)));
  }, [me, setMe]);

  return (
    <div
      className={`app ${tweaks.texture ? "tex" : ""} pile-${tweaks.pileMode} col-${tweaks.columns} ${dense ? "is-dense" : ""}`}
      style={{ "--accent": ACCENTS[tweaks.accentName] } as React.CSSProperties}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragOver(false);
        if (e.dataTransfer.files.length) submitFiles(e.dataTransfer.files);
        else {
          const text = e.dataTransfer.getData("text/plain");
          if (text) submitText(text);
        }
      }}
    >
      <Topbar boardId={boardId} me={me2} admin={admin} peers={peers} status={status} onToggleAdmin={toggleAdmin} onRename={renameMe} onCopyUrl={() => {
        navigator.clipboard?.writeText(`https://pile.so/${boardId}`).catch(() => undefined);
        toast("보드 URL을 복사했어요", I.share);
      }} />
      <Channels channels={channels} current={channel} counts={counts} admin={admin} onPick={setChannel} onAdd={addChannel} />
      <main className="feed" ref={feedRef}>
        <div className="feed-inner">
          <Composer onSubmit={submitText} />
          <PinnedSection items={pinnedItems} me={me2} admin={admin} onDelete={deleteItem} onCopy={copyItem} onReact={react} reactions={reactions} onTogglePin={togglePin} dense={dense} />
          {groups.length === 0 ? (
            <EmptyState />
          ) : (
            groups.map((group) => (
              <section className="session" key={group.key}>
                <div className="session-head">
                  <span className="session-date-lbl">{dateLabel(group.ts)}</span>
                  <span className="session-line" />
                  <span className="session-count">{group.items.length}개</span>
                </div>
                <div className="session-items">
                  {group.items.map((item, idx) => (
                    <ItemCard key={item.id} item={item} me={me2} admin={admin} onDelete={deleteItem} onCopy={copyItem} onReact={react} reactions={reactions[item.id] ?? {}} isPinned={false} onTogglePin={togglePin} dense={dense} isNew={item.id === newId} style={tweaks.pileMode === "stack" ? ({ "--rot": `${(idx % 3 - 1) * 0.7}deg` } as React.CSSProperties) : undefined} />
                  ))}
                </div>
              </section>
            ))
          )}
          <div className="feed-end">— 더미의 끝 —</div>
        </div>
      </main>
      {dragOver && <DropOverlay />}
      <Toasts toasts={toasts} />
      <TweaksPanel tweaks={tweaks} setTweak={setTweak} />
      <CursorLayer peers={peers} feedScrollTop={feedScrollTop} />
    </div>
  );
}

function Topbar({ boardId, me, admin, peers, status, onToggleAdmin, onRename, onCopyUrl }: { boardId: string; me: UserRecord; admin: boolean; peers: Record<string, Peer>; status: "connecting" | "live"; onToggleAdmin: () => void; onRename: (name: string) => void; onCopyUrl: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.display);
  return (
    <header className="topbar">
      <div className="tb-left">
        <span className="logo"><span className="logo-mark"><span /><span /><span /></span>pile</span>
        <button className="board-url" onClick={onCopyUrl} title="보드 URL 복사"><span className="bu-host">pile.so/</span><span className="bu-id">{boardId}</span><I.copy s={13} /></button>
      </div>
      <div className="tb-right">
        <PeerPips peers={peers} />
        <div className="live-badge" title={status === "live" ? "실시간 연결됨" : "연결 중"}><span className={`live-dot ${status === "live" ? "on" : ""}`} />{status === "live" ? `${Object.keys(peers).length + 1}명` : "연결 중"}</div>
        {editing ? (
          <span className="name-edit">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => {
              if (e.key === "Enter") { onRename(name.trim() || me.nick); setEditing(false); }
              if (e.key === "Escape") { setName(me.display); setEditing(false); }
            }} />
            <button className="ne-ok" onClick={() => { onRename(name.trim() || me.nick); setEditing(false); }} title="이름 저장"><I.check s={14} /></button>
          </span>
        ) : (
          <button className="user-chip" onClick={() => { setName(me.display); setEditing(true); }} title="표시 이름 변경"><I.user s={14} />{me.display || me.nick}</button>
        )}
        <button className={`admin-toggle ${admin ? "on" : ""}`} onClick={onToggleAdmin} title="관리자 모드"><I.shield s={14} />{admin ? "관리자" : "관리자 로그인"}</button>
      </div>
    </header>
  );
}

function Channels({ channels, current, counts, admin, onPick, onAdd }: { channels: ChannelRecord[]; current: string; counts: Record<string, number>; admin: boolean; onPick: (id: string) => void; onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  return (
    <nav className="channels">
      <div className="ch-scroll">
        {channels.map((channel) => (
          <button key={channel.id} className={`chip ${current === channel.id ? "on" : ""}`} onClick={() => onPick(channel.id)}><I.hash s={13} />{channel.name}{counts[channel.id] ? <span className="ch-count">{counts[channel.id]}</span> : null}</button>
        ))}
        {admin && (adding ? (
          <span className="ch-add-edit"><input autoFocus value={val} placeholder="채널 이름" onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); setAdding(false); }
            if (e.key === "Escape") { setVal(""); setAdding(false); }
          }} /></span>
        ) : (
          <button className="chip ch-add" onClick={() => setAdding(true)}><I.plus s={13} />채널</button>
        ))}
      </div>
    </nav>
  );
}

function Composer({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  const submit = () => {
    if (!draft.trim()) return;
    onSubmit(draft);
    setDraft("");
    setOpen(false);
  };
  return (
    <div className={`composer ${open ? "open" : ""}`}>
      {!open ? (
        <button className="composer-rest" onClick={() => setOpen(true)}><span className="ck"><kbd>⌘</kbd><kbd>V</kbd></span><span className="composer-hint">여기에 붙여넣기 — 텍스트 · 링크 · 파일을 던져 두세요</span><span className="composer-cta"><I.clip s={15} />붙여넣기</span></button>
      ) : (
        <div className="composer-edit">
          <textarea ref={ref} value={draft} placeholder="텍스트나 링크를 붙여넣고 Enter… (Markdown 지원)" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === "Escape") { setOpen(false); setDraft(""); }
          }} />
          <div className="composer-foot"><span className="composer-tip">텍스트는 그대로, URL은 링크로, 이미지는 파일로 자동 분류됩니다</span><span className="composer-btns"><button className="btn-ghost" onClick={() => { setOpen(false); setDraft(""); }}>취소</button><button className="btn-pri" onClick={submit} disabled={!draft.trim()}>올리기<kbd>⌘↵</kbd></button></span></div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, s = 26 }: { user: UserRecord; s?: number }) {
  return <span className="avatar" style={{ width: s, height: s, background: avatarTone(user.nick), fontSize: s * 0.42 }}>{user.admin ? <I.shield s={s * 0.5} /> : initials(user.display || user.nick)}</span>;
}

function Placeholder({ label, h = 150 }: { label: string; h?: number }) {
  const id = `ph${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return <div className="ph" style={{ height: h }}><svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id={id} width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="oklch(0.93 0.012 80)" /><line x1="0" y1="0" x2="0" y2="9" stroke="oklch(0.88 0.02 75)" strokeWidth="4" /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} /></svg><span className="ph-label">{label}</span></div>;
}

function ItemCard({ item, me, admin, onDelete, onCopy, onReact, reactions, dense, isNew, isPinned, onTogglePin, style }: { item: ItemRecord; me: UserRecord; admin: boolean; onDelete: (item: ItemRecord) => void; onCopy: (item: ItemRecord) => void; onReact: (itemId: string, emoji: string) => void; reactions: Record<string, string[]>; dense?: boolean; isNew?: boolean; isPinned: boolean; onTogglePin: (item: ItemRecord) => void; style?: React.CSSProperties }) {
  const isPoll = item.type === "text" && /```poll\n/.test(item.body ?? "");
  const effectiveType = isPoll ? "poll" : item.type;
  const TI = effectiveType === "poll" ? I.poll : effectiveType === "link" ? I.link : effectiveType === "file" ? I.file : I.text;
  const canDelete = admin || item.user.id === me.id;
  const mine = item.user.id === me.id;
  return (
    <article className={`card ${dense ? "dense" : ""} ${mine ? "mine" : ""} ${isNew ? "is-new" : ""}`} style={style} data-type={item.type}>
      <div className="card-head"><Avatar user={item.user} s={dense ? 22 : 26} /><span className="card-author">{item.user.display || item.user.nick}</span>{item.user.admin && <span className="badge-admin">관리자</span>}{mine && !item.user.admin && <span className="badge-me">나</span>}<span className="card-type"><TI s={12} />{{ text: "텍스트", link: "링크", file: "파일", poll: "투표" }[effectiveType]}</span><span className="card-time" title={fmtTime(item.t)}>{relTime(item.t)}</span><span className="card-actions">{admin && <button className={`ia ia-pin ${isPinned || item.pinned ? "is-pinned" : ""}`} title={item.pinned ? "고정 해제" : "상단 고정"} onClick={() => onTogglePin(item)}><I.pin s={15} /></button>}<button className="ia" title="복사" onClick={() => onCopy(item)}><I.copy s={15} /></button>{canDelete && <button className="ia ia-del" title="삭제" onClick={() => onDelete(item)}><I.trash s={15} /></button>}</span></div>
      <div className="card-body">{item.type === "text" && <TextBody item={item} reactions={reactions} myId={me.id} onReact={onReact} />}{item.type === "link" && item.link && <LinkBody link={item.link} />}{item.type === "file" && item.file && <FileBody file={item.file} />}</div>
      <Reactions itemId={item.id} reactions={reactions} myId={me.id} onReact={onReact} filterEmojis={POLL_EMOJIS} />
    </article>
  );
}

function TextBody({ item, reactions, myId, onReact }: { item: ItemRecord; reactions: Record<string, string[]>; myId: string; onReact: (itemId: string, emoji: string) => void }) {
  const body = item.body ?? "";
  const parts = body.split(/(```poll\n[\s\S]*?```)/);
  if (parts.length === 1) return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />;
  const choices = (parts[1] ?? "").replace(/^```poll\n/, "").replace(/```$/, "").split("\n").map((line) => line.match(/^\s*\d+\.\s+(.+)$/)?.[1]?.trim()).filter(Boolean).slice(0, 10) as string[];
  return <div className="md">{parts[0]?.trim() && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(parts[0]) }} />}<PollBlock choices={choices} itemId={item.id} reactions={reactions} myId={myId} onReact={onReact} />{parts[2]?.trim() && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(parts[2]) }} />}</div>;
}

function PollBlock({ choices, itemId, reactions, myId, onReact }: { choices: string[]; itemId: string; reactions: Record<string, string[]>; myId: string; onReact: (itemId: string, emoji: string) => void }) {
  const myVoteEmoji = POLL_EMOJIS.slice(0, choices.length).find((emoji) => (reactions[emoji] ?? []).includes(myId)) ?? null;
  const totalVotes = choices.reduce((sum, _, i) => sum + (reactions[POLL_EMOJIS[i]] ?? []).length, 0);
  return <div className="poll"><div className="poll-head"><I.poll s={12} />투표</div><div className="poll-choices">{choices.map((choice, i) => {
    const emoji = POLL_EMOJIS[i];
    const count = (reactions[emoji] ?? []).length;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const voted = myVoteEmoji === emoji;
    return <button key={choice} className={`poll-choice ${voted ? "voted" : ""}`} onClick={() => onReact(itemId, emoji)}><span className="poll-bar" style={{ "--w": `${pct}%` } as React.CSSProperties} /><span className="poll-em">{emoji}</span><span className="poll-text">{choice}</span><span className="poll-count">{count || ""}</span><span className="poll-pct">{totalVotes > 0 ? `${pct}%` : ""}</span></button>;
  })}</div><div className="poll-footer"><span>{totalVotes > 0 ? `총 ${totalVotes}표` : "아직 투표가 없어요"}</span>{myVoteEmoji && <span className="poll-hint">선택됨 · 다시 누르면 취소</span>}</div></div>;
}

function LinkBody({ link }: { link: LinkPayload }) {
  const yt = link.youtube || ytId(link.url);
  if (yt) return <a className="link-yt" href={link.url} target="_blank" rel="noopener noreferrer"><div className="yt-thumb"><Placeholder label="YouTube 임베드 · video embed" h={184} /><span className="yt-play"><I.play s={22} /></span><span className="yt-badge">youtube.com</span></div><span className="yt-title">{link.title}</span></a>;
  return <a className="link-card" href={link.url} target="_blank" rel="noopener noreferrer">{link.image && <div className="link-img"><Placeholder label="대표 이미지 · og:image" h={132} /></div>}<div className="link-meta"><span className="link-site"><I.link s={12} />{link.site}</span><span className="link-title">{link.title}</span>{link.desc && <span className="link-desc">{link.desc}</span>}<span className="link-url">{link.url}</span></div></a>;
}

function FileBody({ file }: { file: FilePayload }) {
  const isImg = file.mime.startsWith("image/");
  if (isImg) return <div className="file-img">{file.dataUrl ? <img className="file-preview" src={file.dataUrl} alt={file.name} /> : <Placeholder label={`이미지 미리보기 · ${file.name}`} h={196} />}<div className="file-foot"><I.image s={14} /><span className="file-name">{file.name}</span><span className="file-sz">{fmtSize(file.size)}</span><a className="file-dl" href={file.dataUrl ?? "#"} download={file.name} title="다운로드"><I.download s={14} /></a></div></div>;
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return <a className="file-doc" href={file.dataUrl ?? "#"} download={file.name} onClick={(e) => { if (!file.dataUrl) e.preventDefault(); }}><span className="file-ext">{ext}</span><span className="file-doc-meta"><span className="file-name">{file.name}</span><span className="file-sz">{file.mime} · {fmtSize(file.size)}</span></span><span className="file-dl"><I.download s={16} /></span></a>;
}

function Reactions({ itemId, reactions, myId, onReact, filterEmojis }: { itemId: string; reactions: Record<string, string[]>; myId: string; onReact: (itemId: string, emoji: string) => void; filterEmojis: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const entries = Object.entries(reactions).filter(([emoji, ids]) => ids.length > 0 && !filterEmojis.includes(emoji));
  return <div className="rxn-row" ref={ref}>{entries.map(([emoji, ids]) => <button key={emoji} className={`rxn-pill ${ids.includes(myId) ? "mine" : ""}`} onClick={() => onReact(itemId, emoji)}><span className="rxn-em">{emoji}</span><span className="rxn-count">{ids.length}</span></button>)}<div className="rxn-add-wrap"><button className={`rxn-add ${open ? "open" : ""}`} title="리액션 추가" onClick={() => setOpen((v) => !v)}>+</button>{open && <div className="rxn-picker">{PRESET_EMOJIS.map((emoji) => <button key={emoji} className="rxn-pick-btn" onClick={() => { onReact(itemId, emoji); setOpen(false); }}>{emoji}</button>)}</div>}</div></div>;
}

function PinnedSection({ items, me, admin, onDelete, onCopy, onReact, reactions, onTogglePin, dense }: { items: ItemRecord[]; me: UserRecord; admin: boolean; onDelete: (item: ItemRecord) => void; onCopy: (item: ItemRecord) => void; onReact: (itemId: string, emoji: string) => void; reactions: BoardPayload["reactions"]; onTogglePin: (item: ItemRecord) => void; dense: boolean }) {
  const [idx, setIdx] = useState(0);
  if (!items.length) return null;
  const safeIdx = Math.min(idx, items.length - 1);
  const behind = [1, 2].map((d) => items[(safeIdx + d) % items.length]).filter(Boolean).slice(0, Math.max(0, items.length - 1));
  return <div className="pinned-section"><div className="pinned-head"><I.pin s={13} /><span className="pinned-lbl">고정된 게시물</span>{items.length > 1 && <span className="pinned-nav"><button className="pnav-btn" onClick={() => setIdx((v) => (v - 1 + items.length) % items.length)} title="이전">‹</button><span className="pnav-pos">{safeIdx + 1} / {items.length}</span><button className="pnav-btn" onClick={() => setIdx((v) => (v + 1) % items.length)} title="다음">›</button></span>}</div><div className="pinned-pile">{behind.reverse().map((item, i) => <div key={item.id} className="pinned-slot behind" style={{ "--dist": i + 1 } as React.CSSProperties}><ItemCard item={item} me={me} admin={admin} onDelete={onDelete} onCopy={onCopy} onReact={onReact} reactions={reactions[item.id] ?? {}} dense={dense} isPinned onTogglePin={onTogglePin} /></div>)}<div className="pinned-slot cur"><ItemCard item={items[safeIdx]} me={me} admin={admin} onDelete={onDelete} onCopy={onCopy} onReact={onReact} reactions={reactions[items[safeIdx].id] ?? {}} dense={dense} isPinned onTogglePin={onTogglePin} /></div></div></div>;
}

function EmptyState() {
  return <div className="empty"><div className="empty-pile"><span /><span /><span /></div><h3>아직 더미가 비어 있어요</h3><p>위에 무엇이든 붙여넣거나 파일을 끌어다 놓으면<br />이 채널에 첫 자료가 쌓입니다.</p></div>;
}

function DropOverlay() {
  return <div className="drop-overlay"><div className="drop-card"><I.download s={30} /><strong>여기에 놓으세요</strong><span>파일은 미리보기 또는 다운로드로, 텍스트는 아이템으로 쌓입니다</span></div></div>;
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return <div className="toasts">{toasts.map(({ id, msg, Icon }) => <div className="toast" key={id}>{Icon && <Icon s={15} />}<span>{msg}</span></div>)}</div>;
}

function TweaksPanel({ tweaks, setTweak }: { tweaks: Tweaks; setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void }) {
  const [open, setOpen] = useState(false);
  return <div className={`twk ${open ? "open" : ""}`}><button className="twk-fab" onClick={() => setOpen((v) => !v)} title="Tweaks">Tweaks</button>{open && <div className="twk-panel"><div className="twk-hd"><b>Tweaks</b><button onClick={() => setOpen(false)} aria-label="Close tweaks">×</button></div><div className="twk-body"><div className="twk-sect">모양 · Appearance</div><div className="twk-row"><span>강조색</span><div className="twk-colors">{(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).map((name) => <button key={name} className={tweaks.accentName === name ? "on" : ""} style={{ background: ACCENTS[name] }} onClick={() => setTweak("accentName", name)} title={name} />)}</div></div><Radio label="질감" value={tweaks.texture ? "on" : "off"} options={["on", "off"]} onChange={(v) => setTweak("texture", v === "on")} /><div className="twk-sect">더미 · Pile</div><Radio label="쌓는 방식" value={tweaks.pileMode} options={["feed", "stack"]} onChange={(v) => setTweak("pileMode", v as Tweaks["pileMode"])} /><Radio label="열" value={tweaks.columns} options={["one", "two"]} onChange={(v) => setTweak("columns", v as Tweaks["columns"])} /><Radio label="밀도" value={tweaks.density} options={["comfortable", "compact"]} onChange={(v) => setTweak("density", v as Tweaks["density"])} /></div></div>}</div>;
}

function Radio({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div className="twk-row"><span>{label}</span><div className="twk-seg" role="radiogroup">{options.map((option) => <button key={option} role="radio" aria-checked={option === value} className={option === value ? "on" : ""} onClick={() => onChange(option)}>{option}</button>)}</div></div>;
}

function PeerPips({ peers }: { peers: Record<string, Peer> }) {
  const list = Object.values(peers);
  if (!list.length) return null;
  return <div className="peer-pips">{list.slice(0, 6).map((peer, i) => <span key={i} className="peer-pip" style={{ background: peer.color }} title={peer.name}>{(peer.name || "?")[0].toUpperCase()}</span>)}{list.length > 6 && <span className="peer-pip-more">+{list.length - 6}</span>}</div>;
}

function CursorLayer({ peers, feedScrollTop }: { peers: Record<string, Peer>; feedScrollTop: number }) {
  return <div className="cursor-layer">{Object.entries(peers).map(([id, peer]) => {
    const screenY = peer.docY - feedScrollTop;
    if (screenY < -60 || screenY > window.innerHeight + 20) return null;
    return <div key={id} className="remote-cursor" style={{ left: peer.x, top: screenY }}><svg width="18" height="20" viewBox="0 0 18 20" fill="none"><path d="M2 1.5L15.5 9L9.5 11.5L7 18L2 1.5Z" fill={peer.color} stroke="white" strokeWidth="1.6" strokeLinejoin="round" /></svg><span style={{ background: peer.color }}>{peer.name || "…"}</span></div>;
  })}</div>;
}
