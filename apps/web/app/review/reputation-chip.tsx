import { InfoSheet } from "@/components/ui/sheet";

/** Uy tín người duyệt + ⓘ giải thích (phiếu trái đa số làm giảm uy tín). */
export function ReputationChip({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className="tabular rounded-full bg-teal-soft px-2.5 py-1 text-[13px] font-bold text-teal">Uy tín {value}</span>
      <InfoSheet title="Uy tín người duyệt" label="Cách tính uy tín">
        Phiếu trùng với đa số người duyệt làm tăng uy tín; phiếu trái với đa số làm giảm. Uy tín thấp sẽ tạm dừng quyền duyệt. Uy tín
        phục hồi dần mỗi tuần.
      </InfoSheet>
    </span>
  );
}
