import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "pile — 빠른 협업 보드",
    short_name: "pile",
    description: "로그인 없이 빠르게 자료를 쌓는 협업 보드",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f2eee5",
    theme_color: "#f2eee5",
    lang: "ko",
    orientation: "any",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
