import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { SwRegister } from "@/components/sw-register";
import { THEME_COLOR, THEME_COOKIE, themeFrom } from "@/lib/theme";
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
  metadataBase: new URL(process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000"),
  title: { default: "SkillVerse", template: "%s · SkillVerse" },
  description: "Học kỹ năng mới, khoe từng mốc, kết bạn cùng sở thích.",
  applicationName: "SkillVerse",
  appleWebApp: { capable: true, title: "SkillVerse", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/icons/apple-touch-icon.png" },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return { themeColor: THEME_COLOR[theme], width: "device-width", initialScale: 1, viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="vi" data-theme={theme} className={`${beVietnam.variable} ${bitter.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
        <SwRegister />
      </body>
    </html>
  );
}
