"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const WORDS = ["ocean", "forest", "canyon", "meadow", "harbor", "summit", "valley", "ridge"];

function randomId() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${word}-${num}`;
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const router = useRouter();

  function navigate(raw: string) {
    const id = raw.trim().replace(/\s+/g, "-").toLowerCase();
    if (id) router.push(`/${encodeURIComponent(id)}`);
  }

  return (
    <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "40px 24px" }}>
      <div className="logo" style={{ fontSize: 28, marginBottom: 18 }}>
        <div className="logo-mark" style={{ width: 24, height: 24 }}>
          <span style={{ width: 14, opacity: 0.55, marginLeft: 7 }} />
          <span style={{ width: 21, opacity: 0.78 }} />
          <span style={{ width: 24 }} />
        </div>
        pile
      </div>

      <p style={{ fontSize: 15, color: "var(--muted)", textAlign: "center", maxWidth: 340, margin: "0 0 36px", lineHeight: 1.6 }}>
        로그인 없이 빠르게 자료를 쌓는 협업 보드
      </p>

      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 400, marginBottom: 14 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate(input)}
          placeholder="보드 주소 입력…"
          style={{
            flex: 1,
            fontFamily: "var(--mono)",
            fontSize: 14,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1.5px solid var(--hair-2)",
            background: "var(--surface)",
            color: "var(--ink)",
            outline: "none",
          }}
        />
        <button className="btn-pri" onClick={() => navigate(input)} disabled={!input.trim()}>
          이동
        </button>
      </div>

      <button
        onClick={() => navigate(randomId())}
        style={{ fontSize: 13, color: "var(--accent-ink)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline", textDecorationColor: "color-mix(in oklch, var(--accent) 35%, transparent)", textUnderlineOffset: 3 }}
      >
        새 보드 만들기 →
      </button>
    </main>
  );
}
