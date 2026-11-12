import { Skeleton } from "@/components/ui/misc";

/** Khung chờ chung khi server đang dựng màn (giữ bố cục, không nhảy). */
export default function Loading() {
  return (
    <div role="status" aria-label="Đang tải" className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 pt-5">
      <Skeleton className="h-8 w-40" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
    </div>
  );
}
