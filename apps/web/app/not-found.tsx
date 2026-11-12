import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Không tìm thấy" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-5 px-5 text-center">
      <Compass size={44} strokeWidth={1.6} className="text-muted" aria-hidden />
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-extrabold">Lạc đường rồi</h1>
        <p className="text-[15px] text-muted">Trang này không có hoặc bạn không có quyền xem.</p>
      </div>
      <ButtonLink href="/home" size="md">
        Về trang chủ
      </ButtonLink>
    </main>
  );
}
