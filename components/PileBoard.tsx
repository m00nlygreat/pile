"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { I } from "@/components/icons";
import { renderMarkdown } from "@/components/markdown";
import type { BoardPayload, ChannelRecord, FilePayload, ItemRecord, LinkPayload, UserRecord } from "@/lib/types";

const POLL_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
const POLL_FENCE_RE = /(```poll\r?\n[\s\S]*?```)/;
const PRESET_EMOJIS = ["👍", "❤️", "🔥", "😂", "👀", "✅", "💡", "🤔", "🎉", "😮", "🙏", "⭐"];
const NAMES = ["느긋한 펭귄", "조용한 다람쥐", "성실한 두루미", "호기심 여우", "단단한 고래", "푸근한 사슴"];

type Toast = { id: string; msg: string; Icon?: (p: { s?: number }) => ReactElement };
type Peer = { name: string; color: string; x: number; docY: number };
type TrysteroAction = { send: (...args: unknown[]) => void; onMessage?: unknown };
type TrysteroRoom = {
  makeAction: (name: string) => TrysteroAction;
  onPeerJoin?: (peerId: string) => void;
  onPeerLeave?: (peerId: string) => void;
  leave?: () => void;
};

function uid(prefix = "n") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isUrl(s: string) {
  return /^https?:\/\/[^\s]+$/i.test(s.trim());
}

