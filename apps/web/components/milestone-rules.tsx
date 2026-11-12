import { ScanFace, ShieldCheck, Video } from "lucide-react";
import { InfoSheet } from "@/components/ui/sheet";

/** Luật chung để một mốc được công nhận, giấu sau ⓘ (progressive disclosure). */
export function MilestoneRulesInfo({ reviewers, reviewerTitle }: { reviewers: number; reviewerTitle: string | null }) {
  return (
    <InfoSheet title="Cách được công nhận" label="Cách được công nhận một mốc">
      <ul className="flex flex-col gap-3 pt-1 text-text">
        <li className="flex items-start gap-3">
          <Video size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>Quay một video liên tục, không cắt ghép.</span>
        </li>
        <li className="flex items-start gap-3">
          <ScanFace size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>Thấy rõ bạn là người làm.</span>
        </li>
        <li className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal" aria-hidden />
          <span className="tabular">
            {reviewers} người {reviewerTitle ? `đã xong mốc ${reviewerTitle}` : "giỏi hơn"} được chọn ngẫu nhiên, duyệt ẩn danh.
          </span>
        </li>
      </ul>
    </InfoSheet>
  );
}
