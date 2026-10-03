import type { Metadata, Viewport } from "next";
import { SiteMenu } from "@/components/site-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: "سِجِلّ | أرشيف الذاكرة المدنية",
  description:
    "منصة مدنية لحفظ الشهادات والوثائق والأحداث التاريخية وتنظيمها، كي تبقى الذاكرة متاحة للأجيال واللاجئين.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#173b30",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body><SiteMenu />{children}</body>
    </html>
  );
}
