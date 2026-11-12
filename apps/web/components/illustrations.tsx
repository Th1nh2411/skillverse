import type { ReactNode } from "react";

/**
 * Hình minh họa nét tay kiểu sổ tay thực địa: nét `currentColor` (đặt màu bằng class chữ của khung chứa),
 * nền giấy bằng token bề mặt, một điểm màu nhỏ (hổ phách / teal). Dùng được cả giao diện tối và sáng.
 * Chỉ để trang trí: luôn aria-hidden, chữ bên cạnh mới mang nghĩa.
 */
function Art({
  children,
  width = 160,
  height = 110,
  className = "",
  size,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  className?: string;
  /** Chiều rộng hiển thị (px); mặc định theo viewBox. */
  size?: number;
}) {
  const w = size ?? width;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={w}
      height={(w * height) / width}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

const PAPER = "var(--color-surface-2)";
const AMBER = "var(--color-accent)";
const TEAL = "var(--color-teal)";

type ArtProps = { className?: string; size?: number };

/** Mặt đất vẽ tay, hơi gợn. */
function Ground({ y = 94 }: { y?: number }) {
  return <path d={`M12 ${y} q20 -3 40 0 t40 0 t40 0 t16 -1`} />;
}

function Sparkle({ x, y, s = 4, color }: { x: number; y: number; s?: number; color?: string }) {
  return <path d={`M${x - s} ${y}h${2 * s}M${x} ${y - s}v${2 * s}`} stroke={color} strokeWidth={1.6} />;
}

// ---------------------------------------------------------------------------
// Danh mục kỹ năng
// ---------------------------------------------------------------------------

/** Sinh tồn: lều, đống lửa, trăng. */
export function CampArt(p: ArtProps) {
  return (
    <Art {...p}>
      <Ground />
      <path d="M36 93 L70 38 L104 93 Z" fill={PAPER} />
      <path d="M70 38 L66 30M70 38 L75 31" />
      <path d="M70 60 L61 93M70 60 L79 93" />
      <path d="M112 93 l24 -6M112 87 l24 6" />
      <path d="M124 86 c-8 -8 -2 -15 0 -22 c4 7 11 11 4 22 z" fill={AMBER} stroke={AMBER} />
      <path d="M132 18 a11 11 0 1 0 9 18 a9 9 0 1 1 -9 -18 z" />
      <Sparkle x={26} y={26} />
      <Sparkle x={104} y={16} s={3} />
    </Art>
  );
}

/** Kỹ năng dị: tay tung hứng ba quả bóng. */
export function JuggleArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M42 84 q38 -84 76 0" strokeDasharray="3 6" />
      <circle cx="52" cy="50" r="8" fill={PAPER} />
      <circle cx="80" cy="22" r="8" fill={AMBER} stroke={AMBER} />
      <circle cx="108" cy="50" r="8" fill={PAPER} />
      <path d="M28 88 q14 12 28 0" />
      <path d="M104 88 q14 12 28 0" />
      <path d="M30 100 l-6 8M130 100 l6 8" />
      <Sparkle x={130} y={22} s={3} />
      <Sparkle x={30} y={30} s={3} />
    </Art>
  );
}

/** Thủ công: cuộn chỉ, kim, đường khâu. */
export function CraftArt(p: ArtProps) {
  return (
    <Art {...p}>
      <rect x="28" y="40" width="40" height="52" rx="4" fill={PAPER} />
      <path d="M24 40h48M24 92h48" strokeWidth={3} />
      <path d="M30 50h36M30 58h36M30 66h36M30 74h36M30 82h36" strokeWidth={1.4} />
      <path d="M68 60 c22 -2 26 26 48 22 c14 -3 18 -16 14 -28" stroke={AMBER} strokeDasharray="5 4" />
      <path d="M120 22 L140 62" strokeWidth={2.4} />
      <ellipse cx="122.5" cy="27" rx="2" ry="4.5" transform="rotate(-27 122.5 27)" />
      <Sparkle x={104} y={24} s={3} />
    </Art>
  );
}

