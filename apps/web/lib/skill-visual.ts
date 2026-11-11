import {
  Amphora,
  Box,
  Cable,
  Circle,
  Compass,
  Droplets,
  Filter,
  FlipHorizontal2,
  Flame,
  HeartPulse,
  Leaf,
  LockKeyhole,
  MountainSnow,
  Orbit,
  Rabbit,
  Spline,
  Tent,
  Waves,
  type LucideIcon,
} from "lucide-react";

/** Hình miếng vải thêu theo danh mục kỹ năng. */
export type PatchShape = "shield" | "hexagon" | "circle" | "square";

/** Độ hiếm hiển thị bằng chỉ thêu (domain tính từ holder_count + app_config.rarity_thresholds). */
export type Rarity = "legendary" | "rare" | "common";

const SKILL_ICONS: Record<string, LucideIcon> = {
  "sinh-ton-co-ban": Compass,
  "nhom-lua": Flame,
  "lua-bang-que": Flame,
  "tim-nguon-nuoc": Droplets,
  "loc-nuoc": Filter,
  "dung-trai": Tent,
  "bay-don-gian": Rabbit,
  "song-sot-72-gio": MountainSnow,
  "that-nut-day": Cable,
  "so-cuu": HeartPulse,
  "huyt-sao-bang-la": Leaf,
  "viet-chu-nguoc-guong": FlipHorizontal2,
  "tung-hung": Orbit,
  "giai-rubik-bit-mat": Box,
  "mo-khoa-the-thao": LockKeyhole,
  "thoi-thuy-tinh": Amphora,
  "ben-day-paracord": Spline,
  "dan-len": Spline,
  "leo-nui": MountainSnow,
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "sinh-ton": Compass,
  "ky-nang-di": Orbit,
  "thu-cong": Spline,
  "the-chat": Waves,
};

export function skillIcon(slug: string, categorySlug?: string): LucideIcon {
  return SKILL_ICONS[slug] ?? (categorySlug ? CATEGORY_ICONS[categorySlug] : undefined) ?? Circle;
}

const CATEGORY_SHAPE: Record<string, PatchShape> = {
  "sinh-ton": "shield",
  "ky-nang-di": "hexagon",
  "thu-cong": "circle",
  "the-chat": "square",
};

/** Màu nền vải theo danh mục: tông đất, trầm, để chỉ thêu nổi lên. */
const CATEGORY_FABRIC: Record<string, string> = {
  "sinh-ton": "#2e4630",
  "ky-nang-di": "#2b3550",
  "thu-cong": "#4a3324",
  "the-chat": "#47302e",
};

export function patchShape(categorySlug: string): PatchShape {
  return CATEGORY_SHAPE[categorySlug] ?? "circle";
}

export function patchFabric(categorySlug: string): string {
  return CATEGORY_FABRIC[categorySlug] ?? "#2e3a33";
}

export const RARITY_LABEL: Record<Rarity, string> = {
  legendary: "Huyền thoại",
  rare: "Hiếm",
  common: "Phổ biến",
};

/** Lớp màu chữ theo độ hiếm (dùng khi cần nhắc độ hiếm bằng màu, không bằng chữ in hoa). */
export const RARITY_TEXT: Record<Rarity, string> = {
  legendary: "text-accent",
  rare: "text-teal",
  common: "text-muted",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase();
}

const nf = new Intl.NumberFormat("vi-VN");
export function formatNumber(n: number): string {
  return nf.format(n);
}
