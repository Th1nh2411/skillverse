import type { Metadata } from "next";
import { Flame, MailCheck, TriangleAlert } from "lucide-react";
import { devLoginEnabled } from "@skillverse/api";
import { googleEnabled, signIn } from "@/auth";
import { Button, ButtonLink } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";

export const metadata: Metadata = { title: "Đăng nhập" };

const DEV_HANDLES = [
  { handle: "minhhoang", name: "Minh Hoàng" },
  { handle: "bientap", name: "Biên tập viên" },
  { handle: "nguoimoi", name: "Người mới" },
];

async function signInGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signInEmail(formData: FormData) {
  "use server";
  await signIn("nodemailer", { email: String(formData.get("email") ?? ""), redirectTo: "/" });
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const sent = sp.sent === "1" || sp.type === "email";
  const error = Boolean(sp.error);
  const dev = devLoginEnabled();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-[12vh]">
      <div className="flex flex-col items-start gap-5">
        <LevelPatch categorySlug="sinh-ton" rarity="legendary" icon={Flame} size={88} />
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.01em]">SkillVerse</h1>
          <p className="text-[15px] text-muted">Làm được thật. Cộng đồng xác nhận.</p>
        </div>
      </div>

      {sent ? (
        <div className="mt-10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <MailCheck size={24} className="shrink-0 text-teal" aria-hidden />
            <p className="text-[16px] font-semibold">Đã gửi link đăng nhập. Mở email để vào.</p>
          </div>
          <ButtonLink href="/login" variant="secondary" size="md" className="self-start">
            Dùng email khác
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-4">
          {error ? (
            <p role="alert" className="flex items-start gap-2 text-[14px] text-danger">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
              Không đăng nhập được. Thử lại hoặc dùng cách khác.
            </p>
          ) : null}

          {googleEnabled ? (
            <form action={signInGoogle}>
              <Button type="submit" className="w-full">
                <GoogleMark />
                Tiếp tục với Google
              </Button>
            </form>
          ) : null}

          <form action={signInEmail} className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[13px] font-semibold text-muted">
              Email
            </label>
            <div className="flex gap-2">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="ban@email.com"
                className="min-h-[52px] min-w-0 flex-1 rounded-[var(--radius-btn)] border border-border bg-surface px-4 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
              <Button type="submit" variant={googleEnabled ? "secondary" : "primary"} className="shrink-0">
                Gửi link
              </Button>
            </div>
          </form>
        </div>
      )}

      {dev ? (
        <section aria-labelledby="dev-login" className="mt-auto flex flex-col gap-2 border-t border-dashed border-border pt-5">
          <h2 id="dev-login" className="text-[13px] font-semibold text-muted">
            Đăng nhập thử (dev)
          </h2>
          <div className="flex flex-wrap gap-2">
            {DEV_HANDLES.map((u) => (
              <form key={u.handle} action="/api/dev/login" method="post">
                <input type="hidden" name="handle" value={u.handle} />
                <input type="hidden" name="next" value="/" />
                <Button type="submit" variant="ghost" size="sm" className="border border-border">
                  {u.name}
                </Button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden>
      <path fill="currentColor" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.97-4.32 2.97-7.35Z" />
      <path fill="currentColor" opacity=".8" d="M12 22c2.7 0 4.97-.9 6.63-2.42l-3.24-2.5c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z" />
      <path fill="currentColor" opacity=".6" d="M6.4 13.91a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.34-2.59Z" />
      <path fill="currentColor" opacity=".9" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2 10 10 0 0 0 3.06 7.5l3.34 2.59C7.19 7.73 9.4 5.97 12 5.97Z" />
    </svg>
  );
}
