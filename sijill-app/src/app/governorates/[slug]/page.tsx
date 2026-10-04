import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProvinceExplorer } from "@/components/province-explorer";
import mapData from "@/data/syria-district-explorers.json";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return mapData.governorates
    .filter((province) => province.slug !== "aleppo")
    .map((province) => ({ slug: province.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const province = mapData.governorates.find((item) => item.slug === slug);
  if (!province) return { title: "المحافظة غير موجودة | سِجِلّ" };
  return {
    title: `محافظة ${province.name} | سِجِلّ`,
    description: `استكشف مناطق ومدن وبلدات محافظة ${province.name} على خريطة سِجِلّ التفاعلية.`,
  };
}

export default async function GovernoratePage({ params }: PageProps) {
  const { slug } = await params;
  if (!mapData.governorates.some((province) => province.slug === slug && province.slug !== "aleppo")) notFound();
  return <ProvinceExplorer slug={slug} />;
}
