'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message ?? '로그인에 실패했습니다.');
      }
      setPassword('');
      router.refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-card" style={{ maxWidth: 420 }}>
      <h2>관리자 로그인</h2>
      <p style={{ color: 'rgba(15, 23, 42, 0.55)' }}>비밀번호를 입력해 관리자 모드를 활성화하세요.</p>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <label className="input">
        비밀번호
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      <button className="primary" type="submit" disabled={loading}>
        {loading ? '확인 중…' : '로그인'}
      </button>
    </form>
  );
}
