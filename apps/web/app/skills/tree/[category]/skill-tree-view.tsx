"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Hourglass, Lock, Users, Zap } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import { ButtonLink } from "@/components/ui/button";
import { IconLink } from "@/components/ui/icon-button";
import { LevelPatch } from "@/components/ui/level-patch";
import { InfoSheet } from "@/components/ui/sheet";
import { formatNumber, skillIcon } from "@/lib/skill-visual";

type Tree = RouterOutputs["skill"]["tree"];
type Node = Tree["nodes"][number];

const PATCH = 60;
const LABEL_H = 46;
const ROW_H = 150;
const TOP = 6;

type Placed = { node: Node; depth: number; frac: number };

/** Xếp nút theo độ sâu (đường dài nhất từ gốc), mỗi hàng sắp theo vị trí trung bình của nút cha. */
function layout(tree: Tree) {
  const inEdges = new Set<string>();
  for (const e of tree.edges) {
    inEdges.add(e.parentSkillId);
    inEdges.add(e.childSkillId);
  }
  const trail = tree.nodes.filter((n) => inEdges.has(n.skillId));
  const loose = tree.nodes.filter((n) => !inEdges.has(n.skillId));

  const parentsOf = new Map<string, string[]>();
  for (const e of tree.edges) parentsOf.set(e.childSkillId, [...(parentsOf.get(e.childSkillId) ?? []), e.parentSkillId]);

  const depthMemo = new Map<string, number>();
  const depth = (id: string, seen = new Set<string>()): number => {
    const known = depthMemo.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = parentsOf.get(id) ?? [];
    const d = ps.length ? Math.max(...ps.map((p) => depth(p, seen) + 1)) : 0;
    depthMemo.set(id, d);
    return d;
  };

  const rows: Node[][] = [];
  for (const n of trail) (rows[depth(n.skillId)] ??= []).push(n);

  const frac = new Map<string, number>();
  const placed: Placed[] = [];
  rows.forEach((row, d) => {
    const ordered =
      d === 0
        ? row
        : [...row].sort((a, b) => avgParent(a.skillId) - avgParent(b.skillId));
    ordered.forEach((n, i) => {
      const f = (i + 0.5) / ordered.length;
      frac.set(n.skillId, f);
      placed.push({ node: n, depth: d, frac: f });
    });
  });
  function avgParent(id: string) {
    const ps = (parentsOf.get(id) ?? []).map((p) => frac.get(p) ?? 0.5);
    return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0.5;
  }

  return { placed, loose, rows: rows.length, frac };
}

function defaultSelection(nodes: Node[], placed: Placed[]) {
  const depth = new Map(placed.map((p) => [p.node.skillId, p.depth]));
  const active = nodes
    .filter((n) => n.state === "practicing" && n.level > 0)
    .sort((a, b) => (depth.get(b.skillId) ?? -1) - (depth.get(a.skillId) ?? -1));
  return (
    active[0] ??
    nodes.find((n) => n.state === "practicing") ??
    nodes[0]
  )?.skillId;
}

