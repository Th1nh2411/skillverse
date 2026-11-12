/**
 * Thẻ chia sẻ "Xong mốc" 1200x630 cho next/og. Miếng vải thêu vẽ bằng SVG (data URI) theo cùng
 * quy tắc với LevelPatch của ui: hình theo danh mục, màu chỉ theo độ hiếm, viền vắt sổ.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { patchFabric, patchShape, RARITY_LABEL, threadOf, type PatchShape, type Rarity } from "@/lib/skill-visual";

export type LevelUpCard = {
  displayName: string;
  skillName: string;
  categorySlug: string;
  categoryName: string;
  level: number;
  levelTitle: string | null;
  maxLevel: number;
  rarity: Rarity;
};

// Token màu (đồng bộ app/globals.css; ImageResponse không đọc được CSS variable).
const C = {
  bg: "#0e1611",
  surface: "#16211a",
  border: "#33463a",
  text: "#f1eee4",
  muted: "#a9b5a6",
  accent: "#e9a23b",
  threadCommon: "#e9e2cc",
  threadRare: "#5cc2b0",
  threadLegendary: "#e9a23b",
  threadLegendary2: "#f6d89a",
};
const THREAD = { common: C.threadCommon, rare: C.threadRare, legendary: C.threadLegendary } as const;

type Cmd = [string, ...number[]];
const SHAPES: Record<Exclude<PatchShape, "circle">, Cmd[]> = {
  shield: [["M", 50, 3], ["L", 91, 15], ["L", 91, 47], ["C", 91, 72, 73, 88, 50, 97], ["C", 27, 88, 9, 72, 9, 47], ["L", 9, 15], ["Z"]],
  hexagon: [["M", 50, 3], ["L", 91, 26.5], ["L", 91, 73.5], ["L", 50, 97], ["L", 9, 73.5], ["L", 9, 26.5], ["Z"]],
  square: [
    ["M", 26, 6], ["L", 74, 6], ["C", 86, 6, 94, 14, 94, 26], ["L", 94, 74], ["C", 94, 86, 86, 94, 74, 94],
    ["L", 26, 94], ["C", 14, 94, 6, 86, 6, 74], ["L", 6, 26], ["C", 6, 14, 14, 6, 26, 6], ["Z"],
  ],
};

function shapePath(shape: PatchShape, scale: number): string {
  if (shape === "circle") {
    const r = 46 * scale;
    return `M ${50 - r} 50 A ${r} ${r} 0 1 0 ${50 + r} 50 A ${r} ${r} 0 1 0 ${50 - r} 50 Z`;
  }
  return SHAPES[shape]
    .map(([c, ...nums]) => `${c} ${nums.map((n) => +(50 + (n - 50) * scale).toFixed(2)).join(" ")}`)
    .join(" ");
}

/** SVG miếng vải thêu đã khâu xong, giữa là dấu kiểm thêu (không hiện số cấp). */
export function patchSvg(categorySlug: string, rarity: Rarity): string {
  const shape = patchShape(categorySlug);
  const fabric = patchFabric(categorySlug);
  const thread = THREAD[threadOf(rarity)];
  const legendary = rarity === "legendary"
    ? `<path d="${shapePath(shape, 0.69)}" fill="none" stroke="${C.threadLegendary2}" stroke-width="1.4" stroke-dasharray="2 2.6" stroke-linecap="round"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400">
<defs><pattern id="tw" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
<rect width="5" height="5" fill="${fabric}"/><line x1="0" y1="0" x2="0" y2="5" stroke="#000" stroke-opacity="0.16" stroke-width="2"/></pattern></defs>
<path d="${shapePath(shape, 1)}" fill="${thread}"/>
<path d="${shapePath(shape, 0.95)}" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="5" stroke-dasharray="0.9 1.6"/>
<path d="${shapePath(shape, 0.88)}" fill="url(#tw)"/>
<path d="${shapePath(shape, 0.77)}" fill="none" stroke="${thread}" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="round"/>
${legendary}
<path d="M33 51 L45 63 L68 38" fill="none" stroke="${thread}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M33 51 L45 63 L68 38" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="7" stroke-dasharray="0.8 1.6"/>
</svg>`;
}

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 500 | 700; style: "normal" }[]> | undefined;
function loadFonts() {
  const dir = path.join(process.cwd(), "app/og/fonts");
  fontsPromise ??= Promise.all([
    readFile(path.join(dir, "BeVietnamPro-Medium.ttf")).then((data) => ({ name: "Be Vietnam Pro", data, weight: 500 as const, style: "normal" as const })),
    readFile(path.join(dir, "BeVietnamPro-Bold.ttf")).then((data) => ({ name: "Be Vietnam Pro", data, weight: 700 as const, style: "normal" as const })),
  ]);
  return fontsPromise;
}

export const OG_SIZE = { width: 1200, height: 630 };

export async function renderLevelUpCard(card: LevelUpCard): Promise<ImageResponse> {
  const thread = THREAD[threadOf(card.rarity)];
  const rarityLabel = card.rarity ? RARITY_LABEL[card.rarity] : null;
  const svg = `data:image/svg+xml;base64,${Buffer.from(patchSvg(card.categorySlug, card.rarity)).toString("base64")}`;
  const milestone = card.levelTitle?.trim() || `Mốc ${card.level}`;
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: C.bg,
          color: C.text,
          fontFamily: "Be Vietnam Pro",
          padding: "64px 72px",
          alignItems: "center",
          gap: 64,
        }}
      >
        <div style={{ display: "flex", position: "relative", width: 400, height: 400, flexShrink: 0 }}>
          <img src={svg} width={400} height={400} alt="" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: C.muted }}>{card.categoryName}</div>
          <div
            style={{
              display: "flex",
              fontSize: card.skillName.length > 16 ? 54 : card.skillName.length > 11 ? 62 : 76,
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: 12,
            }}
          >
            {card.skillName}
          </div>
          <div style={{ display: "flex", marginTop: 22 }}>
            <div
              style={{
                display: "flex",
                fontSize: 40,
                fontWeight: 700,
                color: thread,
                background: patchFabric(card.categorySlug),
                border: `3px dashed ${thread}`,
                borderRadius: 14,
                padding: "8px 26px",
              }}
            >
              {`Xong mốc: ${milestone}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            {Array.from({ length: card.maxLevel }, (_, i) => (
              <div
                key={i}
                style={{ display: "flex", width: 64, height: 10, borderRadius: 999, background: i < card.level ? C.threadCommon : C.border }}
              />
            ))}
          </div>
          {rarityLabel ? (
            <div style={{ display: "flex", marginTop: 24 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  fontWeight: 700,
                  color: thread,
                  border: `3px dashed ${thread}`,
                  borderRadius: 999,
                  padding: "6px 22px",
                }}
              >
                {rarityLabel}
              </div>
            </div>
          ) : null}
          <div style={{ display: "flex", fontSize: 32, fontWeight: 500, marginTop: 44, color: C.text }}>
            {`${card.displayName} vừa được cộng đồng xác thực`}
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, marginTop: 28, color: C.muted }}>SkillVerse</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
}
