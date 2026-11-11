import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SkillVerse",
    short_name: "SkillVerse",
    description: "Lên level kỹ năng bằng bằng chứng được cộng đồng xác thực.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0e1611",
    theme_color: "#0e1611",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
