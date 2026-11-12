"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Hourglass, Lock, Video } from "lucide-react";
import type { RouterOutputs } from "@skillverse/api";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { useMilestoneFlow } from "@/components/milestone-tick";
import { IconLink } from "@/components/ui/icon-button";
import { LevelPatch } from "@/components/ui/level-patch";
import { MilestoneBar } from "@/components/ui/milestone";
import { ArtHeader, CategoryArt } from "@/components/illustrations";
import { milestoneName } from "@/lib/milestone";
import { skillIcon } from "@/lib/skill-visual";

type Tree = RouterOutputs["skill"]["tree"];
type Node = Tree["nodes"][number];

const PATCH = 60;
const LABEL_H = 66;
const ROW_H = 164;
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
  const levelOf = new Map(tree.nodes.map((n) => [n.skillId, Math.max(n.level, n.selfLevel)]));
  const height = rows * ROW_H - (ROW_H - PATCH - LABEL_H) + TOP;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <ArtHeader art={<CategoryArt slug={tree.category.slug} size={118} />} className="mb-1 gap-2">
        <IconLink href="/profile" label="Quay lại hồ sơ" icon={ArrowLeft} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-display text-[22px] font-extrabold leading-tight">{tree.category.name}</h1>
          <p className="tabular inline-flex items-center gap-1 text-[13px] text-muted">
            <Lock size={12} aria-hidden />
            {tree.unlockedCount}/{tree.totalCount} đã mở
          </p>
        </div>
      </ArtHeader>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-1 pt-1 text-[12px] text-muted" aria-label="Chú giải">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-[8px] rounded-full bg-accent" />
          Đã xác nhận
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-[8px] rounded-full border border-trail" />
          Tự đánh dấu
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
  const firstUnmet = node.prerequisites.find((p) => !p.met);
  const lockHint = firstUnmet ? milestoneName(firstUnmet.requiredLevelTitle, firstUnmet.requiredLevel) : null;
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
            state={node.level > 0 ? "earned" : "practicing"}
            icon={skillIcon(node.slug, categorySlug)}
            size={PATCH - 4}
            label={`${node.name}, ${node.selfLevel >= node.maxLevel ? "đã xong" : `xong ${node.selfLevel}/${node.maxLevel} mốc`}`}
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
      {node.state === "locked" && lockHint ? (
        <span className="line-clamp-2 px-1 text-center text-[11px] leading-tight text-muted">
          Xong mốc {lockHint}
        </span>
      ) : node.state !== "locked" ? (
        <span aria-hidden className="flex gap-[3px]">
          {Array.from({ length: node.maxLevel }, (_, i) => (
            <span
              key={i}
              className={`size-[6px] rounded-full ${
                i < node.level ? "bg-accent" : i < node.selfLevel ? "border border-trail" : "bg-surface-3"
              }`}
            />
          ))}
        </span>
      ) : null}
    </button>
  );
}

function NodeSheet({ node }: { node: Node }) {
  const unmet = node.prerequisites.filter((p) => !p.met);
  const next = node.next;
  const flow = useMilestoneFlow();
  const { pending } = flow;
  const done = node.selfLevel >= node.maxLevel;
  return (
    <section
      aria-label={`Kỹ năng ${node.name}`}
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] rounded-t-[22px] border-t border-border bg-surface-2 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3"
    >
      <Link href={`/skills/${node.slug}`} className="-mx-2 flex min-h-11 items-center gap-1 rounded-[12px] px-2 hover:bg-surface-3">
        <h2 className="min-w-0 flex-1 truncate font-display text-[21px] font-extrabold leading-tight">{node.name}</h2>
        <span className="text-[13px] font-semibold text-muted">Chi tiết</span>
        <ChevronRight size={18} className="text-muted" aria-hidden />
      </Link>
      <MilestoneBar value={node.selfLevel} max={node.maxLevel} verified={node.verifiedCount} showCount showNext={node.state !== "locked" && !done} className="mt-1" />

      {node.state === "locked" ? (
        <ul className="mt-4 flex flex-col gap-2" aria-label="Điều kiện mở">
          {unmet.map((p) => (
            <li key={p.skillId} className="flex items-center gap-2.5 text-[14px]">
              <Lock size={16} className="shrink-0 text-muted" aria-hidden />
              <span>
                <b className="font-semibold">{p.name}</b>: xong mốc {milestoneName(p.requiredLevelTitle, p.requiredLevel)}
              </span>
            </li>
          ))}
        </ul>
      ) : next ? (
        <div className="mt-3 flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="text-[15px] font-bold">
              <span className="font-semibold text-accent">Mốc tiếp: </span>
              {milestoneName(next.title, next.level)}
            </h3>
            {next.task ? (
              <p className="flex items-start gap-2 text-[14px] leading-snug text-muted">
                <Video size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span className="line-clamp-2">{next.task}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-teal">
          <Check size={18} aria-hidden />
          Xong cả {node.maxLevel} mốc
        </p>
      )}

      {node.state !== "locked" && next ? (
        <div className="mt-3 flex gap-2.5">
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() =>
              flow.askCheck({ skillLevelId: next.skillLevelId, level: next.level, name: milestoneName(next.title, next.level), task: next.task })
            }
          >
            <Check size={18} strokeWidth={3} className={flow.celebrate === next.level ? "tick-pop" : ""} aria-hidden />
            Xong rồi
          </Button>
          {node.pendingProof ? (
            <ButtonLink href={`/proofs/${node.pendingProof.proofId}`} variant="secondary">
              <Hourglass size={16} aria-hidden />
              Chờ duyệt
            </ButtonLink>
          ) : (
            <ButtonLink href={`/proof/new?skill=${node.slug}`} variant="secondary">
              <Video size={17} aria-hidden />
              Nhờ xác nhận
            </ButtonLink>
          )}
        </div>
      ) : null}
      {flow.sheet}
    </section>
  );
}
