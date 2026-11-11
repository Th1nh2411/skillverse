import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bitter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

/** Font tiêu đề duy nhất (slab, hợp sổ tay thực địa); có subset vietnamese. */
const bitter = Bitter({
  subsets: ["latin", "vietnamese"],
  weight: ["700", "800"],
  variable: "--font-bitter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SkillVerse", template: "%s · SkillVerse" },
  description: "Lên level kỹ năng bằng bằng chứng được cộng đồng xác thực.",
  applicationName: "SkillVerse",
  appleWebApp: { capable: true, title: "SkillVerse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0e1611",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${bitter.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
