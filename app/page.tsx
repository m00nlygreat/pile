import Link from 'next/link';

import { db, boards } from '@/lib/db';

export const revalidate = 0;

export default async function HomePage() {
  const boardList = db.select().from(boards).orderBy(boards.createdAt).all();

  return (
    <div className="page">
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2>공개 보드</h2>
            <p>수업 자료를 빠르게 모아보세요.</p>
          </div>
          <Link className="tag" href="/admin">
            관리자 모드
          </Link>
        </div>
      </section>

      {boardList.length === 0 ? (
        <div className="empty-hint">
          아직 생성된 보드가 없습니다. 관리자 모드에서 보드를 만들어 주세요.
        </div>
      ) : (
        <div className="board-grid">
          {boardList.map((board) => (
            <Link key={board.id} href={`/${board.slug}`} className="board-card">
              <h3>{board.name}</h3>
              {board.description && <p>{board.description}</p>}
              <div className="tag" style={{ marginTop: '1rem' }}>
                #{board.slug}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
