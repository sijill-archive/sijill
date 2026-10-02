import { createPublicSupabaseClient } from "@/lib/supabase/public";
import Link from "next/link";

export const dynamic = "force-dynamic";

const evidenceLabels: Record<number, string> = {
  1: "ادعاء غير مدعوم",
  2: "شهادة واحدة",
  3: "شهادات متعددة",
  4: "شهادات وصور داعمة",
  5: "شهادات ووثائق ومصادر داعمة",
};

const sourceLabels: Record<string, string> = {
  witness: "شهادة شاهد",
  human_rights_report: "تقرير حقوقي",
  news: "تقرير صحفي",
  official_document: "وثيقة رسمية",
  open_source: "مصدر مفتوح",
  archive: "أرشيف",
  interview: "مقابلة",
  other: "مصدر آخر",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

type SearchParams = Promise<{ q?: string; city?: string; governorate?: string; year?: string }>;

const cityGovernors: Record<string, string> = {
  "حلب": "حلب", "عفرين": "حلب", "منبج": "حلب", "الباب": "حلب",
  "الحسكة": "الحسكة", "القامشلي": "الحسكة", "رأس العين": "الحسكة", "المالكية": "الحسكة",
  "الرقة": "الرقة", "تل أبيض": "الرقة", "السويداء": "السويداء", "شهبا": "السويداء",
  "درعا": "درعا", "نوى": "درعا", "بصرى الشام": "درعا", "دير الزور": "دير الزور", "الميادين": "دير الزور", "البوكمال": "دير الزور",
  "حماة": "حماة", "السلمية": "حماة", "مصياف": "حماة", "حمص": "حمص", "تدمر": "حمص", "الرستن": "حمص",
  "إدلب": "إدلب", "معرة النعمان": "إدلب", "جسر الشغور": "إدلب", "اللاذقية": "اللاذقية", "جبلة": "اللاذقية", "القرداحة": "اللاذقية",
  "القنيطرة": "القنيطرة", "خان أرنبة": "القنيطرة", "دوما": "ريف دمشق", "داريا": "ريف دمشق", "النبك": "ريف دمشق",
  "طرطوس": "طرطوس", "بانياس": "طرطوس", "صافيتا": "طرطوس", "دمشق": "دمشق",
};

export default async function TestimoniesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const supabase = createPublicSupabaseClient();
  let testimonies: Array<{
    id: string;
    title: string;
    description: string;
    event_date: string;
    country: string;
    city: string;
    location_description: string;
    evidence_level: number;
    source_type: string;
  }> = [];
  let unavailable = !supabase;

  if (supabase) {
    const { data, error } = await supabase
      .from("testimonies")
      .select("id,title,description,event_date,country,city,location_description,evidence_level,source_type")
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      unavailable = true;
      console.error("Published testimonies query failed", error.code ?? "unknown");
    } else {
      const rows = data ?? [];
      testimonies = rows.filter((item) => {
        const q = (filters.q ?? "").trim().toLocaleLowerCase("ar");
        const searchMatch = !q || `${item.title} ${item.description} ${item.city}`.toLocaleLowerCase("ar").includes(q);
        const governorateMatch = !filters.governorate || cityGovernors[item.city] === filters.governorate || item.city === filters.governorate;
        const cityMatch = !filters.city || item.city === filters.city;
        const yearMatch = !filters.year || item.event_date?.startsWith(`${filters.year}-`);
        return searchMatch && governorateMatch && cityMatch && yearMatch;
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f7f2] dark:bg-[#151916]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="/" className="flex items-center gap-3 text-lg font-bold text-emerald-950 dark:text-stone-100">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-950 text-xl text-white dark:bg-emerald-200 dark:text-emerald-950">س</span> سِجِلّ
        </a>
        <a href="/" className="rounded-full bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 dark:bg-emerald-200 dark:text-emerald-950 dark:hover:bg-emerald-100">استكشف الخريطة</a>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
        <p className="text-xs font-semibold tracking-widest text-orange-700 dark:text-orange-400">الأرشيف المدني</p>
        <h1 className="mt-4 text-3xl font-bold text-emerald-950 dark:text-stone-50 sm:text-4xl">الشهادات المنشورة</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600 dark:text-stone-400">تُعرض هنا الشهادات التي وافق أصحابها على نشرها واجتازت المراجعة. تبقى الشهادة توثيقًا للمعلومة ولا تصدر حكمًا قضائيًا.</p>

        {(filters.q || filters.governorate || filters.city || filters.year) && <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-400"><span>نتائج التصفية:</span>{filters.q && <span className="rounded-full bg-stone-100 px-3 py-1 dark:bg-stone-800">{filters.q}</span>}{filters.governorate && <span className="rounded-full bg-stone-100 px-3 py-1 dark:bg-stone-800">{filters.governorate}</span>}{filters.city && <span className="rounded-full bg-stone-100 px-3 py-1 dark:bg-stone-800">{filters.city}</span>}{filters.year && <span className="rounded-full bg-stone-100 px-3 py-1 dark:bg-stone-800">{filters.year}</span>}<Link href="/testimonies" className="mr-2 text-emerald-800 underline dark:text-emerald-300">مسح الفلاتر</Link></div>}

        {unavailable ? (
          <div role="status" className="mt-10 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm leading-7 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            الأرشيف غير متاح الآن. قد لا تكون إعدادات Supabase مكتملة أو تعذر الاتصال؛ حاول مرة أخرى لاحقًا.
          </div>
        ) : testimonies.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-950 sm:p-12">
            <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-orange-100 text-xl text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">◷</span>
            <h2 className="mt-5 text-lg font-semibold text-stone-900 dark:text-stone-100">لا توجد شهادات منشورة بعد</h2>
            <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-400">تُراجع الشهادات قبل عرضها هنا. وستُضاف الشهادات الجديدة من داخل القضية أو ملف الشخص المرتبط بها.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {testimonies.map((testimony) => (
              <article key={testimony.id} className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950 sm:p-7">
                <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                  <span>{formatDate(testimony.event_date)}</span><span aria-hidden="true">·</span><span>{testimony.city}، {testimony.country}</span>
                </div>
                <h2 className="text-xl font-bold leading-8 text-stone-900 dark:text-stone-100">{testimony.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-stone-700 dark:text-stone-300">{testimony.description}</p>
                <p className="mt-4 border-r-2 border-orange-400 pr-3 text-xs leading-6 text-stone-500 dark:text-stone-400">الموقع: {testimony.location_description}</p>
                <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{evidenceLabels[testimony.evidence_level] ?? "مستوى توثيق غير محدد"}</span>
                  <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs text-stone-700 dark:bg-stone-900 dark:text-stone-300">المصدر: {sourceLabels[testimony.source_type] ?? "أخرى"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