export function SkillTreeView({ tree }: { tree: Tree }) {
  const { placed, loose, rows, frac } = useMemo(() => layout(tree), [tree]);
  const [selectedId, setSelectedId] = useState(() => defaultSelection(tree.nodes, placed));
  const selected = tree.nodes.find((n) => n.skillId === selectedId);

  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e?.contentRect.width ?? null));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const depthOf = new Map(placed.map((p) => [p.node.skillId, p.depth]));
  const levelOf = new Map(tree.nodes.map((n) => [n.skillId, n.level]));
  const height = rows * ROW_H - (ROW_H - PATCH - LABEL_H) + TOP;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <IconLink href="/profile" label="Quay lại hồ sơ" icon={ArrowLeft} />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-[22px] font-extrabold leading-tight">{tree.category.name}</h1>
          <p className="tabular text-[13px] text-muted">
            {tree.unlockedCount}/{tree.totalCount} đã mở
          </p>
        </div>
      </header>

      <ul className="flex gap-4 px-5 pb-1 pt-1 text-[12px] text-muted" aria-label="Chú giải">
        <li className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="6" fill="var(--color-trail)" />
          </svg>
          Đã đạt
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--color-trail)" strokeWidth="2" />
          </svg>
          Đang luyện
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--color-border-strong)" strokeWidth="2" strokeDasharray="2 2" />
          </svg>
          Chưa mở
        </li>
      </ul>

      <div className="px-3 pb-[340px] pt-5">
        <div ref={boxRef} className="relative" style={{ height }}>
          {w ? (
            <svg className="absolute inset-0" width={w} height={height} aria-hidden>
              {tree.edges.map((e) => {
                const pd = depthOf.get(e.parentSkillId);
                const cd = depthOf.get(e.childSkillId);
                if (pd === undefined || cd === undefined) return null;
                const x1 = (frac.get(e.parentSkillId) ?? 0.5) * w;
                const x2 = (frac.get(e.childSkillId) ?? 0.5) * w;
                const y1 = TOP + pd * ROW_H + PATCH + LABEL_H;
                const y2 = TOP + cd * ROW_H - 4;
                const my = (y1 + y2) / 2;
                // Đường mòn hơi uốn lượn, không thẳng như sơ đồ khối
                const sway = x1 === x2 ? 6 : 0;
                const d = `M ${x1} ${y1} C ${x1 + sway} ${my - 4}, ${x2 - sway} ${my + 4}, ${x2} ${y2}`;
                const walked = (levelOf.get(e.parentSkillId) ?? 0) >= e.requiredLevel;
                return walked ? (
                  <path
                    key={`${e.parentSkillId}-${e.childSkillId}`}
                    d={d}
                    fill="none"
                    stroke="var(--color-trail)"
                    strokeOpacity={0.7}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    key={`${e.parentSkillId}-${e.childSkillId}`}
                    d={d}
                    fill="none"
                    stroke="var(--color-border-strong)"
                    strokeWidth={2.5}
                    strokeDasharray="1 7"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
          ) : null}

          {placed.map(({ node, depth, frac: f }) => (
            <TreeNode
              key={node.skillId}
              node={node}
              categorySlug={tree.category.slug}
              selected={node.skillId === selectedId}
              onSelect={() => setSelectedId(node.skillId)}
              style={{ left: `${f * 100}%`, top: TOP + depth * ROW_H }}
            />
          ))}
        </div>

        {loose.length > 0 ? (
          <section aria-labelledby="loose" className="mt-8 border-t border-dashed border-border pt-5">
            <h2 id="loose" className="px-2 text-[14px] font-semibold text-muted">
              Kỹ năng riêng lẻ
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-y-4">
              {loose.map((node) => (
                <TreeNode
                  key={node.skillId}
                  node={node}
                  categorySlug={tree.category.slug}
                  selected={node.skillId === selectedId}
                  onSelect={() => setSelectedId(node.skillId)}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {selected ? <NodeSheet node={selected} /> : null}
    </div>
  );
}

function TreeNode({
  node,
  categorySlug,
  selected,
  onSelect,
  style,
}: {
  node: Node;
  categorySlug: string;
  selected: boolean;
  onSelect: () => void;
  style?: React.CSSProperties;
}) {
  const positioned = style !== undefined;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      style={style}
      className={`group flex w-[104px] flex-col items-center gap-1.5 justify-self-center rounded-[14px] pb-1 pt-0 ${
        positioned ? "absolute -translate-x-1/2" : ""
      }`}
    >
      <span
        className={`relative flex items-center justify-center rounded-full transition-colors ${
          selected ? "bg-accent-soft outline-2 outline-offset-2 outline-accent outline-dashed" : ""
        }`}
        style={{ width: PATCH, height: PATCH }}
      >
        {node.state === "locked" ? (
          <LevelPatch categorySlug={categorySlug} rarity={node.rarity} state="locked" size={PATCH - 4} label={`${node.name}, chưa mở`} />
        ) : (
          <LevelPatch
            categorySlug={categorySlug}
            rarity={node.rarity}
            state={node.state === "achieved" ? "earned" : "practicing"}
            level={node.level > 0 ? node.level : undefined}
            icon={node.level > 0 ? undefined : skillIcon(node.slug, categorySlug)}
            size={PATCH - 4}
            label={`${node.name}, cấp ${node.level} trên ${node.maxLevel}`}
          />
        )}
        {node.pendingProof ? (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-surface-3 text-muted">
            <Hourglass size={12} aria-label="Đang chờ duyệt" />
          </span>
        ) : null}
      </span>
      <span
        className={`line-clamp-2 rounded-[6px] bg-bg px-1 text-center text-[13px] font-semibold leading-tight ${
          node.state === "locked" ? "text-muted" : "text-text"
        } ${selected ? "text-accent" : ""}`}
      >
        {node.name}
      </span>
    </button>
  );
}

function NodeSheet({ node }: { node: Node }) {
  const unmet = node.prerequisites.filter((p) => !p.met);
  return (
    <section
      aria-label={`Kỹ năng ${node.name}`}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] rounded-t-[22px] border-t border-border bg-surface-2 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="truncate font-display text-[21px] font-extrabold leading-tight">{node.name}</h2>
          <p className="tabular flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
            <span>
              Cấp {node.level}/{node.maxLevel}
            </span>
            {node.next ? (
              <span className="inline-flex items-center gap-1">
                <Users size={13} aria-hidden />
                {formatNumber(node.next.holdersAtOrAbove)} người đạt cấp {node.next.level}
              </span>
            ) : null}
          </p>
        </div>
        {node.next && node.state !== "locked" ? (
          <span className="tabular inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-bold text-accent">
            <Zap size={13} aria-hidden />+{node.next.xpReward} XP
          </span>
        ) : null}
      </div>

      {node.state === "locked" ? (
        <ul className="mt-4 flex flex-col gap-2">
          {unmet.map((p) => (
            <li key={p.skillId} className="flex items-center gap-2.5 text-[14px]">
              <Lock size={16} className="shrink-0 text-muted" aria-hidden />
              <span>
                {p.name} cấp {p.requiredLevel}
              </span>
              <span className="tabular ml-auto text-[13px] text-muted">
                {p.userLevel}/{p.requiredLevel}
              </span>
            </li>
          ))}
        </ul>
      ) : node.next ? (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <h3 className="text-[14px] font-semibold text-muted">Yêu cầu cấp {node.next.level}</h3>
            <InfoSheet title="Ai xác thực?" label="Cách xác thực">
              {node.next.minReviewers} người đạt cấp {node.next.minReviewerLevel} trở lên của kỹ năng này được chọn ngẫu nhiên để duyệt
              video của bạn theo từng tiêu chí.
            </InfoSheet>
          </div>
          <ul className="flex flex-col gap-1.5">
            {node.next.criteria.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 text-[14px] leading-snug">
                <Check size={16} className="mt-0.5 shrink-0 text-teal" aria-hidden />
                <span className="line-clamp-2">{c.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-teal">
          <Check size={18} aria-hidden />
          Đã đạt cấp cao nhất
        </p>
      )}

      <div className="mt-4 flex gap-2.5">
        {node.state === "practicing" && node.next && !node.pendingProof ? (
          <ButtonLink href={`/proof/new?skill=${node.slug}`} className="flex-1">
            Gửi xác thực
          </ButtonLink>
        ) : null}
        {node.pendingProof ? (
          <p className="flex min-h-[52px] flex-1 items-center gap-2 text-[14px] font-semibold text-muted">
            <Hourglass size={16} aria-hidden />
            Chờ duyệt cấp {node.pendingProof.targetLevel}
          </p>
        ) : null}
        <ButtonLink
          href={`/skills/${node.slug}`}
          variant="secondary"
          className={node.state === "practicing" || node.pendingProof ? "" : "flex-1"}
        >
          Chi tiết
        </ButtonLink>
      </div>
    </section>
  );
}
