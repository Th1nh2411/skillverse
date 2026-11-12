import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "SkillVerse",
    short_name: "SkillVerse",
    description: "Lên level kỹ năng bằng bằng chứng được cộng đồng xác thực.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1611",
    theme_color: "#0e1611",
    lang: "vi",
    categories: ["education", "lifestyle", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Đăng bằng chứng", url: "/proof/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Duyệt bằng chứng", url: "/review", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
