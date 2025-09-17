import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'pile — 공유 보드',
  description: '수업과 워크숍에서 자료를 빠르게 공유하는 온라인 보드'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="container">
            <h1 className="logo">pile</h1>
            <p className="tagline">빠르게 던져놓는 공유 보드</p>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">© {new Date().getFullYear()} pile</div>
        </footer>
      </body>
    </html>
  );
}
