/** Giới hạn video (app_config.media_limits, đổi sang camelCase). */
export type MediaLimits = { maxMb: number; maxSeconds: number; allowedTypes: string[] };

export type VideoClip = {
  file: File;
  url: string;
  durationS: number;
  width: number;
  height: number;
  /** Quay trong app (đảm bảo liên tục) hay chọn từ máy. */
  source: "camera" | "file";
};

const RECORDER_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickRecorderType(allowed: string[]): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return (
    RECORDER_TYPES.find((t) => allowed.includes(baseType(t)) && MediaRecorder.isTypeSupported(t)) ??
    null
  );
}

export const baseType = (t: string) => t.split(";")[0]!.trim().toLowerCase();

/** Bitrate để video dài nhất vẫn dưới giới hạn dung lượng (chừa 10%), trần 2.5 Mbps cho 720p. */
export function bitrateFor(limits: MediaLimits): number {
  return Math.floor(Math.min(2_500_000, (limits.maxMb * 8_000_000 * 0.9) / limits.maxSeconds));
}

/** Đọc thời lượng + kích thước khung hình. `fallbackDuration` dùng khi trình duyệt trả Infinity (webm từ MediaRecorder). */
export function readVideoMeta(url: string, fallbackDuration?: number): Promise<{ durationS: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : (fallbackDuration ?? 0);
      resolve({ durationS: Math.round(d), width: v.videoWidth, height: v.videoHeight });
    };
    v.onerror = () => reject(new Error("Không đọc được video này."));
    v.src = url;
  });
}

export type CheckState = "pass" | "warn" | "fail";
export type CheckItem = { key: string; state: CheckState; label: string; detail?: string };

/** Kiểm tra sơ bộ phía máy: chỉ tham khảo, người duyệt quyết định. */
export function precheck(clip: VideoClip, limits: MediaLimits): CheckItem[] {
  const items: CheckItem[] = [];
  const typeOk = limits.allowedTypes.includes(baseType(clip.file.type));
  items.push(
    typeOk
      ? { key: "type", state: "pass", label: "Định dạng" }
      : { key: "type", state: "fail", label: "Định dạng", detail: "Chỉ nhận MP4, WebM hoặc MOV." },
  );

  const mb = clip.file.size / 1_000_000;
  const sizeLabel = mb < 1 ? `${Math.max(1, Math.round(clip.file.size / 1000))} KB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  items.push(
    mb <= limits.maxMb
      ? { key: "size", state: "pass", label: sizeLabel }
      : { key: "size", state: "fail", label: `${Math.round(mb)} MB`, detail: `Tối đa ${limits.maxMb} MB. Quay ngắn hơn hoặc giảm độ phân giải.` },
  );

  const dur = formatDuration(clip.durationS);
  if (clip.durationS > limits.maxSeconds) {
    items.push({ key: "duration", state: "fail", label: dur, detail: `Tối đa ${formatDuration(limits.maxSeconds)}.` });
  } else if (clip.durationS < 5) {
    items.push({ key: "duration", state: "warn", label: dur, detail: "Video rất ngắn, người duyệt có thể không thấy đủ tiêu chí." });
  } else {
    items.push({ key: "duration", state: "pass", label: dur });
  }

  const short = Math.min(clip.width, clip.height);
  if (short > 0 && short < 720) {
    items.push({ key: "res", state: "warn", label: `${short}p`, detail: "Dưới 720p, người duyệt có thể khó thấy chi tiết." });
  } else if (short >= 720) {
    items.push({ key: "res", state: "pass", label: `${short}p` });
  }

  items.push(
    clip.source === "camera"
      ? { key: "continuous", state: "pass", label: "Quay liền mạch" }
      : { key: "continuous", state: "warn", label: "Video có sẵn", detail: "Đảm bảo video quay liên tục, không cắt ghép." },
  );
  return items;
}

export function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.max(0, Math.round(s - m * 60));
  return `${m}:${String(r).padStart(2, "0")}`;
}