/** Thể chất: dãy núi, đường mòn nét đứt, cờ trên đỉnh. */
export function SummitArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M10 94 L58 34 L80 60 L100 36 L150 94 Z" fill={PAPER} />
      <path d="M50 44 l8 -10 l7 9 l-6 -2 z" fill="var(--color-surface-3)" strokeWidth={1.4} />
      <path d="M34 92 q18 -10 30 -16 q16 -8 18 -20 q4 -12 18 -20" strokeDasharray="2 6" />
      <path d="M100 36 V14" />
      <path d="M100 14 l18 5 l-18 6 z" fill={AMBER} stroke={AMBER} />
      <Sparkle x={130} y={22} s={3} />
    </Art>
  );
}

const CATEGORY_ART: Record<string, (p: ArtProps) => ReactNode> = {
  "sinh-ton": CampArt,
  "ky-nang-di": JuggleArt,
  "thu-cong": CraftArt,
  "the-chat": SummitArt,
};

export function CategoryArt({ slug, ...p }: ArtProps & { slug: string }) {
  const C = CATEGORY_ART[slug] ?? TrailArt;
  return <C {...p} />;
}

// ---------------------------------------------------------------------------
// Màn trống, đăng nhập, onboarding, lên cấp
// ---------------------------------------------------------------------------

/** Bắt đầu: cột chỉ đường trên lối mòn, dấu chân. */
export function TrailArt(p: ArtProps) {
  return (
    <Art {...p}>
      <Ground />
      <path d="M20 106 q40 -18 60 -40 q16 -18 60 -26" strokeDasharray="2 7" />
      <path d="M96 94 V30" strokeWidth={2.4} />
      <path d="M96 36 h34 l8 7 l-8 7 h-34 z" fill={PAPER} />
      <path d="M96 56 h-30 l-7 7 l7 7 h30 z" fill={PAPER} />
      <path d="M104 43 h20M72 63 h18" strokeWidth={1.4} />
      <ellipse cx="38" cy="96" rx="3" ry="5" fill="currentColor" stroke="none" opacity="0.5" />
      <ellipse cx="50" cy="88" rx="3" ry="5" fill="currentColor" stroke="none" opacity="0.5" />
      <circle cx="137" cy="22" r="3" fill={AMBER} stroke={AMBER} />
    </Art>
  );
}

/** Không có việc: sổ tay mở, dấu kiểm teal. */
export function NotebookArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M80 30 c-14 -8 -34 -10 -54 -6 v66 c20 -4 40 -2 54 6 c14 -8 34 -10 54 -6 v-66 c-20 -4 -40 -2 -54 6 z" fill={PAPER} />
      <path d="M80 30 v66" />
      <path d="M36 42 h32M36 54 h32M36 66 h22" strokeWidth={1.4} />
      <path d="M94 56 l10 10 l18 -22" stroke={TEAL} strokeWidth={3} />
      <Sparkle x={140} y={20} s={3} />
    </Art>
  );
}

/** Không tìm thấy: kính lúp trên bản đồ gấp. */
export function SearchArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M22 30 l36 -8 l40 8 l40 -8 v62 l-40 8 l-40 -8 l-36 8 z" fill={PAPER} />
      <path d="M58 22 v62M98 30 v62" strokeWidth={1.4} />
      <path d="M30 70 q16 -20 40 -10 q14 6 26 -8" strokeDasharray="2 6" />
      <circle cx="104" cy="52" r="15" fill="var(--color-bg)" />
      <path d="M115 63 l14 14" strokeWidth={4} />
      <path d="M100 48 q4 -4 8 0 q2 4 -4 6 v2" strokeWidth={1.8} />
      <circle cx="104" cy="60" r="1" fill="currentColor" />
    </Art>
  );
}

