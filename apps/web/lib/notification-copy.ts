import {
  ArrowLeftRight,
  Award,
  Bell,
  CircleX,
  Flag,
  Lightbulb,
  MessageCircle,
  PartyPopper,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Swords,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

type N = { kind: string; refType: string | null; refId: string | null };
type Copy = { text: string; href: string | null; icon: LucideIcon; tone: "accent" | "teal" | "danger" | "muted" };

/** Câu tiếng Việt + đích đến theo `kind` (domain chỉ trả mã). */
export function notificationCopy(n: N): Copy {
  const proof = n.refType === "proof" && n.refId ? `/proofs/${n.refId}` : null;
  switch (n.kind) {
    case "review_assigned":
      // refId là bằng chứng, người duyệt không mở được trang bằng chứng → về hàng đợi duyệt.
      return { text: "Có video mới nhờ bạn xem giúp.", href: "/review", icon: ShieldCheck, tone: "teal" };
    case "proof_passed":
      return { text: "Xong mốc rồi! Xem thành tích.", href: n.refId ? `/level-up/${n.refId}` : proof, icon: Award, tone: "accent" };
    case "proof_failed":
      return { text: "Video chưa qua mốc. Xem góp ý rồi thử lại nhé.", href: proof, icon: CircleX, tone: "danger" };
    case "proof_editor_review":
      return { text: "Video của bạn đang được biên tập viên xem.", href: proof, icon: Scale, tone: "muted" };
    case "proof_cleared":
      return { text: "Video của bạn đã được xác nhận hợp lệ.", href: proof, icon: ShieldCheck, tone: "teal" };
    case "proof_removed":
      return { text: "Video của bạn đã bị gỡ.", href: proof, icon: ShieldAlert, tone: "danger" };
    case "level_revoked":
      return { text: "Một mốc của bạn đã bị thu hồi sau khi xem xét báo cáo.", href: proof, icon: ShieldAlert, tone: "danger" };
    case "appeal_overturned":
      return { text: "Kháng nghị được chấp nhận. Video sẽ được duyệt lại.", href: proof, icon: Scale, tone: "teal" };
    case "appeal_upheld":
      return { text: "Kháng nghị không được chấp nhận.", href: proof, icon: Scale, tone: "muted" };
    case "appeal_filed":
      return { text: "Có kháng nghị mới cần xem.", href: "/admin?tab=appeals", icon: Scale, tone: "muted" };
    case "report_filed":
      return { text: "Có báo cáo mới cần xem.", href: "/admin", icon: Flag, tone: "danger" };
    case "message":
      return { text: "Bạn có tin nhắn mới.", href: n.refId ? `/messages/${n.refId}` : "/messages", icon: MessageCircle, tone: "accent" };
    case "new_follower":
      return { text: "Có người mới theo dõi bạn.", href: null, icon: UserPlus, tone: "teal" };
    case "post_reaction":
      return { text: "Có người cổ vũ bài của bạn.", href: "/home", icon: PartyPopper, tone: "accent" };
    case "post_comment":
      return { text: "Có bình luận mới trên bài của bạn.", href: "/home", icon: MessageCircle, tone: "accent" };
    case "swap_proposed":
      return { text: "Bạn nhận được đề nghị trao đổi kỹ năng.", href: "/swaps", icon: ArrowLeftRight, tone: "accent" };
    case "swap_accepted":
      return { text: "Đề nghị trao đổi của bạn được nhận lời.", href: "/swaps", icon: ArrowLeftRight, tone: "teal" };
    case "swap_declined":
    case "swap_cancelled":
      return { text: "Một đề nghị trao đổi đã bị hủy.", href: "/swaps", icon: ArrowLeftRight, tone: "muted" };
    case "swap_done":
      return { text: "Buổi trao đổi đã xong. Đánh giá nhau nhé.", href: "/swaps", icon: ArrowLeftRight, tone: "accent" };
    case "swap_rated":
      return { text: "Bạn vừa được đánh giá sau buổi trao đổi.", href: "/swaps", icon: ArrowLeftRight, tone: "teal" };
    case "duel_created":
      return { text: "Bạn có trận đấu 1v1 mới.", href: "/challenges?tab=duels", icon: Swords, tone: "accent" };
    case "duel_won":
      return { text: "Bạn thắng trận đấu 1v1!", href: "/challenges?tab=duels", icon: Swords, tone: "accent" };
    case "duel_lost":
      return { text: "Trận đấu 1v1 đã kết thúc.", href: "/challenges?tab=duels", icon: Swords, tone: "muted" };
    case "duel_tied":
      return { text: "Trận đấu 1v1 hòa.", href: "/challenges?tab=duels", icon: Swords, tone: "muted" };
    case "warning":
      return { text: "Bạn nhận một cảnh cáo từ biên tập viên.", href: null, icon: ShieldAlert, tone: "danger" };
    default:
      if (n.kind === "proposal_accepted")
        return { text: "Đề xuất của bạn đã được thông qua.", href: n.refId ? `/proposals/${n.refId}` : null, icon: Lightbulb, tone: "teal" };
      if (n.kind === "proposal_comment")
        return { text: "Có bình luận mới trên đề xuất của bạn.", href: n.refId ? `/proposals/${n.refId}` : null, icon: MessageCircle, tone: "accent" };
      if (n.kind.startsWith("proposal_"))
        return { text: "Có cập nhật về đề xuất của bạn.", href: n.refId ? `/proposals/${n.refId}` : null, icon: Lightbulb, tone: "muted" };
      if (n.kind === "new_skill" || n.kind === "edit_criteria")
        return { text: "Có đề xuất cần biên tập viên xem.", href: "/admin?tab=proposals", icon: Lightbulb, tone: "muted" };
      return { text: "Bạn có thông báo mới.", href: proof, icon: Bell, tone: "muted" };
  }
}
