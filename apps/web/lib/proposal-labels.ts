export type ProposalStatus = "gathering" | "voting" | "editor_review" | "accepted" | "rejected" | "expired";

export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; tone: string }> = {
  gathering: { label: "Đang lấy ủng hộ", tone: "text-accent" },
  voting: { label: "Đang bỏ phiếu", tone: "text-teal" },
  editor_review: { label: "Chờ biên tập", tone: "text-muted" },
  accepted: { label: "Đã thông qua", tone: "text-teal" },
  rejected: { label: "Không thông qua", tone: "text-danger" },
  expired: { label: "Hết hạn", tone: "text-muted" },
};

/** Bước hiện tại của đề xuất kỹ năng mới trong Ủng hộ → Duyệt → Mở. */
export function newSkillStep(status: ProposalStatus): { current: 0 | 1 | 2 | 3; failed: boolean } {
  if (status === "accepted") return { current: 3, failed: false };
  if (status === "editor_review") return { current: 1, failed: false };
  if (status === "rejected") return { current: 1, failed: true };
  if (status === "expired") return { current: 0, failed: true };
  return { current: 0, failed: false };
}
