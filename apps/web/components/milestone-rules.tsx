import { Award, ScanFace, ShieldCheck, Video } from "lucide-react";
import { InfoSheet } from "@/components/ui/sheet";

/**
 * "Nhờ xác nhận" là gì: tùy chọn, quay video để cộng đồng công nhận mốc → XP + huy hiệu thêu.
 * Luật duyệt giấu sau ⓘ (progressive disclosure).
 */
export function MilestoneRulesInfo({ reviewers, reviewerTitle }: { reviewers: number; reviewerTitle: string | null }) {
  return (
    <InfoSheet title="Nhờ xác nhận" label="Nhờ xác nhận là gì">
      <ul className="flex flex-col gap-3 pt-1 text-text">
        <li className="flex items-start gap-3">
          <Award size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>Không bắt buộc. Được công nhận thì nhận XP và miếng huy hiệu thêu trên hồ sơ.</span>
        </li>
        <li className="flex items-start gap-3">
          <Video size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <span>Quay một video liên tục, không cắt ghép, thấy rõ bạn là người làm.</span>
        </li>
        <li className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-teal" aria-hidden />
          <span className="tabular">
            {reviewers} người {reviewerTitle ? `đã xong mốc ${reviewerTitle}` : "giỏi hơn"} được chọn ngẫu nhiên, xem ẩn danh.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <ScanFace size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden />
          <span>Tự đánh dấu ✓ chỉ để bạn theo dõi tiến độ của mình.</span>
        </li>
      </ul>
    </InfoSheet>
  );
}
