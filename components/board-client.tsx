'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addMinutes, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';

import { ItemCard, ItemWithRelations } from './item-card';

type ChannelInfo = {
  id: string;
  name: string;
  slug: string;
};

type BoardClientProps = {
  boardSlug: string;
  boardName: string;
  defaultChannelId: string;
  sessionBlockMinutes: number;
  channels: ChannelInfo[];
  initialItems: ItemWithRelations[];
  isAdmin: boolean;
  initialChannelSlug?: string;
};

type BoardEvent = {
  type: 'item.created' | 'item.deleted' | 'channel.created' | 'board.updated';
  payload: any;
};

function formatSessionLabel(epochSeconds: number | null | undefined, blockMinutes: number) {
  if (!epochSeconds) {
    return '시간 미분류';
  }
  const start = new Date(epochSeconds * 1000);
  const end = addMinutes(start, blockMinutes);
  return `${format(start, 'yyyy-MM-dd HH:mm')} ~ ${format(end, 'HH:mm')}`;
}

export function BoardClient(props: BoardClientProps) {
  const {
    boardSlug,
    boardName,
    defaultChannelId,
    sessionBlockMinutes,
    channels: initialChannels,
    initialItems,
    isAdmin,
    initialChannelSlug
  } = props;

  const router = useRouter();
  const [channelList, setChannelList] = useState<ChannelInfo[]>(initialChannels);
  const [items, setItems] = useState<ItemWithRelations[]>(initialItems);
  const [activeFilter, setActiveFilter] = useState<string>(initialChannelSlug ?? 'all');
  const [targetChannelId, setTargetChannelId] = useState<string>(
    initialChannelSlug
      ? initialChannels.find((channel) => channel.slug === initialChannelSlug)?.id ?? defaultChannelId
      : defaultChannelId
  );
  const [textValue, setTextValue] = useState('');
  const [linkValue, setLinkValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetch('/api/anon/identify', { method: 'POST' }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const source = new EventSource(`/api/boards/${boardSlug}/stream`);
    const handler = (event: MessageEvent, type: BoardEvent['type']) => {
      try {
        const payload = JSON.parse(event.data);
        const boardEvent: BoardEvent = { type, payload };
        if (boardEvent.type === 'item.created') {
          const incoming = boardEvent.payload as ItemWithRelations;
          setItems((prev) => {
            const filtered = prev.filter((item) => item.id !== incoming.id);
            return [incoming, ...filtered].sort((a, b) => b.createdAt - a.createdAt);
          });
        }
        if (boardEvent.type === 'item.deleted') {
          const { id } = boardEvent.payload as { id: string };
          setItems((prev) => prev.filter((item) => item.id !== id));
        }
        if (boardEvent.type === 'channel.created') {
          const channel = boardEvent.payload as ChannelInfo;
          setChannelList((prev) => {
            if (prev.some((existing) => existing.id === channel.id)) {
              return prev;
            }
            return [...prev, channel];
          });
        }
        if (boardEvent.type === 'board.updated') {
          router.refresh();
        }
      } catch (error) {
        console.error('Failed to process SSE event', error);
      }
    };

    source.addEventListener('item.created', (event) => handler(event as MessageEvent, 'item.created'));
    source.addEventListener('item.deleted', (event) => handler(event as MessageEvent, 'item.deleted'));
    source.addEventListener('channel.created', (event) => handler(event as MessageEvent, 'channel.created'));
    source.addEventListener('board.updated', (event) => handler(event as MessageEvent, 'board.updated'));

    source.onerror = () => {
      source.close();
      setTimeout(() => router.refresh(), 5000);
    };

    return () => {
      source.close();
    };
  }, [boardSlug, router]);

  const filteredItems = useMemo(() => {
    const relevant =
      activeFilter === 'all'
        ? items
        : items.filter((item) => item.channel.slug === activeFilter);
    return [...relevant].sort((a, b) => b.createdAt - a.createdAt);
  }, [activeFilter, items]);

  const sessionGroups = useMemo(() => {
    const groups = new Map<string, ItemWithRelations[]>();
    for (const item of filteredItems) {
      const key = item.sessionStart ? String(item.sessionStart) : 'none';
      const bucket = groups.get(key) ?? [];
      bucket.push(item);
      groups.set(key, bucket);
    }
    const entries = Array.from(groups.entries()).map(([key, bucket]) => ({
      key,
      label: formatSessionLabel(key === 'none' ? null : Number(key), sessionBlockMinutes),
      items: bucket.sort((a, b) => b.createdAt - a.createdAt)
    }));
    entries.sort((a, b) => {
      if (a.key === 'none') return 1;
      if (b.key === 'none') return -1;
      return Number(b.key) - Number(a.key);
    });
    return entries;
  }, [filteredItems, sessionBlockMinutes]);

  function handleFilterChange(slug: string) {
    setActiveFilter(slug);
    if (slug === 'all') return;
    const channel = channelList.find((item) => item.slug === slug);
    if (channel) {
      setTargetChannelId(channel.id);
    }
  }

  async function postJson(body: Record<string, unknown>) {
    const response = await fetch(`/api/boards/${boardSlug}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.message ?? '요청을 처리하지 못했습니다.');
    }
    return response.json().catch(() => ({}));
  }

  async function onCreateText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!textValue.trim()) {
        throw new Error('내용을 입력해 주세요.');
      }
      await postJson({ type: 'text', channelId: targetChannelId, text: textValue });
      setTextValue('');
      setMessage('텍스트가 업로드되었습니다.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onCreateLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!linkValue.trim()) {
        throw new Error('링크를 입력해 주세요.');
      }
      await postJson({ type: 'link', channelId: targetChannelId, url: linkValue });
      setLinkValue('');
      setMessage('링크가 업로드되었습니다.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('type', 'file');
      formData.append('channelId', targetChannelId);
      formData.append('file', file);
      const response = await fetch(`/api/boards/${boardSlug}/items`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? '파일 업로드에 실패했습니다.');
      }
      setMessage('파일이 업로드되었습니다.');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files?.length) {
      uploadFiles(event.dataTransfer.files);
      return;
    }
    const text = event.dataTransfer.getData('text');
    if (text) {
      setTextValue(text);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const response = await fetch(`/api/items/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.message ?? '삭제하지 못했습니다.');
    }
  }

  return (
    <div>
      <section className="form-card" style={{ marginBottom: '1.5rem' }}>
        <h2>{boardName}</h2>
        <p style={{ color: 'rgba(15, 23, 42, 0.6)' }}>
          붙여넣기(Ctrl+V) 또는 파일 드롭으로 빠르게 공유하세요.
        </p>
        <div
          className={clsx('dropzone', { dragover: dragOver })}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {uploading ? '업로드 중…' : '파일을 여기로 드래그하거나 선택하세요.'}
          <div style={{ marginTop: '1rem' }}>
            <input
              type="file"
              onChange={(event) => event.target.files && uploadFiles(event.target.files)}
              disabled={uploading}
            />
          </div>
        </div>
        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          <label className="input">
            업로드 채널 선택
            <select value={targetChannelId} onChange={(event) => setTargetChannelId(event.target.value)}>
              {channelList.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.slug} — {channel.name}
                </option>
              ))}
            </select>
          </label>
          <form onSubmit={onCreateText}>
            <label className="input">
              텍스트/노트
              <textarea
                placeholder="메모, 과제 안내, 참고 링크 등"
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
                disabled={saving}
              />
            </label>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? '업로드 중…' : '텍스트 업로드'}
            </button>
          </form>
          <form onSubmit={onCreateLink}>
            <label className="input">
              링크
              <input
                type="url"
                placeholder="https://example.com"
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                disabled={saving}
              />
            </label>
            <button className="primary" type="submit" disabled={saving}>
              {saving ? '불러오는 중…' : '링크 저장'}
            </button>
          </form>
        </div>
        {message && <div className="alert success" style={{ marginTop: '1rem' }}>{message}</div>}
        {error && <div className="alert error" style={{ marginTop: '1rem' }}>{error}</div>}
      </section>

      <nav className="channel-tabs">
        <button
          className={clsx('channel-tab', { active: activeFilter === 'all' })}
          type="button"
          onClick={() => setActiveFilter('all')}
        >
          전체
        </button>
        {channelList.map((channel) => (
          <button
            key={channel.id}
            className={clsx('channel-tab', { active: activeFilter === channel.slug })}
            type="button"
            onClick={() => handleFilterChange(channel.slug)}
          >
            #{channel.slug}
          </button>
        ))}
      </nav>

      {sessionGroups.length === 0 ? (
        <div className="empty-hint">아직 업로드된 자료가 없습니다.</div>
      ) : (
        sessionGroups.map((group) => (
          <section key={group.key}>
            <h3 className="session-header">{group.label}</h3>
            {group.items.map((item) => (
              <ItemCard key={item.id} item={item} isAdmin={isAdmin} onDelete={isAdmin ? handleDelete : undefined} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