function ytId(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return u.pathname.split("/").filter(Boolean)[0]?.match(/^[\w-]{11}$/)?.[0] ?? null;
    if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) return null;
    const paramId = u.searchParams.get("v");
    if (paramId?.match(/^[\w-]{11}$/)) return paramId;
    const [kind, id] = u.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(kind) && id?.match(/^[\w-]{11}$/)) return id;
    return null;
  } catch {
    return url.match(/(?:youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i)?.[1] ?? null;
  }
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

function createLocalUser() {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  return { id: uid("me"), nick: name, display: name, admin: false };
}

function useLocalUser(boardId: string) {
  const [me, setMe] = useState<UserRecord | null>(null);
  useEffect(() => {
    const key = `pile:user:${boardId}`;
    const saved = localStorage.getItem(key);
    const user = saved ? (JSON.parse(saved) as UserRecord) : createLocalUser();
    const next = { ...user, admin: false };
    localStorage.setItem(key, JSON.stringify(next));
    setMe(next);
    saveBoardUser(boardId, next);
  }, [boardId]);
  const update = useCallback((next: UserRecord) => {
    const key = `pile:user:${boardId}`;
    const user = { ...next, admin: false };
    localStorage.setItem(key, JSON.stringify(user));
    setMe(user);
    saveBoardUser(boardId, user);
  }, [boardId]);
  const ensure = useCallback(() => {
    if (me) return me;
    const key = `pile:user:${boardId}`;
    const saved = localStorage.getItem(key);
    const next = saved ? { ...(JSON.parse(saved) as UserRecord), admin: false } : createLocalUser();
    localStorage.setItem(key, JSON.stringify(next));
    setMe(next);
    return next;
  }, [boardId, me]);
  return [me, update, ensure] as const;
}

function useMultiplayer({
  boardId,
  myName,
  feedRef,
  onReceiveItem,
  onReceiveReactions,
}: {
  boardId: string;
  myName: string;
  feedRef: React.RefObject<HTMLDivElement | null>;
  onReceiveItem: (item: ItemRecord) => void;
  onReceiveReactions: (reactions: BoardPayload["reactions"]) => void;
}) {
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [status, setStatus] = useState<"connecting" | "live">("connecting");
  const [feedScrollTop, setFeedScrollTop] = useState(0);
  const actions = useRef<Record<string, TrysteroAction>>({});
  const onReceiveRef = useRef(onReceiveItem);
  const onReceiveReactionsRef = useRef(onReceiveReactions);

  useEffect(() => {
    onReceiveRef.current = onReceiveItem;
  }, [onReceiveItem]);
  useEffect(() => {
    onReceiveReactionsRef.current = onReceiveReactions;
  }, [onReceiveReactions]);
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
      const rxnAct = room.makeAction("rxn");
      actions.current = { curAct, namAct, itmAct, rxnAct };
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
      rxnAct.onMessage = (next: BoardPayload["reactions"]) => onReceiveReactionsRef.current(next);
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
  const broadcastReactions = useCallback((next: BoardPayload["reactions"]) => actions.current.rxnAct?.send(next), []);
  return { peers, feedScrollTop, status, broadcastItem, broadcastReactions };
}

function useBoardSync(boardId: string, onSync: (payload: BoardPayload) => void, hasRealtimePeer: boolean) {
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let controller: AbortController | null = null;

    const sync = async () => {
      if (cancelled || document.hidden) return;
      controller = new AbortController();
      try {
        const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}`, { cache: "no-store", signal: controller.signal });
        if (res.ok && !cancelled) onSyncRef.current((await res.json()) as BoardPayload);
      } catch {
        // Best-effort backstop for P2P: the next tick will retry.
      } finally {
        controller = null;
        if (!cancelled && !document.hidden) timer = window.setTimeout(sync, hasRealtimePeer ? 60_000 : 15_000);
      }
    };
    const onVisibilityChange = () => {
      window.clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else sync();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!document.hidden) sync();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [boardId, hasRealtimePeer]);
}

function buildLink(url: string): LinkPayload {
  const yt = ytId(url);
  const site = yt ? "youtube.com" : siteOf(url);
  return yt
    ? { url, title: "붙여넣은 영상", site, youtube: yt }
    : { url, title: url, site };
}

function channelPath(boardId: string, channel: Pick<ChannelRecord, "id" | "slug">) {
  const boardPath = `/${encodeURIComponent(boardId)}`;
  return channel.id === "default" ? boardPath : `${boardPath}/${encodeURIComponent(channel.slug)}`;
}

export function PileBoard({ boardId, initialChannelSlug = "default", initialData }: { boardId: string; initialChannelSlug?: string; initialData: BoardPayload }) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialData.channels);
  const [participants, setParticipants] = useState(initialData.users);
  const [items, setItems] = useState(initialData.items);
  const [reactions, setReactions] = useState(initialData.reactions);
  const [channel, setChannel] = useState(initialData.channels.find((item) => item.slug === initialChannelSlug)?.id ?? initialData.channels[0]?.id ?? "default");
  const [admin, setAdmin] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [newId, setNewId] = useState<string | null>(null);
  const [me, setMe, ensureMe] = useLocalUser(boardId);
  const [toasts, toast] = useToasts();
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);

  const displayMe = me ?? { id: "", nick: "익명", display: "익명", admin: false };
  const me2 = admin ? { ...displayMe, admin: true, id: displayMe.id, nick: displayMe.nick, display: displayMe.display || displayMe.nick } : displayMe;
  const currentChannel = channels.find((item) => item.id === channel) ?? channels[0];
  useEffect(() => {
    if (!me) return;
    setParticipants((prev) => (prev.some((user) => user.id === me.id) ? prev : [...prev, me]));
  }, [me]);
  useEffect(() => {
    const path = currentChannel ? channelPath(boardId, currentChannel) : `/${encodeURIComponent(boardId)}`;
    setShareUrl(`${window.location.origin}${path}`);
  }, [boardId, currentChannel]);
  useEffect(() => {
    if (!channels.length) {
      if (channel) setChannel("");
      router.replace(`/${encodeURIComponent(boardId)}`);
      return;
    }
    if (channels.some((item) => item.id === channel)) return;
    const fallback = channels[0];
    setChannel(fallback.id);
    router.replace(channelPath(boardId, fallback));
  }, [boardId, channel, channels, router]);
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
    setParticipants((prev) => (prev.some((user) => user.id === item.user.id) ? prev : [...prev, { ...item.user, admin: false }]));
    setNewId(item.id);
    window.setTimeout(() => setNewId(null), 900);
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
  }, []);
  const applyServerPayload = useCallback((payload: BoardPayload) => {
    setChannels(payload.channels);
    setParticipants(payload.users);
    setItems(payload.items);
    setReactions(payload.reactions);
  }, []);
  const applyReactions = useCallback((next: BoardPayload["reactions"]) => {
    setReactions(next);
  }, []);
  const { peers, feedScrollTop, status, broadcastItem, broadcastReactions } = useMultiplayer({
    boardId,
    myName: me2.display || me2.nick,
    feedRef,
    onReceiveItem: addItem,
    onReceiveReactions: applyReactions,
  });
  useBoardSync(boardId, applyServerPayload, Object.keys(peers).length > 0);

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
  const dense = false;

  const postItem = async (payload: { type: ItemRecord["type"]; body?: string; link?: LinkPayload; file?: FilePayload }) => {
    const author = ensureMe();
    const user = admin ? { ...author, admin: true, display: author.display || author.nick } : author;
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, channel, user }),
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
      const author = ensureMe();
      const user = admin ? { ...author, admin: true, display: author.display || author.nick } : author;
      const form = new FormData();
      form.set("file", file);
      form.set("channel", channel);
      form.set("user", JSON.stringify(user));
      const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/files`, { method: "POST", body: form });
      if (!res.ok) {
        toast("올릴 수 없어요", I.file);
        return;
      }
      const item = (await res.json()) as ItemRecord;
      addItem(item);
      broadcastItem(item);
    }));
    if (list.length) toast(`${list.length}개 파일을 올렸어요`, I.file);
  };

  const shortcutSubmitTextRef = useRef(submitText);
  const shortcutSubmitFilesRef = useRef(submitFiles);
  useEffect(() => {
    shortcutSubmitTextRef.current = submitText;
    shortcutSubmitFilesRef.current = submitFiles;
  });

  useEffect(() => {
    const onShortcutPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editingText = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT" || target?.isContentEditable;
      if (editingText) return;

      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const files = Array.from(clipboard.files);
      if (files.length) {
        event.preventDefault();
        void shortcutSubmitFilesRef.current(files);
        return;
      }

      const text = clipboard.getData("text/plain");
      if (!text.trim()) return;
      event.preventDefault();
      void shortcutSubmitTextRef.current(text);
    };

    window.addEventListener("paste", onShortcutPaste);
    return () => window.removeEventListener("paste", onShortcutPaste);
  }, []);

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
  const addChannel = async (name: string, type: ChannelRecord["type"]) => {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    if (!res.ok) return toast("관리자 권한이 필요해요", I.shield);
    const next = (await res.json()) as ChannelRecord;
    setChannels((prev) => [...prev, next]);
    setChannel(next.id);
    router.push(channelPath(boardId, next));
    toast(`${type === "submission" ? "제출" : "일반"} 채널 #${name}을 만들었어요`, type === "submission" ? I.clip : I.hash);
  };
  const pickChannel = useCallback((next: ChannelRecord) => {
    setChannel(next.id);
    if (!next.archived) router.push(channelPath(boardId, next));
  }, [boardId, router]);
  const editChannel = async (target: ChannelRecord, name: string, slug: string) => {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/channels/${encodeURIComponent(target.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      return payload?.error ?? "채널을 수정할 수 없습니다.";
    }
    const updated = (await res.json()) as ChannelRecord;
    setChannels((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    if (channel === updated.id) router.replace(channelPath(boardId, updated));
    toast(`#${updated.name} 채널을 수정했어요`, I.edit);
    return null;
  };
  const deleteChannel = async (target: ChannelRecord) => {
    const itemCount = counts[target.id] ?? 0;
    const detail = itemCount ? `\n채널 안의 게시물 ${itemCount}개도 모두 삭제됩니다.` : "";
    if (!window.confirm(`#${target.name} 채널을 삭제할까요?${detail}\n이 작업은 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/channels/${encodeURIComponent(target.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      toast(payload?.error ?? "채널을 삭제할 수 없어요", I.trash);
      return;
    }
    const payload = (await res.json()) as { deletedItems?: number };
    const removedItemIds = new Set(items.filter((item) => item.channel === target.id).map((item) => item.id));
    const remaining = channels.filter((item) => item.id !== target.id);
    setChannels(remaining);
    setItems((prev) => prev.filter((item) => item.channel !== target.id));
    setReactions((prev) => Object.fromEntries(Object.entries(prev).filter(([itemId]) => !removedItemIds.has(itemId))));
    if (channel === target.id) {
      const fallback = remaining[0];
      setChannel(fallback?.id ?? "");
      router.replace(fallback ? channelPath(boardId, fallback) : `/${encodeURIComponent(boardId)}`);
    }
    const deletedItems = payload.deletedItems ?? itemCount;
    toast(deletedItems ? `#${target.name} 채널과 게시물 ${deletedItems}개를 삭제했어요` : `#${target.name} 채널을 삭제했어요`, I.trash);
  };
  const archiveChannel = async (target: ChannelRecord, archived: boolean) => {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/channels/${encodeURIComponent(target.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      toast(payload?.error ?? "채널의 아카이브 상태를 바꿀 수 없어요", I.archive);
      return;
    }
    const payload = (await res.json()) as { archivedAt: number | null };
    setChannels((prev) => prev.map((item) => (item.id === target.id ? { ...item, archived, archivedAt: payload.archivedAt } : item)));
    if (archived && channel === target.id) {
      const fallback = channels.find((item) => item.id !== target.id && !item.archived);
      if (fallback) {
        setChannel(fallback.id);
        router.push(channelPath(boardId, fallback));
      }
    }
    toast(archived ? `#${target.name} 채널을 아카이브했어요` : `#${target.name} 채널을 복원했어요`, I.archive);
  };
  const reorderChannelList = async (ordered: ChannelRecord[]) => {
    const previous = channels;
    const positions = channels.filter((item) => !item.archived).map((item) => item.position).sort((a, b) => b - a);
    const positionById = new Map(ordered.map((item, index) => [item.id, positions[index]]));
    setChannels((prev) => prev.map((item) => positionById.has(item.id) ? { ...item, position: positionById.get(item.id)! } : item));
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/channels`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelIds: ordered.map((item) => item.id) }),
    });
    if (!res.ok) {
      setChannels(previous);
      toast("채널 순서를 저장할 수 없어요", I.hash);
    }
  };
  const togglePin = async (item: ItemRecord) => {
    const pinned = !item.pinned;
    const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned }) });
    if (!res.ok) return toast("관리자 권한이 필요해요", I.shield);
    setItems((prev) => prev.map((old) => (old.id === item.id ? { ...old, pinned } : old)));
    toast(pinned ? "상단에 고정했어요" : "고정을 해제했어요", I.pin);
  };
  const deleteItem = async (item: ItemRecord) => {
    const user = ensureMe();
    const res = await fetch(`/api/items/${encodeURIComponent(item.id)}?userId=${encodeURIComponent(user.id)}`, { method: "DELETE" });
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
    const user = ensureMe();
    const res = await fetch(`/api/items/${encodeURIComponent(itemId)}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, userId: user.id, boardId }),
    });
    if (res.ok) {
      const next = ((await res.json()) as { reactions: BoardPayload["reactions"] }).reactions;
      setReactions(next);
      broadcastReactions(next);
    }
  };
  const renameMe = useCallback((display: string) => {
    const current = ensureMe();
    const next = { ...current, display };
    setMe(next);
    setParticipants((prev) => prev.map((user) => (user.id === current.id ? { ...user, nick: next.nick, display: next.display } : user)));
    setItems((prev) => prev.map((item) => (item.user.id === current.id ? { ...item, user: { ...item.user, nick: next.nick, display: next.display } } : item)));
  }, [ensureMe, setMe]);

  return (
    <div
      className="app tex pile-stack col-two"
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
      <Topbar boardId={boardId} shareUrl={shareUrl} me={me2} admin={admin} peers={peers} status={status} onToggleAdmin={toggleAdmin} onRename={renameMe} onShare={() => setShowShare(true)} />
      {showShare && shareUrl && <UrlModal url={shareUrl} onClose={() => setShowShare(false)} />}
      <Channels channels={channels} current={channel} counts={counts} admin={admin} onPick={pickChannel} onAdd={addChannel} onEdit={editChannel} onArchive={archiveChannel} onReorder={reorderChannelList} onDelete={deleteChannel} />
      <main className="feed" ref={feedRef}>
        <div className="feed-inner">
          <PinnedSection items={pinnedItems} me={me2} admin={admin} onDelete={deleteItem} onCopy={copyItem} onReact={react} reactions={reactions} onTogglePin={togglePin} dense={dense} />
          {currentChannel?.type === "submission" ? (
            <SubmissionBoard participants={participants} items={channelItems} me={me2} admin={admin} onDelete={deleteItem} onCopy={copyItem} onReact={react} reactions={reactions} onTogglePin={togglePin} dense={dense} />
          ) : (
            <>
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
                        <ItemCard key={item.id} item={item} me={me2} admin={admin} onDelete={deleteItem} onCopy={copyItem} onReact={react} reactions={reactions[item.id] ?? {}} isPinned={false} onTogglePin={togglePin} dense={dense} isNew={item.id === newId} style={{ "--rot": `${(idx % 3 - 1) * 0.7}deg` } as React.CSSProperties} />
                      ))}
                    </div>
                  </section>
                ))
              )}
              <div className="feed-end">— 더미의 끝 —</div>
            </>
          )}
        </div>
      </main>
      <Composer onSubmitText={submitText} onSubmitFiles={submitFiles} />
      {dragOver && <DropOverlay />}
      <Toasts toasts={toasts} />
      <CursorLayer peers={peers} feedScrollTop={feedScrollTop} />
    </div>
  );
}

function UrlModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-qr"><QRCodeSVG value={url} size={400} /></div>
        <p className="modal-url">{url}</p>
        <div className="modal-actions">
          <button className="btn-pri" onClick={copy}><I.copy s={14} />{copied ? "복사됨!" : "주소 복사"}</button>
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function Topbar({ boardId, shareUrl, me, admin, peers, status, onToggleAdmin, onRename, onShare }: { boardId: string; shareUrl: string; me: UserRecord; admin: boolean; peers: Record<string, Peer>; status: "connecting" | "live"; onToggleAdmin: () => void; onRename: (name: string) => void; onShare: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.display);
  const host = shareUrl ? new URL(shareUrl).host : "";
  return (
    <header className="topbar">
      <div className="tb-left">
        <span className="logo"><span className="logo-mark"><span /><span /><span /></span>pile</span>
        <button className="board-url" onClick={onShare} title="보드 URL 공유"><span className="bu-host">{host ? `${host}/` : ""}</span><span className="bu-id">{boardId}</span><I.share s={13} /></button>
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

type ChannelMenuState = { channel: ChannelRecord; x: number; y: number };

function Channels({ channels, current, counts, admin, onPick, onAdd, onEdit, onArchive, onReorder, onDelete }: {
  channels: ChannelRecord[];
  current: string;
  counts: Record<string, number>;
  admin: boolean;
  onPick: (channel: ChannelRecord) => void;
  onAdd: (name: string, type: ChannelRecord["type"]) => void;
  onEdit: (channel: ChannelRecord, name: string, slug: string) => Promise<string | null>;
  onArchive: (channel: ChannelRecord, archived: boolean) => void;
  onReorder: (channels: ChannelRecord[]) => void;
  onDelete: (channel: ChannelRecord) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const [type, setType] = useState<ChannelRecord["type"]>("standard");
  const [menu, setMenu] = useState<ChannelMenuState | null>(null);
  const [editing, setEditing] = useState<ChannelRecord | null>(null);
  const [openedArchivedId, setOpenedArchivedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const longPressTimer = useRef(0);
  const suppressClickTimer = useRef(0);
  const longPressStart = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const archiveDetailsRef = useRef<HTMLDetailsElement>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 6 } }),
  );
  const archivedChannels = channels
    .filter((channel) => channel.archived)
    .sort((a, b) => (b.archivedAt ?? b.position) - (a.archivedAt ?? a.position));
  const normalChannels = channels.filter((channel) => !channel.archived).sort((a, b) => b.position - a.position);
  const activeChannel = activeId ? normalChannels.find((channel) => channel.id === activeId) : null;
  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    suppressClick.current = true;
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    window.clearTimeout(suppressClickTimer.current);
    suppressClickTimer.current = window.setTimeout(() => { suppressClick.current = false; }, 250);
    if (!over || active.id === over.id) return;
    const oldIndex = normalChannels.findIndex((channel) => channel.id === active.id);
    const newIndex = normalChannels.findIndex((channel) => channel.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(normalChannels, oldIndex, newIndex));
  };
  const handleDragCancel = () => {
    setActiveId(null);
    suppressClick.current = false;
  };
  const create = () => {
    if (!val.trim()) return;
    onAdd(val.trim(), type);
    setVal("");
    setType("standard");
    setAdding(false);
  };
  const openMenu = (channel: ChannelRecord, x: number, y: number) => {
    if (!admin) return;
    setMenu({
      channel,
      x: Math.max(8, Math.min(x, window.innerWidth - 184)),
      y: Math.max(8, Math.min(y, window.innerHeight - 146)),
    });
  };
  const cancelLongPress = () => {
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = 0;
  };
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(".channel-menu")) setMenu(null);
    };
    const closeOnScroll = () => setMenu(null);
    const closeOnKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("resize", closeOnScroll);
    window.addEventListener("scroll", closeOnScroll, true);
    document.addEventListener("keydown", closeOnKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", closeOnScroll);
      window.removeEventListener("scroll", closeOnScroll, true);
      document.removeEventListener("keydown", closeOnKey);
    };
  }, [menu]);
  useEffect(() => () => {
    window.clearTimeout(longPressTimer.current);
    window.clearTimeout(suppressClickTimer.current);
  }, []);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <nav className="channels">
        <div className="ch-scroll">
          <SortableContext items={normalChannels.map((channel) => channel.id)} strategy={horizontalListSortingStrategy}>
            {normalChannels.map((channel) => (
              <SortableChannelChip
                key={channel.id}
                channel={channel}
                current={current}
                count={counts[channel.id] ?? 0}
                admin={admin}
                suppressClick={suppressClick}
                onPick={() => { setOpenedArchivedId(null); onPick(channel); }}
                onOpenMenu={(x, y) => openMenu(channel, x, y)}
              />
            ))}
          </SortableContext>
          {channels.filter((channel) => channel.archived && channel.id === openedArchivedId).map((channel) => (
            <button
              key={channel.id}
              className={`chip ${channel.type === "submission" ? "is-submission" : ""} ${current === channel.id ? "on" : ""}`}
              onClick={() => {
                if (suppressClick.current) { suppressClick.current = false; return; }
                onPick(channel);
              }}
              onContextMenu={(event) => {
                if (!admin) return;
                event.preventDefault();
                openMenu(channel, event.clientX, event.clientY);
              }}
              onKeyDown={(event) => {
                if (admin && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  openMenu(channel, rect.left, rect.bottom + 4);
                }
              }}
              onPointerDown={(event) => {
                if (!admin || event.pointerType === "mouse") return;
                cancelLongPress();
                longPressStart.current = { x: event.clientX, y: event.clientY };
                longPressTimer.current = window.setTimeout(() => {
                  suppressClick.current = true;
                  openMenu(channel, event.clientX, event.clientY);
                }, 550);
              }}
              onPointerMove={(event) => {
                if (Math.hypot(event.clientX - longPressStart.current.x, event.clientY - longPressStart.current.y) > 8) cancelLongPress();
              }}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              aria-haspopup={admin ? "menu" : undefined}
              title={admin ? "우클릭하거나 길게 눌러 채널 관리" : undefined}
            >
              {channel.type === "submission" ? <I.clip s={13} /> : <I.hash s={13} />}
              {channel.name}
              {counts[channel.id] ? <span className="ch-count">{counts[channel.id]}</span> : null}
            </button>
          ))}
        {admin && (adding ? (
          <span className="ch-add-edit">
            <input autoFocus value={val} placeholder="채널 이름" onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") { setVal(""); setType("standard"); setAdding(false); }
            }} />
            <span className="ch-type-select" aria-label="채널 유형">
              <button className={type === "standard" ? "on" : ""} onClick={() => setType("standard")} type="button"><I.hash s={12} />일반</button>
              <button className={type === "submission" ? "on" : ""} onClick={() => setType("submission")} type="button"><I.clip s={12} />제출</button>
            </span>
            <button className="ch-create" onClick={create} disabled={!val.trim()} title="채널 만들기"><I.check s={13} /></button>
          </span>
        ) : (
          <button className="chip ch-add" onClick={() => setAdding(true)}><I.plus s={13} />채널</button>
        ))}
        </div>
      {archivedChannels.length > 0 && (
        <details ref={archiveDetailsRef} className="archive-dropdown">
          <summary aria-label={`아카이브된 채널 ${archivedChannels.length}개`}>
            <I.archive s={14} />아카이브 <span>{archivedChannels.length}</span><I.chevronDown s={12} />
          </summary>
          <div className="archive-dropdown-menu" role="menu">
            {archivedChannels.map((channel) => (
              <button key={channel.id} role="menuitem" onClick={() => {
                setOpenedArchivedId(channel.id);
                archiveDetailsRef.current?.removeAttribute("open");
                onPick(channel);
              }}>
                {channel.type === "submission" ? <I.clip s={13} /> : <I.hash s={13} />}
                <span>{channel.name}</span>
                {counts[channel.id] ? <small>{counts[channel.id]}</small> : null}
              </button>
            ))}
          </div>
        </details>
      )}
      {menu && (
        <div ref={menuRef} className="channel-menu" role="menu" aria-label={`${menu.channel.name} 채널 관리`} style={{ left: menu.x, top: menu.y }}>
          <button role="menuitem" onClick={() => { setEditing(menu.channel); setMenu(null); }}><I.edit s={14} />채널 수정</button>
          <button role="menuitem" onClick={() => { const target = menu.channel; setMenu(null); onArchive(target, !target.archived); }}><I.archive s={14} />{menu.channel.archived ? "언아카이브" : "아카이브"}</button>
          <button className="danger" role="menuitem" onClick={() => { const target = menu.channel; setMenu(null); onDelete(target); }}><I.trash s={14} />채널 삭제</button>
        </div>
      )}
      {editing && <ChannelEditModal channel={editing} onClose={() => setEditing(null)} onSubmit={onEdit} />}
      </nav>
      <DragOverlay
        adjustScale={false}
        dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }}
        modifiers={[restrictToHorizontalAxis]}
        zIndex={300}
      >
        {activeChannel ? (
          <button
            className={`chip channel-drag-ghost ${activeChannel.type === "submission" ? "is-submission" : ""} ${current === activeChannel.id ? "on" : ""}`}
            tabIndex={-1}
            aria-hidden="true"
          >
            {activeChannel.type === "submission" ? <I.clip s={13} /> : <I.hash s={13} />}
            {activeChannel.name}
            {counts[activeChannel.id] ? <span className="ch-count">{counts[activeChannel.id]}</span> : null}
          </button>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableChannelChip({ channel, current, count, admin, suppressClick, onPick, onOpenMenu }: {
  channel: ChannelRecord;
  current: string;
  count: number;
  admin: boolean;
  suppressClick: React.MutableRefObject<boolean>;
  onPick: () => void;
  onOpenMenu: (x: number, y: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: channel.id,
    disabled: !admin,
    transition: { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`chip ${channel.type === "submission" ? "is-submission" : ""} ${current === channel.id ? "on" : ""} ${admin ? "is-reorderable" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform ? { ...transform, y: 0 } : null),
        transition,
        opacity: isDragging ? 0 : undefined,
      }}
      onClick={() => {
        if (suppressClick.current) return;
        onPick();
      }}
      onContextMenu={(event) => {
        if (!admin) return;
        event.preventDefault();
        if ((event.nativeEvent as PointerEvent).pointerType === "touch") return;
        onOpenMenu(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (admin && (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenMenu(rect.left, rect.bottom + 4);
        }
      }}
      aria-haspopup={admin ? "menu" : undefined}
      title={admin ? "드래그하여 순서 변경 · 우클릭하여 관리" : undefined}
    >
      {channel.type === "submission" ? <I.clip s={13} /> : <I.hash s={13} />}
      {channel.name}
      {count ? <span className="ch-count">{count}</span> : null}
    </button>
  );
}

function ChannelEditModal({ channel, onClose, onSubmit }: {
  channel: ChannelRecord;
  onClose: () => void;
  onSubmit: (channel: ChannelRecord, name: string, slug: string) => Promise<string | null>;
}) {
  const [name, setName] = useState(channel.name);
  const [slug, setSlug] = useState(channel.slug);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const slugId = useId();
  const save = async () => {
    if (!name.trim() || !slug.trim() || saving) return;
    setSaving(true);
    setError("");
    const nextError = await onSubmit(channel, name.trim(), slug.trim());
    setSaving(false);
    if (nextError) setError(nextError);
    else onClose();
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);
  return (
    <div className="modal-backdrop" onMouseDown={() => { if (!saving) onClose(); }}>
      <form
        className="modal-box channel-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${nameId}-title`}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => { event.preventDefault(); save(); }}
      >
        <div className="channel-edit-head">
          <span className="channel-edit-icon"><I.edit s={18} /></span>
          <div><h2 id={`${nameId}-title`}>채널 수정</h2><p>채널 이름과 주소용 slug를 변경합니다.</p></div>
        </div>
        <label className="channel-edit-field" htmlFor={nameId}>
          <span>채널명</span>
          <input id={nameId} autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        </label>
        <label className="channel-edit-field" htmlFor={slugId}>
          <span>채널 slug</span>
          <div className="channel-slug-input"><span>/</span><input id={slugId} value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} /></div>
          <small>영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.{channel.id === "default" ? " 기본 채널의 대표 주소는 보드 루트로 유지됩니다." : ""}</small>
        </label>
        {error && <p className="channel-edit-error" role="alert">{error}</p>}
        <div className="modal-actions channel-edit-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>취소</button>
          <button type="submit" className="btn-pri" disabled={!name.trim() || !slug.trim() || saving}>{saving ? "저장 중…" : "변경 저장"}</button>
        </div>
      </form>
    </div>
  );
}

function clipboardFileName(mime: string, index: number) {
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return `붙여넣은-파일-${Date.now()}-${index + 1}.${extensions[mime] ?? "bin"}`;
}

function Composer({ onSubmitText, onSubmitFiles }: {
  onSubmitText: (text: string) => Promise<void>;
  onSubmitFiles: (files: File[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clipboardError, setClipboardError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  const stageClipboard = (text: string, nextFiles: File[]) => {
    setOpen(true);
    setClipboardError("");
    if (text.trim()) setDraft((current) => current ? `${current}\n${text}` : text);
    if (nextFiles.length) setFiles((current) => [...current, ...nextFiles]);
  };

  const readClipboard = async () => {
    setOpen(true);
    setReading(true);
    setClipboardError("");
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        const pastedFiles: File[] = [];
        let text = "";
        for (const item of clipboardItems) {
          const fileType = item.types.find((type) => !type.startsWith("text/"));
          if (fileType) {
            const blob = await item.getType(fileType);
            pastedFiles.push(new File([blob], clipboardFileName(fileType, pastedFiles.length), { type: fileType }));
          } else if (item.types.includes("text/plain")) {
            text += await (await item.getType("text/plain")).text();
          }
        }
        stageClipboard(text, pastedFiles);
      } else if (navigator.clipboard?.readText) {
        stageClipboard(await navigator.clipboard.readText(), []);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      setClipboardError("클립보드 권한을 허용하거나 Ctrl+V로 붙여넣어 주세요.");
    } finally {
      setReading(false);
    }
  };

  const reset = () => {
    setDraft("");
    setFiles([]);
    setClipboardError("");
    setOpen(false);
  };

  const submit = async () => {
    if ((!draft.trim() && files.length === 0) || submitting) return;
    setSubmitting(true);
    try {
      if (draft.trim()) await onSubmitText(draft);
      if (files.length) await onSubmitFiles(files);
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`composer ${open ? "open" : ""}`}>
      {!open ? (
        <button className="composer-rest" onClick={readClipboard} disabled={reading}><span className="ck"><kbd>Ctrl</kbd><kbd>V</kbd></span><span className="composer-hint">클릭해서 클립보드 붙여넣기 — 텍스트 · 링크 · 파일</span><span className="composer-cta"><I.clip s={15} />{reading ? "읽는 중…" : "붙여넣기"}</span></button>
      ) : (
        <div className="composer-edit">
          <textarea ref={ref} value={draft} placeholder="텍스트나 링크를 붙여넣고 Enter… (Markdown 지원)" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === "Escape") reset();
          }} />
          {files.length > 0 && <div className="composer-files">{files.map((file, index) => <span className="composer-file" key={`${file.name}-${file.size}-${index}`}><I.file s={13} /><span>{file.name}</span><small>{fmtSize(file.size)}</small><button type="button" aria-label={`${file.name} 제거`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}>×</button></span>)}</div>}
          <div className="composer-foot"><span className={`composer-tip ${clipboardError ? "is-error" : ""}`}>{clipboardError || "텍스트와 URL, 클립보드의 파일을 확인한 뒤 올릴 수 있습니다"}</span><span className="composer-btns"><button className="btn-ghost" onClick={reset} disabled={submitting}>취소</button><button className="btn-pri" onClick={submit} disabled={(!draft.trim() && files.length === 0) || submitting}>{submitting ? "올리는 중…" : "올리기"}<kbd>⌘↵</kbd></button></span></div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, s = 26 }: { user: UserRecord; s?: number }) {
  return <span className="avatar" style={{ width: s, height: s, background: avatarTone(user.nick), fontSize: s * 0.42 }}>{user.admin ? <I.shield s={s * 0.5} /> : initials(user.display || user.nick)}</span>;
}

function SubmissionBoard({ participants, items, me, admin, onDelete, onCopy, onReact, reactions, onTogglePin, dense }: { participants: UserRecord[]; items: ItemRecord[]; me: UserRecord; admin: boolean; onDelete: (item: ItemRecord) => void; onCopy: (item: ItemRecord) => void; onReact: (itemId: string, emoji: string) => void; reactions: BoardPayload["reactions"]; onTogglePin: (item: ItemRecord) => void; dense: boolean }) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const roster = useMemo(() => {
    const users = new Map(participants.map((user) => [user.id, user]));
    items.forEach((item) => users.set(item.user.id, { ...item.user, admin: false }));
    return [...users.values()].sort((a, b) => (a.display || a.nick).localeCompare(b.display || b.nick, "ko"));
  }, [items, participants]);
  const itemsByUser = useMemo(() => {
    const grouped = new Map<string, ItemRecord[]>();
    items.forEach((item) => grouped.set(item.user.id, [...(grouped.get(item.user.id) ?? []), item]));
    grouped.forEach((userItems) => userItems.sort((a, b) => a.t - b.t));
    return grouped;
  }, [items]);
  const selectedUser = roster.find((user) => user.id === selectedUserId);
  const selectedItems = selectedUserId ? itemsByUser.get(selectedUserId) ?? [] : [];

  return (
    <section className="submission-board">
      {roster.length ? (
        <div className="submission-list">
          {roster.map((user) => {
            const userItems = itemsByUser.get(user.id) ?? [];
            const submitted = userItems.length > 0;
            const person = <><Avatar user={user} s={42} /><span className="submission-name">{user.display || user.nick}{user.id === me.id && <small>나</small>}</span><span className="submission-count">{userItems.length}</span></>;
            return submitted ? (
              <button className="submission-person submitted" key={user.id} onClick={() => setSelectedUserId(user.id)} aria-label={`${user.display || user.nick}의 제출물 보기 · ${userItems.length}개`}>{person}</button>
            ) : (
              <div className="submission-person pending" key={user.id}>{person}</div>
            );
          })}
        </div>
      ) : (
        <div className="submission-empty">아직 보드에 참가한 사용자가 없습니다.</div>
      )}
      <div className="submission-tip"><kbd>Ctrl</kbd><span>+</span><kbd>V</kbd> 텍스트, 링크, 이미지를 바로 제출할 수 있어요.</div>
      {selectedUser && selectedItems.length > 0 && <SubmissionModal user={selectedUser} items={selectedItems} me={me} admin={admin} onClose={() => setSelectedUserId(null)} onDelete={onDelete} onCopy={onCopy} onReact={onReact} reactions={reactions} onTogglePin={onTogglePin} dense={dense} />}
    </section>
  );
}

function SubmissionModal({ user, items, me, admin, onClose, onDelete, onCopy, onReact, reactions, onTogglePin, dense }: { user: UserRecord; items: ItemRecord[]; me: UserRecord; admin: boolean; onClose: () => void; onDelete: (item: ItemRecord) => void; onCopy: (item: ItemRecord) => void; onReact: (itemId: string, emoji: string) => void; reactions: BoardPayload["reactions"]; onTogglePin: (item: ItemRecord) => void; dense: boolean }) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, items.length - 1);
  const go = useCallback((direction: number) => setIndex((current) => (current + direction + items.length) % items.length), [items.length]);
  useEffect(() => {
    setIndex(0);
  }, [user.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && items.length > 1) { event.preventDefault(); go(-1); }
      if (event.key === "ArrowRight" && items.length > 1) { event.preventDefault(); go(1); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, items.length, onClose]);
  const item = items[safeIndex];
  if (!item) return null;
  return (
    <div className="modal-backdrop submission-backdrop" onClick={onClose}>
      <div className="submission-overlay" role="dialog" aria-modal="true" aria-label={`${user.display || user.nick}의 제출물`} onClick={(event) => event.stopPropagation()}>
        <header className="submission-overlay-head"><span className="submission-overlay-user"><Avatar user={user} s={32} /><span><strong>{user.display || user.nick}</strong><small>제출물</small></span></span><span className="submission-overlay-count">{safeIndex + 1} / {items.length}</span><button className="submission-overlay-close" onClick={onClose} aria-label="닫기">×</button></header>
        <div className="submission-stage">
          {items.length > 1 && <button className="submission-nav prev" onClick={() => go(-1)} aria-label="이전 제출물">‹</button>}
          <div className="submission-item"><ItemCard item={item} me={me} admin={admin} onDelete={onDelete} onCopy={onCopy} onReact={onReact} reactions={reactions[item.id] ?? {}} dense={dense} isPinned={item.pinned} onTogglePin={onTogglePin} /></div>
          {items.length > 1 && <button className="submission-nav next" onClick={() => go(1)} aria-label="다음 제출물">›</button>}
        </div>
      </div>
    </div>
  );
}

