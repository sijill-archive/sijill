"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import mapData from "@/data/syria-governorates.json";
import localityPoints from "@/data/syria-locality-points.json";
import { ContributionButtons } from "@/components/site-menu";

type Governorate = (typeof mapData.features)[number];

const places: Record<string, string[]> = {
  "حلب": ["حلب", "عفرين", "منبج", "الباب", "جرابلس", "عين العرب"],
  "الحسكة": ["الحسكة", "القامشلي", "رأس العين", "المالكية"],
  "الرقة": ["الرقة", "تل أبيض"],
  "السويداء": ["السويداء", "شهبا"],
  "درعا": ["درعا", "نوى", "بصرى الشام"],
  "دير الزور": ["دير الزور", "الميادين", "البوكمال"],
  "حماة": ["حماة", "السلمية", "مصياف"],
  "حمص": ["حمص", "تدمر", "الرستن"],
  "إدلب": ["إدلب", "معرة النعمان", "جسر الشغور"],
  "اللاذقية": ["اللاذقية", "جبلة", "القرداحة"],
  "القنيطرة": ["القنيطرة", "خان أرنبة"],
  "ريف دمشق": ["دوما", "داريا", "النبك", "الزبداني", "يبرود", "قدسيا"],
  "طرطوس": ["طرطوس", "بانياس", "صافيتا", "الدريكيش", "الشيخ بدر"],
  "دمشق": ["دمشق", "المزة", "باب توما", "القابون", "الميدان"],
};

const linkToCity = (city: string) => `/locations/${encodeURIComponent(city)}`;

function focusViewBox(governorate: Governorate) {
  const { bounds, name } = governorate;
  const shapeScale = name === "دمشق" ? 2.875 : 1;
  // Fill most of the map viewport with the selected governorate so the zoom is clear.
  const zoom = Math.min(12, (520 * 0.92) / (bounds.width * shapeScale), (440 * 0.88) / (bounds.height * shapeScale));
  const width = 520 / zoom;
  const height = 440 / zoom;
  return `${bounds.cx - width / 2} ${bounds.cy - height / 2} ${width} ${height}`;
}

