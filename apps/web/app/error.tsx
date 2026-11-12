"use client";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Lỗi không lường trước trong một màn: không lộ chi tiết kỹ thuật, cho thử lại. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-5 px-5 text-center">
      <TriangleAlert size={40} strokeWidth={1.8} className="text-danger" aria-hidden />
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[24px] font-extrabold">Có lỗi xảy ra</h1>
        <p className="text-[15px] text-muted">Thử lại sau giây lát. Nếu vẫn lỗi, quay về trang chủ.</p>
        {error.digest ? <p className="tabular text-[12px] text-muted">Mã lỗi: {error.digest}</p> : null}
      </div>
      <div className="flex gap-2.5">
        <ButtonLink href="/home" variant="secondary" size="md">
          Trang chủ
        </ButtonLink>
        <Button size="md" onClick={reset}>
          Thử lại
        </Button>
      </div>
    </main>
  );
}
