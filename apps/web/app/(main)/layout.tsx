import { BottomNav } from "@/components/bottom-nav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-28">
      {children}
      <BottomNav />
    </div>
  );
}
