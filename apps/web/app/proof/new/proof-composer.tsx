"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, CircleX, Upload, Video, X } from "lucide-react";
import { CameraRecorder } from "@/components/camera-recorder";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { LevelPatch } from "@/components/ui/level-patch";
import { InfoSheet } from "@/components/ui/sheet";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import type { Rarity } from "@/lib/skill-visual";
import { formatDuration, precheck, readVideoMeta, type CheckItem, type MediaLimits, type VideoClip } from "@/lib/video";

type Props = {
  limits: MediaLimits;
  /** Đến từ "Tham gia" thử thách: nộp xong thì tham gia bằng bằng chứng này. */
  challengeId?: string;
  skill: { id: string; slug: string; name: string; categorySlug: string; rarity: Rarity; riskLevel: "none" | "low" | "high" };
  myLevel: number;
  target: { level: number; criteria: { id: string; text: string }[]; minReviewers: number; minReviewerLevel: number };
};

type Phase = { kind: "idle" } | { kind: "uploading"; pct: number } | { kind: "submitting" };

export function ProofComposer({ limits, challengeId, skill, myLevel, target }: Props) {
  const router = useRouter();
  const trpc = useTRPC();
  const createUpload = useMutation(trpc.proof.createUpload.mutationOptions());
  const submitProof = useMutation(trpc.proof.submit.mutationOptions());
  const joinChallenge = useMutation(trpc.challenge.join.mutationOptions());
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  const [clip, setClip] = useState<VideoClip | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [ack, setAck] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (clip?.url) URL.revokeObjectURL(clip.url);
    },
    [clip],
  );

  const checks: CheckItem[] = clip ? precheck(clip, limits) : [];
  const blocked = checks.some((c) => c.state === "fail");
  const risky = skill.riskLevel !== "none";
  const busy = phase.kind !== "idle";
  const canSubmit = clip && !blocked && (!risky || ack) && !busy;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setNotice(null);
    const url = URL.createObjectURL(f);
    try {
      const meta = await readVideoMeta(url);
      setClip({ file: f, url, ...meta, source: "file" });
    } catch {
      URL.revokeObjectURL(url);
      setNotice("Không đọc được video này. Thử file khác.");
    }
  }

  async function submit() {
    if (!clip) return;
    setError(null);
    try {
      setPhase({ kind: "uploading", pct: 0 });
      const up = await createUpload.mutateAsync({ contentType: clip.file.type, sizeBytes: clip.file.size });
      if (up.uploadUrl) {
        await putWithProgress(up.uploadUrl, clip.file, up.headers, (pct) => setPhase({ kind: "uploading", pct }));
      }
      setPhase({ kind: "submitting" });
      const res = await submitProof.mutateAsync({
        skillId: skill.id,
        targetLevel: target.level,
        mediaKey: up.mediaKey,
        durationS: clip.durationS || undefined,
        caption: caption.trim() || undefined,
        safetyAck: risky ? ack : false,
      });
      if (challengeId) {
        // Không chặn luồng nộp nếu tham gia lỗi (vd. thử thách vừa kết thúc).
        await joinChallenge.mutateAsync({ challengeId, proofId: res.proofId }).catch(() => undefined);
      }
      router.replace(`/proofs/${res.proofId}`);
    } catch (e) {
      setPhase({ kind: "idle" });
      setError(e instanceof Error && e.message ? e.message : "Gửi không thành công. Thử lại.");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col pb-40">
      <header className="flex items-center gap-1 px-3 pt-3">
        <BackButton fallback={`/skills/${skill.slug}`} label="Đóng" />
        <h1 className="font-display text-[22px] font-extrabold">Đăng bằng chứng</h1>
      </header>

      <section className="mx-5 mt-3 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-3.5 py-3">
        <LevelPatch categorySlug={skill.categorySlug} rarity={skill.rarity} state="practicing" level={target.level} size={48} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-bold">{skill.name}</span>
          <span className="tabular text-[13px] text-muted">
            Cấp {myLevel} → {target.level}
          </span>
        </div>
        <Link
          href="/proof/new"
          className="inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-accent"
        >
          Đổi
        </Link>
      </section>

      <section aria-labelledby="need" className="mx-5 mt-4 flex flex-col gap-1.5">
        <h2 id="need" className="text-[13px] font-semibold text-muted">
          Video cần cho thấy
        </h2>
        <ul className="flex flex-col gap-1">
          {target.criteria.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-[14px] leading-snug">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-trail" aria-hidden />
              {c.text}
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-5 mt-5">
        {clip ? (
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-black">
            <video src={clip.url} controls playsInline className="aspect-video w-full object-contain" />
            <span className="tabular pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white">
              {formatDuration(clip.durationS)}
            </span>
            {!busy ? (
              <button
                type="button"
                aria-label="Bỏ video này"
                onClick={() => setClip(null)}
                className="absolute right-1.5 top-1.5 inline-flex size-11 items-center justify-center rounded-full text-white"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-black/60">
                  <X size={18} aria-hidden />
                </span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-dashed border-border-strong p-4">
            <Button onClick={() => setCamera(true)} className="w-full">
              <Video size={20} aria-hidden />
              Quay video
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full">
              <Upload size={18} aria-hidden />
              Chọn video có sẵn
            </Button>
            <p className="tabular text-center text-[12px] text-muted">
              Tối đa {formatDuration(limits.maxSeconds)}, {limits.maxMb} MB
            </p>
            {notice ? (
              <p role="alert" className="text-center text-[13px] text-danger">
                {notice}
              </p>
            ) : null}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={limits.allowedTypes.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {clip ? (
        <section aria-labelledby="check" className="mx-5 mt-5 flex flex-col gap-2.5">
          <div className="flex items-center gap-1">
            <h2 id="check" className="text-[15px] font-bold">
              Kiểm tra sơ bộ
            </h2>
            <InfoSheet title="Kiểm tra sơ bộ" label="Cách kiểm tra sơ bộ hoạt động">
              Máy kiểm tra nhanh định dạng, dung lượng, thời lượng và độ nét. Kết quả chỉ để tham khảo, người duyệt vẫn quyết định.
            </InfoSheet>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {checks
              .filter((c) => c.state === "pass")
              .map((c) => (
                <li key={c.key} className="tabular inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  <CircleCheck size={16} className="text-teal" aria-label="Đạt" />
                  {c.label}
                </li>
              ))}
          </ul>
          {checks
            .filter((c) => c.state !== "pass")
            .map((c) => (
              <p
                key={c.key}
                className={`flex items-start gap-2 text-[13px] leading-snug ${c.state === "fail" ? "text-danger" : "text-accent"}`}
              >
                {c.state === "fail" ? (
                  <CircleX size={16} className="mt-px shrink-0" aria-label="Không đạt" />
                ) : (
                  <CircleAlert size={16} className="mt-px shrink-0" aria-label="Cảnh báo" />
                )}
                <span>
                  <b className="tabular font-semibold">{c.label}.</b> <span className="text-text">{c.detail}</span>
                </span>
              </p>
            ))}
        </section>
      ) : null}

      <div className="mx-5 mt-5 flex flex-col gap-1.5">
        <label htmlFor="caption" className="text-[13px] font-semibold text-muted">
          Mô tả
        </label>
        <textarea
          id="caption"
          rows={2}
          maxLength={500}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Dụng cụ, điều kiện, mẹo của bạn"
          className="min-h-[76px] resize-none rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-3 text-[15px] text-text placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
      </div>

      {risky ? (
        <label className="mx-5 mt-4 flex cursor-pointer items-start gap-3 rounded-[14px] border border-accent-line bg-accent-soft px-3.5 py-3">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="text-[14px] leading-snug">Tôi đã thực hiện ở nơi an toàn, đúng quy định địa phương.</span>
        </label>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[560px] flex-col gap-2 border-t border-border bg-bg px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        {error ? (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-1 text-[12px] text-muted">
          <span className="tabular">
            {target.minReviewers} người cấp {target.minReviewerLevel}+ sẽ duyệt
          </span>
        </div>
        <Button className="w-full" disabled={!canSubmit} onClick={submit}>
          {phase.kind === "uploading" ? (
            <span className="tabular">Đang tải lên {phase.pct}%</span>
          ) : phase.kind === "submitting" ? (
            "Đang gửi"
          ) : (
            "Gửi xác thực"
          )}
        </Button>
      </div>

      {camera ? (
        <CameraRecorder
          limits={limits}
          onCancel={() => setCamera(false)}
          onDone={(c) => {
            setCamera(false);
            setClip(c);
          }}
          onUnavailable={(msg) => {
            setCamera(false);
            setNotice(msg);
          }}
        />
      ) : null}
    </main>
  );
}

function putWithProgress(url: string, file: File, headers: Record<string, string>, onPct: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    const h = { "Content-Type": file.type, ...headers };
    for (const [k, v] of Object.entries(h)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Tải video lên không thành công.")));
    xhr.onerror = () => reject(new Error("Mất kết nối khi tải video. Thử lại."));
    xhr.send(file);
  });
}
