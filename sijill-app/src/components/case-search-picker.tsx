"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { geography } from "@/lib/geography";

export type CaseOption = { id: string; title: string; aliases?: string[]; governorate?: string | null; district_name?: string | null; city?: string | null; event_date?: string | null; approximate_date?: string | null };
const pageSize = 20;
const fieldClass = "w-full rounded-xl border border-stone-300 bg-transparent px-3 py-3 text-sm dark:border-stone-700";
function details(item: CaseOption) {
  return [...new Set([item.governorate, item.district_name, item.city].filter(Boolean)), item.event_date || item.approximate_date].filter(Boolean).join(" · ");
}

export function CaseSearchPicker({ selected, onChange }: { selected: CaseOption[]; onChange: (items: CaseOption[]) => void }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [query, setQuery] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<CaseOption[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setItems([]); setHasMore(false);
    const timer = window.setTimeout(async () => {
      if (!supabase) { if (active) { setError("تعذر الاتصال. أعد تحميل الصفحة."); setLoading(false); } return; }
      const { data, error: searchError } = await supabase.rpc("search_sijill_cases", { p_query: query.trim(), p_governorate: governorate || null, p_offset: page * pageSize });
      if (!active) return;
      if (searchError) setError("تعذر تحميل القضايا. حاول مرة أخرى.");
      else { const rows = (data ?? []) as CaseOption[]; setItems(rows.slice(0, pageSize)); setHasMore(rows.length > pageSize); }
      setLoading(false);
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, governorate, page, retry, supabase]);

  const choose = (item: CaseOption) => onChange(selected.some((row) => row.id === item.id) ? selected.filter((row) => row.id !== item.id) : [...selected, item]);
  return <div className="space-y-3">
    {selected.length > 0 && <div className="space-y-2 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20"><p className="text-xs font-semibold">القضايا المختارة ({selected.length})</p>{selected.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><input type="hidden" name="caseIds" value={item.id}/><span>{item.title}<small className="block text-stone-500">{details(item)}</small></span><button type="button" onClick={() => choose(item)} className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-xs dark:border-stone-700" aria-label={`إزالة الربط مع ${item.title}`}>إزالة</button></div>)}</div>}
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr]"><label className="space-y-2 text-sm"><span>ابحث عن القضية</span><input type="search" value={query} maxLength={200} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="اسم القضية أو أحد أسمائها أو مكانها" className={fieldClass}/></label><label className="space-y-2 text-sm"><span>المحافظة</span><select value={governorate} onChange={(event) => { setGovernorate(event.target.value); setPage(0); }} className={fieldClass}><option value="">كل المحافظات</option>{geography.governorates.map((item) => <option key={item.slug} value={item.name}>{item.name}</option>)}</select></label></div>
    <p className="text-xs leading-6 text-stone-500">جرّب اسم المكان إذا اختلف اسم الحادثة. البحث يشمل الأسماء الأخرى التي سجّلها صاحب القضية. الربط اختياري، ويمكن اختيار أكثر من قضية.</p>
    <div className="max-h-80 overflow-y-auto rounded-xl border border-stone-300 p-2 dark:border-stone-700" aria-busy={loading}>
      {loading ? <p role="status" className="p-3 text-sm text-stone-500">جارٍ البحث…</p> : error ? <p role="alert" className="p-3 text-sm">{error} <button type="button" onClick={() => setRetry((value) => value + 1)} className="underline">إعادة المحاولة</button></p> : items.length === 0 ? <p role="status" className="p-3 text-sm text-stone-500">لا توجد قضايا منشورة مطابقة. جرّب كلمات أقل أو محافظة أخرى.</p> : items.map((item) => <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-3 text-sm hover:bg-stone-50 dark:hover:bg-stone-800"><input type="checkbox" checked={selected.some((row) => row.id === item.id)} onChange={() => choose(item)} className="mt-1 size-4 shrink-0 accent-[#194537]"/><span><strong className="font-medium">{item.title}</strong><small className="mt-1 block text-stone-500">{details(item)}</small>{!!item.aliases?.length && <small className="mt-1 block text-stone-500">يُعرف أيضًا بـ: {item.aliases.join("، ")}</small>}</span></label>)}
    </div>
    <div className="flex items-center justify-between gap-3 text-xs"><button type="button" disabled={loading || page === 0} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-stone-300 px-3 py-2 disabled:opacity-40 dark:border-stone-700">السابق</button><span aria-live="polite">الصفحة {page + 1}</span><button type="button" disabled={loading || !hasMore} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-stone-300 px-3 py-2 disabled:opacity-40 dark:border-stone-700">التالي</button></div>
  </div>;
}
