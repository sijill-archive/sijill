"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ContributionButtons } from "@/components/site-menu";
import { StatisticsStrip } from "@/components/statistics-strip";
import mapData from "@/data/syria-district-explorers.json";
import { useArchiveCounts } from "@/lib/use-archive-counts";
import { CaseArchiveList } from "@/components/case-archive-list";

type Province = (typeof mapData.governorates)[number];
type District = Province["districts"][number];

function districtViewBox(district: District) {
  const aspect = 780 / 620;
  const width = Math.max(district.bounds.width * 1.5, district.bounds.height * aspect * 1.5, 1);
  const height = width / aspect;
  return `${district.bounds.cx - width / 2} ${district.bounds.cy - height / 2} ${width} ${height}`;
}

export function ProvinceExplorer({ slug }: { slug: string }) {
  const province = mapData.governorates.find((item) => item.slug === slug) as Province | undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const selected = province?.districts.find((district) => district.id === selectedId) ?? null;
  const archiveCounts = useArchiveCounts(province?.name, selected?.name);
  const hovered = province?.districts.find((district) => district.id === hoveredId) ?? null;
  const viewBoxText = selected ? districtViewBox(selected) : province?.viewBox ?? "0 0 780 620";
  const [minX, minY, viewWidth, viewHeight] = viewBoxText.split(" ").map(Number);

  useEffect(() => {
    const restoreLayer = () => {
      const id = window.history.state?.sijillDistrict as string | undefined;
      const district = province?.districts.find((item) => item.id === id);
      setSelectedId(district?.id ?? null);
    };
    restoreLayer();
    window.addEventListener("popstate", restoreLayer);
    return () => window.removeEventListener("popstate", restoreLayer);
  }, [province]);

  if (!province) return null;

  const selectDistrict = (district: District) => {
    setSelectedId(district.id);
    setHoveredId(null);
    window.history.pushState(
      { ...(window.history.state ?? {}), sijillDistrict: district.id },
      "",
      `${window.location.pathname}${window.location.search}#${encodeURIComponent(district.id)}`,
    );
  };

  const showDistricts = () => {
    setSelectedId(null);
    setHoveredPlace(null);
    window.history.replaceState(
      { ...(window.history.state ?? {}), sijillDistrict: null },
      "",
      window.location.pathname + window.location.search,
    );
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#101713] text-[#eff3e9]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 pb-6 pt-8 sm:px-8 lg:px-12">
        <Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo tone="white" className="h-12 w-12" /></Link>
        <p className="text-xs text-[#92aa98]">أرشيف الذاكرة السورية</p>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-14 sm:px-8 lg:px-12">
        <nav aria-label="مسار التنقل" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-[#95a89b]">
          <Link href="/" className="transition hover:text-white">سوريا</Link><span aria-hidden="true">/</span>
          {selected ? <button type="button" onClick={showDistricts} className="hover:text-white">{province.name}</button> : <span className="text-[#f1f2e9]">{province.name}</span>}
          {selected && <><span aria-hidden="true">/</span><span className="text-[#f1f2e9]">{selected.name}</span></>}
          {selected && hoveredPlace && <><span aria-hidden="true">/</span><span className="text-[#f1f2e9]">{hoveredPlace}</span></>}
        </nav>

        <div className="mb-8 flex flex-col gap-5 border-y border-white/10 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] tracking-[.24em] text-[#c9a76b]">استكشف حسب المكان</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">محافظة {province.name}</h1><p className="mt-2 text-xs leading-6 text-[#a5b3a7]">{selected ? `اختر مدينة أو بلدة من منطقة ${selected.name}` : "اختر منطقة من الخريطة لاستعراض المدن والبلدات التابعة لها"}</p></div>
          <StatisticsStrip tone="dark" className="w-full sm:min-w-[300px] lg:w-auto" items={[{ label: "القضايا المنشورة", value: archiveCounts.cases }, { label: "الملفات المنشورة", value: archiveCounts.files }]} />
        </div>

        <div className="mb-7 flex justify-start"><ContributionButtons /></div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[#95a89b]">{selected ? `المدن والبلدات في ${selected.name}` : `مناطق محافظة ${province.name}`}</p>
          {selected && <button type="button" onClick={showDistricts} className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-[#d2e5d0] transition hover:border-[#d2e5d0] hover:bg-white/5">العودة إلى المناطق</button>}
        </div>

        <div className="relative mx-auto aspect-[39/31] w-full max-w-[1040px]">
          <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[#548566]/10 blur-[80px]" />
          <svg viewBox={viewBoxText} role="img" aria-labelledby="province-map-title" className="absolute inset-0 h-full w-full overflow-hidden">
            <title id="province-map-title">خريطة تفاعلية لمناطق محافظة {province.name}</title>
            <defs>
              <filter id="province-boundary-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="province-focus-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="province-map-shadow" x="-30%" y="-25%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#000" floodOpacity=".55"/></filter>
            </defs>
            <g filter="url(#province-boundary-glow)" opacity={selected ? .25 : .95} pointerEvents="none">
              {province.districts.map((district) => <path key={`glow-${district.id}`} d={district.d} fill="none" stroke="#b6e4bd" strokeWidth="3.5" vectorEffect="non-scaling-stroke" />)}
            </g>
            <g filter="url(#province-map-shadow)" fillRule="evenodd">
              {province.districts.map((district) => {
                const active = hoveredId === district.id;
                const focused = selectedId === district.id;
                return <motion.path key={district.id} d={district.d} role="button" tabIndex={0} aria-label={`استعرض منطقة ${district.name}`} aria-pressed={focused}
                  onMouseEnter={() => setHoveredId(district.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(district.id)} onBlur={() => setHoveredId(null)}
                  onClick={() => selectDistrict(district)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDistrict(district); } }}
                  initial={false} animate={{ y: active ? (reduceMotion ? 0 : -9) : 0, scale: active ? 1.025 : 1, opacity: selected ? (focused ? 1 : .25) : 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 21, duration: reduceMotion ? 0 : undefined }}
                  style={{ transformBox: "fill-box", transformOrigin: "center", filter: focused ? "url(#province-focus-glow)" : active ? "url(#province-boundary-glow)" : undefined }}
                  fill={active || focused ? "#2b7058" : "#245b4d"} stroke={active || focused ? "#e4f1d2" : "#c3e4c0"} strokeWidth={active || focused ? 2.5 : 1.15} vectorEffect="non-scaling-stroke" className="cursor-pointer outline-none focus-visible:stroke-[#eac984]" />;
              })}
            </g>
            {hovered && !selected && <g pointerEvents="none" transform={`translate(${hovered.bounds.cx},${hovered.bounds.cy})`}>
              <rect x="-62" y="-20" width="124" height="24" rx="12" fill="#17241d" fillOpacity=".96" stroke="#b6e4bd" strokeOpacity=".8" />
              <text x="0" y="-4" textAnchor="middle" fill="#eff3e9" fontSize="11" fontWeight="700">{hovered.name}</text>
            </g>}
          </svg>

          {selected?.places.map((place, index) => {
            const verticalOffset = index % 2 === 0 ? "-translate-y-[125%]" : "translate-y-[15%]";
            return <Link key={place.sourceId} href={`/locations/${encodeURIComponent(place.name)}?governorate=${encodeURIComponent(province.name)}&district=${encodeURIComponent(selected.name)}`} onMouseEnter={() => setHoveredPlace(place.name)} onMouseLeave={() => setHoveredPlace(null)} onFocus={() => setHoveredPlace(place.name)} onBlur={() => setHoveredPlace(null)} title={`تصفية الأرشيف حسب ${place.name}`} className={`absolute z-20 inline-flex -translate-x-1/2 ${verticalOffset} items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-[#17241d]/85 px-2 py-1 text-[10px] font-medium text-[#f4f1df] shadow-sm backdrop-blur-sm transition hover:z-30 hover:scale-110 hover:border-[#f1d697] hover:text-[#f1d697] sm:text-xs`} style={{ left: `${((place.x - minX) / viewWidth) * 100}%`, top: `${((place.y - minY) / viewHeight) * 100}%` }}>
              <span className="size-2 shrink-0 rounded-full border border-[#f5edcf] bg-[#d6b36d] shadow-[0_0_0_3px_rgba(214,179,109,.18),0_0_12px_3px_rgba(214,179,109,.48)]" />{place.name}
            </Link>;
          })}
        </div>

        <div className="mx-auto mt-4 flex max-w-[1040px] items-center justify-between gap-4 text-[10px] text-[#7f9383]">
          <span>{selected ? `${selected.places.length} مدينة وبلدة تظهر داخل المنطقة المحددة` : "الفواصل المضيئة تحدد حدود المناطق"}</span>
          <span>المصدر الإداري: OpenSyria؛ الحدود المرجعية: geoBoundaries، 2017</span>
        </div>
        <CaseArchiveList governorate={province.name} district={selected?.name} />
      </section>
      <footer className="border-t border-white/10 px-5 py-6 text-center text-[10px] leading-6 text-[#7f9383]">تظهر المدن والبلدات عند توفر إحداثيات تقع ضمن المنطقة الإدارية. بعض الحدود مرجعية تاريخية وفق بيانات geoBoundaries لعام 2017.</footer>
    </main>
  );
}
