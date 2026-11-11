"use client";
import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Web Share API; không hỗ trợ (hoặc lỗi) thì sao chép link. */
export function ShareButton({ path, title, text }: { path: string; title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Sao chép link", url);
    }
  }

  return (
    <Button className="w-full" onClick={share}>
      {copied ? <Check size={20} aria-hidden /> : <Share2 size={20} aria-hidden />}
      <span aria-live="polite">{copied ? "Đã sao chép link" : "Chia sẻ thành tích"}</span>
    </Button>
  );
}