function Placeholder({ label, h = 150 }: { label: string; h?: number }) {
  const id = `ph${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return <div className="ph" style={{ height: h }}><svg width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id={id} width="9" height="9" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="oklch(0.93 0.012 80)" /><line x1="0" y1="0" x2="0" y2="9" stroke="oklch(0.88 0.02 75)" strokeWidth="4" /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} /></svg><span className="ph-label">{label}</span></div>;
}

function ItemCard({ item, me, admin, onDelete, onCopy, onReact, reactions, dense, isNew, isPinned, onTogglePin, style }: { item: ItemRecord; me: UserRecord; admin: boolean; onDelete: (item: ItemRecord) => void; onCopy: (item: ItemRecord) => void; onReact: (itemId: string, emoji: string) => void; reactions: Record<string, string[]>; dense?: boolean; isNew?: boolean; isPinned: boolean; onTogglePin: (item: ItemRecord) => void; style?: React.CSSProperties }) {
  const isPoll = item.type === "text" && POLL_FENCE_RE.test(item.body ?? "");
  const effectiveType = isPoll ? "poll" : item.type;
  const TI = effectiveType === "poll" ? I.poll : effectiveType === "link" ? I.link : effectiveType === "file" ? I.file : I.text;
  const canDelete = admin || item.user.id === me.id;
  const mine = item.user.id === me.id;
  return (
    <article className={`card ${dense ? "dense" : ""} ${mine ? "mine" : ""} ${isNew ? "is-new" : ""}`} style={style} data-type={item.type}>
      <div className="card-head"><Avatar user={item.user} s={dense ? 22 : 26} /><span className="card-author">{item.user.display || item.user.nick}</span>{item.user.admin && <span className="badge-admin">관리자</span>}{mine && !item.user.admin && <span className="badge-me">나</span>}<span className="card-type"><TI s={12} />{{ text: "텍스트", link: "링크", file: "파일", poll: "투표" }[effectiveType]}</span><span className="card-time" title={fmtTime(item.t)}>{relTime(item.t)}</span><span className="card-actions">{admin && <button className={`ia ia-pin ${isPinned || item.pinned ? "is-pinned" : ""}`} title={item.pinned ? "고정 해제" : "상단 고정"} onClick={() => onTogglePin(item)}><I.pin s={15} /></button>}<button className="ia" title="복사" onClick={() => onCopy(item)}><I.copy s={15} /></button>{canDelete && <button className="ia ia-del" title="삭제" onClick={() => onDelete(item)}><I.trash s={15} /></button>}</span></div>
      <div className="card-body">{item.type === "text" && <TextBody item={item} reactions={reactions} myId={me.id} onReact={onReact} />}{item.type === "link" && item.link && <LinkBody link={item.link} />}{item.type === "file" && item.file && <FileBody file={item.file} />}</div>
      <Reactions itemId={item.id} reactions={reactions} myId={me.id} onReact={onReact} />
    </article>
  );
}

function TextBody({ item, reactions, myId, onReact }: { item: ItemRecord; reactions: Record<string, string[]>; myId: string; onReact: (itemId: string, emoji: string) => void }) {
  const body = item.body ?? "";
  const parts = body.split(POLL_FENCE_RE);
  if (parts.length === 1) return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />;
  const choices = parsePollChoices(parts[1] ?? "");
  return <div className="md">{parts[0]?.trim() && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(parts[0]) }} />}<PollBlock choices={choices} itemId={item.id} reactions={reactions} myId={myId} onReact={onReact} />{parts[2]?.trim() && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(parts[2]) }} />}</div>;
}

function parsePollChoices(fence: string) {
  return fence
    .replace(/^```poll\r?\n/, "")
    .replace(/```$/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line
      .replace(/^\d+\s*[.)．、]\s*/, "")
      .replace(/^[-*+•·]\s*/, "")
      .trim())
    .filter(Boolean)
    .slice(0, 10);
}

function PollBlock({ choices, itemId, reactions, myId, onReact }: { choices: string[]; itemId: string; reactions: Record<string, string[]>; myId: string; onReact: (itemId: string, emoji: string) => void }) {
  const myVoteEmoji = POLL_EMOJIS.slice(0, choices.length).find((emoji) => (reactions[emoji] ?? []).includes(myId)) ?? null;
  const totalVotes = choices.reduce((sum, _, i) => sum + (reactions[POLL_EMOJIS[i]] ?? []).length, 0);
  return <div className="poll"><div className="poll-head"><I.poll s={12} />투표</div><div className="poll-choices">{choices.map((choice, i) => {
    const emoji = POLL_EMOJIS[i];
    const count = (reactions[emoji] ?? []).length;
    const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const voted = myVoteEmoji === emoji;
    return <button key={`${i}-${choice}`} className={`poll-choice ${voted ? "voted" : ""}`} onClick={() => onReact(itemId, emoji)}><span className="poll-bar" style={{ "--w": `${pct}%` } as React.CSSProperties} /><span className="poll-em">{emoji}</span><span className="poll-text">{choice}</span><span className="poll-count">{count || ""}</span><span className="poll-pct">{totalVotes > 0 ? `${pct}%` : ""}</span></button>;
  })}</div><div className="poll-footer"><span>{totalVotes > 0 ? `총 ${totalVotes}표` : "아직 투표가 없어요"}</span>{myVoteEmoji && <span className="poll-hint">선택됨 · 다시 누르면 취소</span>}</div></div>;
}

function LinkBody({ link }: { link: LinkPayload }) {
  const yt = link.youtube || ytId(link.url);
  if (yt) return <div className="link-yt"><div className="yt-embed"><iframe src={`https://www.youtube.com/embed/${yt}`} title={link.title || "YouTube video"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /><span className="yt-badge">youtube.com</span></div><a className="yt-title" href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a></div>;
  return <a className="link-card" href={link.url} target="_blank" rel="noopener noreferrer">{link.image && <div className="link-img"><img className="link-preview" src={link.image} alt="" loading="lazy" /></div>}<div className="link-meta"><span className="link-site"><I.link s={12} />{link.site}</span><span className="link-title">{link.title}</span>{link.desc && <span className="link-desc">{link.desc}</span>}<span className="link-url">{link.url}</span></div></a>;
}

