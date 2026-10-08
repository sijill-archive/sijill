import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { CaseArchiveList } from "@/components/case-archive-list";
import { findPlaceLocations } from "@/lib/geography";

type PageProps = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ governorate?: string; district?: string }>;
};

export default async function CityArchivePage({ params, searchParams }: PageProps) {
  const [{ city: rawCity }, filters] = await Promise.all([params, searchParams]);
  const city = decodeURIComponent(rawCity);
  const knownLocations = findPlaceLocations(city);
  const resolvedLocation = knownLocations.find(({ governorate: item }) => item.name === filters.governorate) ?? (knownLocations.length === 1 ? knownLocations[0] : undefined);
  const governorate = filters.governorate ?? resolvedLocation?.governorate.name;
  const district = filters.district ?? resolvedLocation?.district.name;
  const governorateSlug = resolvedLocation?.governorate.slug;

  return <main dir="rtl" className="min-h-screen bg-[#101713] px-5 pb-16 text-[#eff3e9] sm:px-8">
    <header className="mx-auto flex max-w-6xl items-center justify-between py-7">
      <Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo tone="white" className="h-12 w-12" /></Link>
      <Link href={governorateSlug ? `/governorates/${governorateSlug}` : "/"} className="text-sm text-[#c0dec2] underline underline-offset-4">العودة إلى الخريطة</Link>
    </header>
    <section className="mx-auto max-w-6xl pt-5">
      <p className="text-xs tracking-widest text-[#c9a76b]">الأرشيف حسب الموقع</p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{city}</h1>
      <p className="mt-2 text-sm text-[#a5b3a7]">القضايا والملفات المنشورة في هذا الموقع</p>
      <CaseArchiveList governorate={governorate} district={district} city={city} />
    </section>
  </main>;
}
