'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function BoardCreateForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [sessionBlockMinutes, setSessionBlockMinutes] = useState(60);
  const [sessionAnchor, setSessionAnchor] = useState('00:00');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          description: description || undefined,
          sessionBlockMinutes,
          sessionAnchor
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? '보드를 생성하지 못했습니다.');
      }
      setName('');
      setSlug('');
      setDescription('');
      setSessionBlockMinutes(60);
      setSessionAnchor('00:00');
      setMessage('보드가 생성되었습니다.');
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-card" style={{ marginTop: '2rem' }}>
      <h3>새 보드 만들기</h3>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <label className="input">
        보드 이름
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="input">
        슬러그 (선택)
        <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="예: workshop-2024" />
      </label>
      <label className="input">
        설명 (선택)
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <label className="input">
          세션 길이(분)
          <input
            type="number"
            min={15}
            max={240}
            value={sessionBlockMinutes}
            onChange={(event) => setSessionBlockMinutes(Number(event.target.value))}
          />
        </label>
        <label className="input">
          시작 앵커(HH:mm)
          <input value={sessionAnchor} onChange={(event) => setSessionAnchor(event.target.value)} />
        </label>
      </div>
      <button className="primary" type="submit" disabled={loading}>
        {loading ? '생성 중…' : '보드 생성'}
      </button>
    </form>
  );
}
