"use client";

import { useEffect } from "react";

export function AnonIdentify() {
  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/anon/identify", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    }).catch(() => {
      // Silent failure; identification will retry on the next navigation.
    });

    return () => {
      controller.abort();
    };
  }, []);

  return null;
}
