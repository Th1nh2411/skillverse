import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkillVerse",
    short_name: "SkillVerse",
    description: "Lên level kỹ năng bằng bằng chứng được cộng đồng xác thực.",
    start_url: "/home",
    display: "standalone",
    background_color: "#121a15",
    theme_color: "#121a15",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
