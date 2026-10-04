"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useState } from "react";
import aleppoMap from "@/data/aleppo-explorer.json";
import { ContributionButtons } from "@/components/site-menu";
import { StatisticsStrip } from "@/components/statistics-strip";

type District = (typeof aleppoMap.districts)[number];

function districtViewBox(district: District) {
  const bounds = district.bounds;
  const aspect = 780 / 620;
  // Keep every locality label in frame, including places near administrative
  // boundaries and the few cross-boundary assignments in the archive list.
  const xs = [bounds.x, bounds.x + bounds.width, ...district.places.map((place) => place.x)];
  const ys = [bounds.y, bounds.y + bounds.height, ...district.places.map((place) => place.y)];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rawWidth = Math.max(maxX - minX, 1);
  const rawHeight = Math.max(maxY - minY, 1);
  const width = Math.max(rawWidth * 1.45, rawHeight * aspect * 1.45);
  const height = width / aspect;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;
}

export function AleppoExplorer() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const selected = aleppoMap.districts.find((district) => district.id === selectedId) ?? null;
  const hovered = aleppoMap.districts.find((district) => district.id === hoveredId) ?? null;
  const viewBox = (selected ? districtViewBox(selected) : aleppoMap.viewBox).split(" ").map(Number);
  const [minX, minY, viewWidth, viewHeight] = viewBox;

  useEffect(() => {
    const restoreLayer = () => {
      const id = window.history.state?.aleppoDistrict as string | undefined;
      const district = aleppoMap.districts.find((item) => item.id === id);
      setSelectedId(district?.id ?? null);
    };
    window.addEventListener("popstate", restoreLayer);
    return () => window.removeEventListener("popstate", restoreLayer);
  }, []);

  const selectDistrict = (district: District) => {
    setSelectedId(district.id);
    window.history.pushState(
      { ...(window.history.state ?? {}), aleppoDistrict: district.id },
      "",
      `${window.location.pathname}${window.location.search}#${district.id}`,
    );
  };

  const showDistricts = () => {
    setSelectedId(null);
    window.history.replaceState(
      { ...(window.history.state ?? {}), aleppoDistrict: null },
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
          {selected ? <button type="button" onClick={showDistricts} className="hover:text-white">حلب</button> : <span className="text-[#f1f2e9]">حلب</span>}
          {selected && <><span aria-hidden="true">/</span><span className="text-[#f1f2e9]">{selected.name}</span></>}
          {selected && hoveredPlace && <><span aria-hidden="true">/</span><span className="text-[#f1f2e9]">{hoveredPlace}</span></>}
        </nav>

        <div className="mb-8 flex flex-col gap-5 border-y border-white/10 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] tracking-[.24em] text-[#c9a76b]">استكشف حسب المكان</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">محافظة حلب</h1><p className="mt-2 text-xs leading-6 text-[#a5b3a7]">{selected ? `اختر مدينة أو بلدة من منطقة ${selected.name}` : "اختر منطقة من الخريطة لاستعراض المدن والبلدات التابعة لها"}</p></div>
          <StatisticsStrip
            tone="dark"
            className="w-full sm:min-w-[530px] lg:w-auto"
            items={[{ label: "المناطق", value: 10 }, { label: "المدن", value: 35 }, { label: "الملفات", value: 0 }, { label: "الشهادات", value: 0 }]}
          />
        </div>
        <div className="mb-7 flex justify-start"><ContributionButtons /></div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs text-[#95a89b]">{selected ? `المدن والبلدات في ${selected.name}` : "مناطق محافظة حلب"}</p>
          {selected && <button type="button" onClick={showDistricts} className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-[#d2e5d0] transition hover:border-[#d2e5d0] hover:bg-white/5">العودة إلى المناطق</button>}
        </div>

        <div className="relative mx-auto aspect-[39/31] w-full max-w-[1040px]">
          <div className="pointer-events-none absolute inset-[10%] rounded-full bg-[#548566]/10 blur-[80px]" />
          <svg viewBox={selected ? districtViewBox(selected) : aleppoMap.viewBox} role="img" aria-labelledby="aleppo-map-title" className="absolute inset-0 h-full w-full overflow-hidden">
            <title id="aleppo-map-title">خريطة تفاعلية لمناطق محافظة حلب</title>
            <defs>
              <filter id="aleppo-boundary-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="aleppo-focus-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="aleppo-map-shadow" x="-30%" y="-25%" width="160%" height="170%"><feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#000" floodOpacity=".55"/></filter>
            </defs>
            <g filter="url(#aleppo-boundary-glow)" opacity={selected ? .25 : .95} pointerEvents="none">
              {aleppoMap.districts.map((district) => <path key={`glow-${district.id}`} d={district.d} fill="none" stroke="#b6e4bd" strokeWidth="3.5" vectorEffect="non-scaling-stroke" />)}
            </g>
            <g filter="url(#aleppo-map-shadow)">
              {aleppoMap.districts.map((district) => {
                const active = hoveredId === district.id;
                const focused = selectedId === district.id;
                return <motion.path key={district.id} d={district.d} role="button" tabIndex={0} aria-label={`استعرض ${district.name}`} aria-pressed={focused}
                  onMouseEnter={() => setHoveredId(district.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setHoveredId(district.id)} onBlur={() => setHoveredId(null)}
                  onClick={() => selectDistrict(district)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectDistrict(district); } }}
                  initial={false} animate={{ y: active ? (reduceMotion ? 0 : -9) : 0, scale: active ? 1.025 : 1, opacity: selected ? (focused ? 1 : .25) : 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 21, duration: reduceMotion ? 0 : undefined }}
                  style={{ transformBox: "fill-box", transformOrigin: "center", filter: focused ? "url(#aleppo-focus-glow)" : active ? "url(#aleppo-boundary-glow)" : undefined }}
                  fill={active || focused ? "#2b7058" : "#245b4d"} stroke={active || focused ? "#e4f1d2" : "#c3e4c0"} strokeWidth={active || focused ? 2.5 : 1.15} vectorEffect="non-scaling-stroke" className="cursor-pointer outline-none focus-visible:stroke-[#eac984]" />;
              })}
            </g>
            {hovered && <g pointerEvents="none" transform={`translate(${hovered.bounds.cx},${hovered.bounds.cy})`}>
              <rect x="-54" y="-20" width="108" height="24" rx="12" fill="#17241d" fillOpacity=".93" stroke="#b6e4bd" strokeOpacity=".75" />
              <text x="0" y="-4" textAnchor="middle" fill="#eff3e9" fontSize="11" fontWeight="700">{hovered.name}</text>
            </g>}
          </svg>

          {selected?.places.map((place, index) => {
            const verticalOffset = index % 2 === 0 ? "-translate-y-[125%]" : "translate-y-[15%]";
            return <Link key={place.slug} href={`/locations/${encodeURIComponent(place.name)}`} onMouseEnter={() => setHoveredPlace(place.name)} onMouseLeave={() => setHoveredPlace(null)} onFocus={() => setHoveredPlace(place.name)} onBlur={() => setHoveredPlace(null)} title={`تصفية الأرشيف حسب ${place.name}`} className={`absolute z-20 inline-flex -translate-x-1/2 ${verticalOffset} items-center gap-1.5 whitespace-nowrap text-[10px] font-medium text-[#f4f1df] drop-shadow-[0_1px_3px_rgba(0,0,0,.95)] transition hover:scale-110 hover:text-[#f1d697] sm:text-xs`} style={{ left: `${((place.x - minX) / viewWidth) * 100}%`, top: `${((place.y - minY) / viewHeight) * 100}%` }}>
              <span className="size-2 rounded-full border border-[#f5edcf] bg-[#d6b36d] shadow-[0_0_0_3px_rgba(214,179,109,.18),0_0_12px_3px_rgba(214,179,109,.48)]" />{place.name}
            </Link>;
          })}
        </div>

        <div className="mx-auto mt-4 flex max-w-[1040px] items-center justify-between gap-4 text-[10px] text-[#7f9383]">
          <span>{selected ? `${selected.places.length} مدن وبلدات معروضة على الخريطة` : "الفواصل المضيئة تحدد حدود المناطق"}</span>
          <span>حدود إدارية مرجعية — 2017</span>
        </div>
      </section>
      <footer className="border-t border-white/10 px-5 py-6 text-center text-[10px] text-[#7f9383]">المناطق الإدارية مستندة إلى geoBoundaries؛ المناطق الفرعية معروضة للتنقل داخل الأرشيف.</footer>
    </main>
  );
}
