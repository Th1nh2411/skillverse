"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { IconButton } from "./icon-button";

/** Quay lại trang trước; mở thẳng từ link ngoài thì về `fallback`. */
export function BackButton({ fallback, label = "Quay lại" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <IconButton
      label={label}
      icon={ArrowLeft}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    />
  );
}
