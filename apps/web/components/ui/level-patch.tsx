import { Lock, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { patchFabric, patchShape, RARITY_LABEL, threadOf, type PatchShape, type Rarity, type Thread } from "@/lib/skill-visual";

/**
 * Huy hiệu cấp độ vẽ như miếng vải thêu: viền vắt sổ (merrow) bằng chỉ, nền vải dệt chéo,
 * đường khâu chạy bên trong. Hình theo danh mục, màu chỉ theo độ hiếm; Huyền thoại có thêm
 * một đường chỉ thứ hai. Đây là điểm nhấn duy nhất của giao diện.
 *
 * state:
 * - "earned": đã khâu xong (viền vắt sổ đầy đủ).
 * - "practicing": đang luyện, vải đã đặt nhưng chưa vắt viền.
 * - "locked": chưa mở, chỉ có đường phấn nét đứt.
 */
export type LevelPatchProps = {
  categorySlug: string;
  rarity?: Rarity;
  state?: "earned" | "practicing" | "locked";
  /** Số hiển thị giữa miếng vải (cấp). Bỏ trống để hiện biểu tượng. */
  level?: number;
  icon?: LucideIcon;
  size?: number;
  /** Nhãn cho trình đọc màn hình; bỏ trống nếu miếng vải chỉ để trang trí bên cạnh chữ. */
  label?: string;
  className?: string;
};

const THREAD: Record<Thread, string> = {
  common: "var(--color-thread-common)",
  rare: "var(--color-thread-rare)",
  legendary: "var(--color-thread-legendary)",
};

type Cmd = [string, ...number[]];

const SHAPES: Record<Exclude<PatchShape, "circle">, Cmd[]> = {
  shield: [
    ["M", 50, 3],
    ["L", 91, 15],
    ["L", 91, 47],
    ["C", 91, 72, 73, 88, 50, 97],
    ["C", 27, 88, 9, 72, 9, 47],
    ["L", 9, 15],
    ["Z"],
  ],
  hexagon: [["M", 50, 3], ["L", 91, 26.5], ["L", 91, 73.5], ["L", 50, 97], ["L", 9, 73.5], ["L", 9, 26.5], ["Z"]],
  square: [
    ["M", 26, 6],
    ["L", 74, 6],
    ["C", 86, 6, 94, 14, 94, 26],
    ["L", 94, 74],
    ["C", 94, 86, 86, 94, 74, 94],
    ["L", 26, 94],
    ["C", 14, 94, 6, 86, 6, 74],
    ["L", 6, 26],
    ["C", 6, 14, 14, 6, 26, 6],
    ["Z"],
  ],
};

/** Thu nhỏ hình quanh tâm (50,50) để vẽ các lớp vải/đường khâu lồng nhau. */
function shapePath(shape: PatchShape, scale: number): string {
  if (shape === "circle") {
    const r = 46 * scale;
    return `M ${50 - r} 50 A ${r} ${r} 0 1 0 ${50 + r} 50 A ${r} ${r} 0 1 0 ${50 - r} 50 Z`;
  }
  return SHAPES[shape]
    .map(([c, ...nums]) => {
      const pts = nums.map((n) => +(50 + (n - 50) * scale).toFixed(2));
      return `${c} ${pts.join(" ")}`;
    })
    .join(" ");
}

export function LevelPatch({
  categorySlug,
  rarity: rarityIn = null,
  state = "earned",
  level,
  icon: Icon,
  size = 56,
  label,
  className,
}: LevelPatchProps) {
  const rarity = threadOf(rarityIn);
  const uid = useId().replace(/:/g, "");
  const shape = patchShape(categorySlug);
  const fabric = patchFabric(categorySlug);
  const thread = THREAD[rarity];
  const a11y = label
    ? { role: "img" as const, "aria-label": `${label}${rarity !== "common" ? `, ${RARITY_LABEL[rarity]}` : ""}` }
    : { "aria-hidden": true as const };

  if (state === "locked") {
    return (
      <svg viewBox="0 0 100 100" width={size} height={size} className={className} {...a11y}>
        <path d={shapePath(shape, 0.96)} fill="var(--color-surface)" />
        <path
          d={shapePath(shape, 0.96)}
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth={2.4}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
        <Lock x={36} y={36} width={28} height={28} strokeWidth={2.2} color="var(--color-muted)" />
      </svg>
    );
  }

  const earned = state === "earned";
  const fontSize = level !== undefined && level >= 10 ? 34 : 40;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} {...a11y}>
      <defs>
        <pattern id={`twill-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="5" height="5" fill={fabric} />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#000" strokeOpacity="0.16" strokeWidth="2" />
        </pattern>
      </defs>

      {earned ? (
        <>
          {/* Viền vắt sổ: dải chỉ dày, có gân */}
          <path d={shapePath(shape, 1)} fill={thread} />
          <path
            d={shapePath(shape, 0.95)}
            fill="none"
            stroke="#000"
            strokeOpacity="0.28"
            strokeWidth={5}
            strokeDasharray="0.9 1.6"
          />
          <path d={shapePath(shape, 0.88)} fill={`url(#twill-${uid})`} />
        </>
      ) : (
        <>
          <path d={shapePath(shape, 0.96)} fill={`url(#twill-${uid})`} />
          <path
            d={shapePath(shape, 0.96)}
            fill="none"
            stroke={thread}
            strokeOpacity="0.45"
            strokeWidth={1.6}
            strokeDasharray="1 3.2"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Đường khâu chạy bên trong */}
      <path
        d={shapePath(shape, earned ? 0.77 : 0.82)}
        fill="none"
        stroke={thread}
        strokeWidth={2}
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      {rarity === "legendary" && earned ? (
        <path
          d={shapePath(shape, 0.69)}
          fill="none"
          stroke="var(--color-thread-legendary-2)"
          strokeWidth={1.4}
          strokeDasharray="2 2.6"
          strokeLinecap="round"
        />
      ) : null}

      {level !== undefined ? (
        <text
          x="50"
          y={shape === "shield" ? 49 : 51}
          textAnchor="middle"
          dominantBaseline="central"
          fill={thread}
          fontWeight={800}
          fontSize={fontSize}
          style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}
        >
          {level}
        </text>
      ) : Icon ? (
        <Icon x={33} y={shape === "shield" ? 31 : 33} width={34} height={34} strokeWidth={2.2} color={thread} />
      ) : null}
    </svg>
  );
}
