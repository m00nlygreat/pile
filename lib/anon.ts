import { randomUUID } from "node:crypto";

export const ANON_COOKIE_NAME = "anon_id";

const colors = [
  "푸른",
  "붉은",
  "초록",
  "노란",
  "보라",
  "하얀",
  "검은",
  "은빛",
  "금빛",
  "분홍",
];

const animals = [
  "고래",
  "여우",
  "고양이",
  "강아지",
  "부엉이",
  "돌고래",
  "토끼",
  "사자",
  "수달",
  "판다",
];

export function createAnonId(): string {
  return randomUUID();
}

export function generateNickname(): string {
  const color = colors[Math.floor(Math.random() * colors.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const suffix = Math.floor(Math.random() * 90 + 10);
  return `${color}${animal}-${suffix}`;
}

export function getAnonCookieExpiry(): Date {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  return expires;
}
