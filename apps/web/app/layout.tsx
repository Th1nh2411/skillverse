import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SkillVerse", template: "%s · SkillVerse" },
  description: "Lên level kỹ năng bằng bằng chứng được cộng đồng xác thực.",
  applicationName: "SkillVerse",
  appleWebApp: { capable: true, title: "SkillVerse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#121a15",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