function FileBody({ file }: { file: FilePayload }) {
  const isImg = file.mime.startsWith("image/");
  const source = file.url ?? file.dataUrl;
  const downloadUrl = file.url ? `${file.url}?download=1` : source;
  if (isImg) return <div className="file-img">{source ? <img className="file-preview" src={source} alt={file.name} /> : <Placeholder label={`이미지 미리보기 · ${file.name}`} h={196} />}<div className="file-foot"><I.image s={14} /><span className="file-name">{file.name}</span><span className="file-sz">{fmtSize(file.size)}</span><a className="file-dl" href={downloadUrl ?? "#"} download={file.name} title="다운로드" onClick={(e) => { if (!downloadUrl) e.preventDefault(); }}><I.download s={14} /></a></div></div>;
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return <a className="file-doc" href={downloadUrl ?? "#"} download={file.name} onClick={(e) => { if (!downloadUrl) e.preventDefault(); }}><span className="file-ext">{ext}</span><span className="file-doc-meta"><span className="file-name">{file.name}</span><span className="file-sz">{file.mime} · {fmtSize(file.size)}</span></span><span className="file-dl"><I.download s={16} /></span></a>;
}

function Reactions({ itemId, reactions, myId, onReact }: { itemId: string; reactions: Record<string, string[]>; myId: string; onReact: (itemId: string, emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length > 0);
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
  return <div className="empty"><div className="empty-pile"><span /><span /><span /></div><h3>아직 더미가 비어 있어요</h3><p>아래에서 무엇이든 붙여넣거나 파일을 끌어다 놓으면<br />이 채널에 첫 자료가 쌓입니다.</p></div>;
}

function DropOverlay() {
  return <div className="drop-overlay"><div className="drop-card"><I.download s={30} /><strong>여기에 놓으세요</strong><span>파일은 미리보기 또는 다운로드로, 텍스트는 아이템으로 쌓입니다</span></div></div>;
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return <div className="toasts">{toasts.map(({ id, msg, Icon }) => <div className="toast" key={id}>{Icon && <Icon s={15} />}<span>{msg}</span></div>)}</div>;
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
