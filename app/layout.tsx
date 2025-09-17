import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "pile — 로그인 없이 던져놓는 실시간 보드",
  description:
    "pile은 강의나 워크숍에서 링크, 파일, 메모를 로그인 없이 빠르게 모으는 실시간 보드입니다."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
