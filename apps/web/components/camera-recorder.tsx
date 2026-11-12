"use client";
import { SwitchCamera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { baseType, bitrateFor, formatDuration, pickRecorderType, readVideoMeta, type MediaLimits, type VideoClip } from "@/lib/video";

/**
 * Quay video trong app: MediaRecorder, khung hình theo proof.limits.recorder (mặc định 480p), tự dừng ở giới hạn thời lượng.
 * Toàn màn hình; Esc hoặc nút X để hủy.
 */
export function CameraRecorder({
  limits,
  onDone,
  onCancel,
  onUnavailable,
}: {
  limits: MediaLimits;
  onDone: (clip: VideoClip) => void;
  onCancel: () => void;
  /** Không có camera / bị từ chối quyền → cha chuyển sang chọn file. */
  onUnavailable: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !pickRecorderType(limits.allowedTypes)) {
        onUnavailable("Trình duyệt này không quay được. Chọn video có sẵn.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, height: { ideal: limits.recorder.height }, frameRate: { ideal: 30 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      } catch {
        if (!cancelled) onUnavailable("Không mở được camera. Cho phép quyền camera hoặc chọn video có sẵn.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  useEffect(() => () => stopStream(), []);

  const stop = useCallback(() => recRef.current?.state === "recording" && recRef.current.stop(), []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const s = (performance.now() - startedAt.current) / 1000;
      setElapsed(s);
      if (s >= limits.maxSeconds) stop();
    }, 250);
    return () => clearInterval(id);
  }, [recording, limits.maxSeconds, stop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !recording) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, onCancel]);

  function start() {
    const stream = streamRef.current;
    const mimeType = pickRecorderType(limits.allowedTypes);
    if (!stream || !mimeType) return;
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrateFor(limits) });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      setRecording(false);
      const seconds = (performance.now() - startedAt.current) / 1000;
      const type = baseType(mimeType);
      const file = new File(chunks, `bang-chung.${type === "video/mp4" ? "mp4" : "webm"}`, { type });
      const url = URL.createObjectURL(file);
      const meta = await readVideoMeta(url, seconds).catch(() => ({ durationS: Math.round(seconds), width: 0, height: 0 }));
      const track = stream.getVideoTracks()[0]?.getSettings();
      stopStream();
      onDone({
        file,
        url,
        durationS: meta.durationS || Math.round(seconds),
        width: meta.width || track?.width || 0,
        height: meta.height || track?.height || 0,
        source: "camera",
      });
    };
    recRef.current = rec;
    startedAt.current = performance.now();
    setElapsed(0);
    rec.start(1000);
    setRecording(true);
  }

  const remaining = Math.max(0, limits.maxSeconds - elapsed);
  return (
    <div role="dialog" aria-modal="true" aria-label="Quay video" className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 size-full object-cover" />

      <div className="relative flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <button
          type="button"
          aria-label="Đóng camera"
          disabled={recording}
          onClick={onCancel}
          className="inline-flex size-11 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-40"
        >
          <X size={22} aria-hidden />
        </button>
        <span
          aria-live="polite"
          className={`tabular rounded-full px-3 py-1 text-[15px] font-bold ${recording ? "bg-danger text-white" : "bg-black/50 text-white"}`}
        >
          {recording ? formatDuration(elapsed) : formatDuration(limits.maxSeconds)}
        </span>
        <button
          type="button"
          aria-label="Đổi camera"
          disabled={recording}
          onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          className="inline-flex size-11 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-40"
        >
          <SwitchCamera size={22} aria-hidden />
        </button>
      </div>

      <div className="relative mt-auto flex flex-col items-center gap-3 pb-[max(env(safe-area-inset-bottom),28px)]">
        {recording && remaining <= 15 ? (
          <span className="tabular rounded-full bg-black/60 px-3 py-1 text-[13px] font-semibold text-white">
            Còn {Math.ceil(remaining)} giây
          </span>
        ) : null}
        <button
          type="button"
          disabled={!ready}
          onClick={recording ? stop : start}
          aria-label={recording ? "Dừng quay" : "Bắt đầu quay"}
          className="flex size-[76px] items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span
            className={`block bg-danger transition-all ${recording ? "size-7 rounded-[6px]" : "size-[58px] rounded-full"}`}
          />
        </button>
      </div>
    </div>
  );
}
