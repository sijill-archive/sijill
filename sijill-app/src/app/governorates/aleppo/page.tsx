import type { Metadata } from "next";
import { ProvinceExplorer } from "@/components/province-explorer";

export const metadata: Metadata = {
  title: "محافظة حلب | سِجِلّ",
  description: "استكشف مناطق ومدن محافظة حلب على خريطة سِجِلّ التفاعلية.",
};

export default function AleppoPage() {
  return <ProvinceExplorer slug="aleppo" />;
}
