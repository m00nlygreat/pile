import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pile",
  description: "로그인 없이 빠르게 자료를 쌓는 협업 보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
