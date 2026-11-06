import type { Metadata } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import { THEME_BOOT_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

const plex = IBM_Plex_Sans_KR({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  preload: false, // 한글 글리프는 용량이 커서 미리 받지 않음
  display: "swap",
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: "NPD 일정·이력 관리",
  description: "신제품 개발 일정 역산, 간트, 신호등, 지연 흡수",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${plex.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Suspense fallback={<p className="p-8 text-sm text-muted">불러오는 중…</p>}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
