"use client";
import { useEffect } from "react";

/** Đăng ký service worker (chỉ production) — dự phòng trang ngoại tuyến. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}
