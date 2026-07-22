import { ImageResponse } from "next/og";
import { createElement } from "react";

export function createPwaIcon(size: 192 | 512) {
  const line = (width: string, opacity = 1) => createElement("div", {
    style: {
      width,
      height: "11%",
      borderRadius: 999,
      background: `rgba(183, 101, 66, ${opacity})`,
    },
  });

  return new ImageResponse(
    createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#f7f3eb",
      },
    }, createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: "5%",
        width: "58%",
        height: "58%",
        transform: "rotate(-3deg)",
      },
    }, line("62%", 0.55), line("82%", 0.78), line("100%"))),
    { width: size, height: size },
  );
}