function SyrianMap({ selected, onChoose }: { selected: Governorate | null; onChoose: (governorate: Governorate) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const hoveredGovernorate = mapData.features.find((feature) => feature.name === hovered);
  const viewBoxText = selected ? focusViewBox(selected) : "0 120 520 440";
  const viewBox = viewBoxText.split(" ").map(Number);
  const [viewX, viewY, viewWidth, viewHeight] = viewBox;
  const selectedPlaces = selected ? localityPoints.items[selected.name as keyof typeof localityPoints.items] ?? [] : [];
  const selectedScale = selected?.name === "دمشق" ? 2.875 : 1;
  return (
    <div className="relative aspect-[13/11] w-full max-w-[763px]">
    <svg viewBox={viewBoxText} role="img" aria-labelledby="syria-map-title" className={`absolute inset-0 h-full w-full ${selected ? "overflow-hidden" : "overflow-visible"}`}>
      <title id="syria-map-title">خريطة سوريا التفاعلية حسب المحافظات</title>
      <defs>
        <filter id="province-glow" x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="boundary-glow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.68  0 0 0 0 0.88  0 0 0 0 0.72  0 0 0 .9 0" />
        </filter>
        <filter id="focus-halo" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="map-shadow" x="-30%" y="-20%" width="160%" height="170%">
          <feDropShadow dx="0" dy="17" stdDeviation="15" floodColor="#182b22" floodOpacity=".24" />
        </filter>
      </defs>
      <g filter="url(#boundary-glow)" opacity={selected ? 0.25 : 0.92} pointerEvents="none">
        {mapData.features.map((feature) => <path key={`glow-${feature.iso}`} d={feature.d} fill="none" stroke="#b6e4bd" strokeWidth="4" vectorEffect="non-scaling-stroke" />)}
      </g>
      <g filter="url(#map-shadow)">
        {[...mapData.features].sort((a, b) => Number(a.name === "دمشق") - Number(b.name === "دمشق")).map((feature) => {
          const active = hovered === feature.name;
          const focused = selected?.iso === feature.iso;
          const baseScale = feature.name === "دمشق" ? 2.875 : 1;
          return (
            <motion.path
              key={feature.iso}
              d={feature.d}
              role="button"
              tabIndex={0}
              aria-label={`استعرض مناطق محافظة ${feature.name}`}
              aria-pressed={false}
              onMouseEnter={() => setHovered(feature.name)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(feature.name)}
              onBlur={() => setHovered(null)}
              onClick={() => onChoose(feature)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(feature); } }}
              initial={false}
              animate={{ y: active ? (reduceMotion ? 0 : -11) : 0, scale: active ? baseScale * 1.04 : baseScale, opacity: selected ? (focused ? 1 : 0.25) : hovered && !active ? 0.74 : 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, duration: reduceMotion ? 0 : undefined }}
              style={{ transformBox: "fill-box", transformOrigin: "center", filter: focused ? "url(#focus-halo)" : active ? "url(#province-glow)" : undefined }}
              className="province-shape cursor-pointer outline-none focus-visible:stroke-[#ffcc78]"
              fill={active ? "#2a7860" : "#245b4d"}
              stroke={active ? "#e9f2cf" : "#c9e9c8"}
              strokeWidth={active ? 2.3 : 1.15}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>
      <AnimatePresence>
        {hoveredGovernorate && <g key={hoveredGovernorate.iso} pointerEvents="none" transform={`translate(${hoveredGovernorate.bounds.cx}, ${hoveredGovernorate.bounds.cy - 12})`}>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <rect x="-37" y="-32" width="74" height="23" rx="11.5" fill="#fffdf7" stroke="#d8dfd4" strokeWidth="1" />
            <text x="0" y="-16" textAnchor="middle" fill="#194537" fontSize="12" fontWeight="700">{hoveredGovernorate.name}</text>
          </motion.g>
        </g>}
      </AnimatePresence>
    </svg>
    {selected && selectedPlaces.map((place, index) => {
      const x = selected.bounds.cx + (place.x - selected.bounds.cx) * selectedScale;
      const y = selected.bounds.cy + (place.y - selected.bounds.cy) * selectedScale;
      const labelY = index % 2 === 0 ? "-translate-y-[125%]" : "translate-y-[15%]";
      return <Link key={place.recordId} href={linkToCity(place.name)} title={`ملفات ${place.name}`} className={`absolute z-20 inline-flex -translate-x-1/2 ${labelY} items-center gap-1 rounded-full border border-[#c7d8c8] bg-[#fffdf7]/95 px-2 py-1 text-[10px] font-semibold text-[#173b30] shadow-sm transition hover:scale-105 hover:border-[#8daa91] dark:border-stone-600 dark:bg-[#1a211d]/95 dark:text-[#e3efdd]`} style={{ left: `${((x - viewX) / viewWidth) * 100}%`, top: `${((y - viewY) / viewHeight) * 100}%` }}>
        <span className="size-2 shrink-0 rounded-full border border-white bg-[#d9a953] shadow-[0_0_0_3px_rgba(217,169,83,.22)] dark:border-stone-900" />{place.name}
      </Link>;
    })}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [selected, setSelected] = useState<Governorate | null>(null);
  const [query, setQuery] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [year, setYear] = useState("");
  useEffect(() => {
    const restoreMap = () => {
      const iso = window.history.state?.sijillGovernorate as string | undefined;
      setSelected(mapData.features.find((feature) => feature.iso === iso) ?? null);
    };
    restoreMap();
    window.addEventListener("popstate", restoreMap);
    return () => window.removeEventListener("popstate", restoreMap);
  }, []);
  const chooseGovernorate = (feature: Governorate) => {
    if (feature.english === "Aleppo") {
      router.push("/governorates/aleppo");
      return;
    }
    setSelected(feature);
    const state = { ...(window.history.state ?? {}), sijillGovernorate: feature.iso };
    window.history.pushState(state, "", `${window.location.pathname}${window.location.search}#map-${feature.iso}`);
  };
  const showFullMap = () => {
    setSelected(null);
    const state = { ...(window.history.state ?? {}), sijillGovernorate: null };
    window.history.replaceState(state, "", `${window.location.pathname}${window.location.search}`);
  };
  const regions = useMemo(() => [...mapData.features].map((feature) => feature.name).sort((a,b) => a.localeCompare(b, "ar")), []);
  const availableCities = governorate ? places[governorate] ?? [] : [...new Set(Object.values(places).flat())].sort((a,b) => a.localeCompare(b, "ar"));

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f7f2] text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9]">
      <div className="fixed inset-x-0 top-0 z-40 flex min-h-10 items-center justify-center bg-[#173b30] px-4 py-2 text-center text-xs leading-5 text-[#f3f2e8] sm:text-sm">
        <span>سِجِلّ — منصة لحفظ وتوثيق الذاكرة السورية</span>
      </div>

      <header className="relative mx-auto flex max-w-7xl items-center justify-center px-5 pb-5 pt-[4.75rem] sm:px-8 lg:px-12">
        <Link href="/" className="text-center" aria-label="سِجِلّ، الصفحة الرئيسية">
          <Image src="/logo.png" alt="سِجِلّ" width={150} height={84} priority className="mx-auto h-auto w-48 sm:w-64" />
          <span className="mt-2 block text-xs tracking-[.28em] text-[#986d3e] sm:text-sm">منصة توثيق الذاكرة السورية</span>
          <span className="mt-2 hidden text-xs text-stone-500 dark:text-stone-400 sm:block">منصة لحفظ وتوثيق الشهادات والأحداث والأدلة التاريخية</span>
          <span className="mx-auto mt-3 hidden max-w-3xl text-sm leading-8 text-stone-600 dark:text-stone-300 sm:block sm:text-base">
            يَا أَيُّهَا الَّذِينَ آمَنُوا كُونُوا قَوَّامِينَ لِلَّهِ شُهَدَاءَ بِالْقِسْطِ ۖ وَلَا يَجْرِمَنَّكُمْ شَنَآنُ قَوْمٍ عَلَىٰ أَلَّا تَعْدِلُوا ۚ
            <br />
            اعْدِلُوا هُوَ أَقْرَبُ لِلتَّقْوَىٰ ۖ وَاتَّقُوا اللَّهَ ۚ إِنَّ اللَّهَ خَبِيرٌ بِمَا تَعْمَلُونَ
          </span>
        </Link>
      </header>

      <section aria-label="خريطة سوريا التفاعلية" className="relative mx-auto flex min-h-0 max-w-7xl flex-col items-center justify-start px-5 pb-8 pt-0 sm:px-8">
        <div className="map-aura pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[760px] sm:w-[760px]" />
        <div className="map-ground pointer-events-none absolute bottom-16 left-1/2 -z-0 h-16 w-[58%] max-w-[426px] -translate-x-1/2 rounded-[100%] blur-2xl" />
        <div className="relative z-10 flex w-full max-w-[867px] items-center justify-center">
          <SyrianMap selected={selected} onChoose={chooseGovernorate} />
        </div>
        {selected && <div className="relative z-10 mt-4"><ContributionButtons /></div>}
        <div className="relative z-10 mt-0 text-center"><p className="font-serif text-xl text-[#194537] dark:text-[#c0dec2]">ذاكرةٌ تحفظها الأماكن</p><p className="mt-2 text-xs text-stone-500 dark:text-stone-400">{selected ? `مناطق بارزة في محافظة ${selected.name}` : "مرّر المؤشر على محافظة لعرض اسمها، واضغط عليها لتكبيرها"}</p></div>
        <AnimatePresence>
          {selected && <motion.div key={selected.iso} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="relative z-10 mt-5 w-full max-w-[640px] border-y border-[#dce2d8] py-4 dark:border-stone-700">
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-[#194537] dark:text-[#c0dec2]">أبرز المدن والمناطق — {selected.name}</h2><button type="button" onClick={showFullMap} className="shrink-0 rounded-full px-3 py-1.5 text-xs text-stone-600 underline underline-offset-2 hover:text-[#194537] dark:text-stone-300">رجوع للخريطة الكاملة</button></div>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">{(places[selected.name] ?? [selected.name]).map((place) => <Link key={place} href={linkToCity(place)} className="border-b border-[#b9cbbd] px-1 py-1 text-sm text-[#285744] transition hover:border-[#285744] hover:text-[#173b30] dark:border-stone-600 dark:text-[#d0e4cd]">{place}</Link>)}</div>
          </motion.div>}
        </AnimatePresence>
        <p className="absolute bottom-3 px-4 text-center text-[10px] leading-5 text-stone-400">حدود المحافظات الإدارية مرجعية، مستندة إلى geoBoundaries (تمثيل 2017)، ولا تعرض خطوط السيطرة.</p>
      </section>

      <section aria-labelledby="featured-heading" className="mx-auto max-w-7xl px-5 pb-12 pt-9 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between gap-5 border-b border-[#dfe2d9] pb-5 dark:border-stone-800"><div><p className="text-[10px] tracking-[.2em] text-[#98704b]">أرشيف سِجِلّ</p><h2 id="featured-heading" className="mt-2 text-2xl font-semibold">الملفات الأعلى توثيقاً</h2></div><span className="text-xs text-stone-500">أعلى ١٠ ملفات</span></div>
        <div className="py-12 text-center"><span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full border border-[#d8ded4] text-xl text-[#537768] dark:border-stone-700">⌕</span><h3 className="mt-4 text-sm font-semibold">لا توجد ملفات منشورة بعد</h3><p className="mx-auto mt-2 max-w-md text-xs leading-6 text-stone-500 dark:text-stone-400">ستظهر الملفات بعد نشر سجلات الأرشيف ومراجعتها. سيُعرض مستوى التوثيق وعدد المواد المرتبطة بكل ملف دون إصدار أحكام.</p></div>
      </section>

      <section aria-labelledby="search-heading" className="border-y border-[#e1e2db] bg-[#f0f0e9] dark:border-stone-800 dark:bg-[#1a211d]">
        <div className="mx-auto max-w-7xl px-5 py-11 sm:px-8 lg:px-12">
          <p className="text-[10px] tracking-[.2em] text-[#98704b]">البحث في الأرشيف</p><h2 id="search-heading" className="mt-2 text-2xl font-semibold">ابحث عن ملف</h2>
          <form action="/testimonies" method="get" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_.65fr_auto]">
            <label className="sr-only" htmlFor="q">البحث بالاسم</label><input id="q" name="q" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اكتب الاسم أو كلمة من عنوان الملف" className="rounded-xl border border-[#d6dbd3] bg-white px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            <label className="sr-only" htmlFor="governorate">المحافظة</label><select id="governorate" name="governorate" value={governorate} onChange={(event) => { setGovernorate(event.target.value); setCity(""); }} className="rounded-xl border border-[#d6dbd3] bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815] dark:text-stone-200"><option value="">كل المحافظات</option>{regions.map((region) => <option key={region} value={region}>{region}</option>)}</select>
            <label className="sr-only" htmlFor="city">المدينة أو المنطقة</label><select id="city" name="city" value={city} onChange={(event) => setCity(event.target.value)} className="rounded-xl border border-[#d6dbd3] bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-[#527764] disabled:opacity-60 dark:border-stone-700 dark:bg-[#121815] dark:text-stone-200" disabled={availableCities.length === 0}><option value="">كل المدن والمناطق</option>{availableCities.map((name) => <option key={name} value={name}>{name}</option>)}</select>
            <label className="sr-only" htmlFor="year">السنة</label><select id="year" name="year" value={year} onChange={(event) => setYear(event.target.value)} className="rounded-xl border border-[#d6dbd3] bg-white px-4 py-3 text-sm text-stone-700 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815] dark:text-stone-200"><option value="">كل السنوات</option>{Array.from({ length: 77 }, (_, i) => 2026 - i).map((y) => <option key={y} value={y}>{y}</option>)}</select>
            <button type="submit" className="rounded-xl bg-[#194537] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#255c49]">بحث</button>
          </form>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-stone-500 dark:text-stone-400 sm:flex-row sm:px-8 lg:px-12">
        <Link href="/" className="font-semibold text-[#194537] dark:text-[#c0dec2]">سِجِلّ</Link><div className="flex flex-wrap justify-center gap-5"><span>سياسة الخصوصية</span><Link href="/terms" className="transition hover:text-[#194537] dark:hover:text-[#c0dec2]">الشروط والأحكام</Link><span>معلومات التواصل</span></div><span dir="ltr">Sijill © 2026</span>
      </footer>
      <p className="mx-auto max-w-7xl px-5 pb-4 text-center text-[10px] leading-5 text-stone-400 sm:px-8 lg:px-12">الحدود الإدارية: <a className="underline underline-offset-2 hover:text-stone-600" href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a> (2017). مواقع المدن: <a className="underline underline-offset-2 hover:text-stone-600" href="https://opensyria.org/datasets/geography" target="_blank" rel="noreferrer">بيانات OpenSyria الجغرافية، الإصدار 0.1.5</a>.</p>
    </main>
  );
}