/** Đang chờ: đồng hồ cát. */
export function WaitArt(p: ArtProps) {
  return (
    <Art {...p}>
      <Ground />
      <path d="M58 18 h44M58 92 h44" strokeWidth={3} />
      <path d="M62 18 c0 22 34 26 34 37 c0 11 -34 15 -34 37" />
      <path d="M98 18 c0 22 -34 26 -34 37 c0 11 34 15 34 37" />
      <path d="M70 86 q10 -10 20 0 z" fill={AMBER} stroke={AMBER} />
      <path d="M80 56 v20" stroke={AMBER} strokeDasharray="1 4" />
    </Art>
  );
}

/** Đăng nhập: sổ tay thực địa với miếng vải khâu và la bàn. */
export function FieldNotebookArt(p: ArtProps) {
  return (
    <Art {...p} width={200} height={130}>
      <rect x="34" y="16" width="96" height="104" rx="8" fill={PAPER} transform="rotate(-6 82 68)" />
      <path d="M44 22 l-4 98" transform="rotate(-6 82 68)" strokeWidth={1.4} />
      <path d="M78 38 l22 6 v18 c0 12 -10 20 -22 24 c-12 -4 -22 -12 -22 -24 v-18 z" transform="rotate(-6 82 68)" fill="var(--color-surface-3)" />
      <path d="M78 44 l16 5 v13 c0 9 -7 15 -16 18 c-9 -3 -16 -9 -16 -18 v-13 z" transform="rotate(-6 82 68)" stroke={AMBER} strokeDasharray="3 3" />
      <path d="M62 96 h40M62 106 h28" transform="rotate(-6 82 68)" strokeWidth={1.4} />
      <circle cx="152" cy="86" r="24" fill="var(--color-bg)" />
      <circle cx="152" cy="86" r="18" strokeWidth={1.4} />
      <path d="M152 72 l5 14 l-5 14 l-5 -14 z" />
      <path d="M152 72 l5 14 h-10 z" fill={AMBER} stroke={AMBER} />
      <Sparkle x={178} y={40} s={4} />
      <Sparkle x={18} y={44} s={3} />
    </Art>
  );
}

/** Onboarding: ba lô gắn sẵn chỗ cho các miếng vải. */
export function BackpackArt(p: ArtProps) {
  return (
    <Art {...p}>
      <path d="M52 34 c0 -14 56 -14 56 0" />
      <rect x="44" y="30" width="72" height="70" rx="16" fill={PAPER} />
      <path d="M44 54 h72" />
      <path d="M60 68 h16 v14 c0 4 -4 8 -8 9 c-4 -1 -8 -5 -8 -9 z" stroke={AMBER} strokeDasharray="3 3" />
      <circle cx="96" cy="76" r="8" strokeDasharray="3 3" />
      <path d="M44 66 c-10 2 -12 24 -2 28M116 66 c10 2 12 24 2 28" />
      <Ground y={102} />
      <Sparkle x={136} y={26} s={3} />
      <Sparkle x={24} y={34} s={3} />
    </Art>
  );
}

/**
 * Lên cấp: vòng chỉ khâu và cây kim bao quanh miếng vải. Đặt sau huy hiệu (absolute, inset âm).
 * Vòng chỉ dùng chung hiệu ứng "khâu" với huy hiệu và tắt khi prefers-reduced-motion.
 */
export function SewingRingArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" strokeLinecap="round" aria-hidden className={className}>
      <circle cx="100" cy="100" r="92" stroke="var(--color-accent-line)" strokeWidth={2} strokeDasharray="2 8" />
      <path d="M166 34 L188 12" stroke="var(--color-muted)" strokeWidth={3} />
      <path d="M184 13 l3 3" stroke="var(--color-bg)" strokeWidth={1.4} />
      <path d="M166 34 c-10 10 -6 22 -18 26" stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="4 4" />
      <path d="M22 50 h10M27 45 v10" stroke="var(--color-accent)" strokeWidth={2} />
      <path d="M172 162 h8M176 158 v8" stroke="var(--color-teal)" strokeWidth={2} />
      <path d="M30 160 h6M33 157 v6" stroke="var(--color-muted)" strokeWidth={1.6} />
    </svg>
  );
}
