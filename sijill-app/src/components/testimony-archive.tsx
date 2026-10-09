"use client";

import { ContributorLink } from "@/components/contributor-link";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import Link from "next/link";

type Testimony = {
  id: string;
  title: string;
  description: string;
  event_date: string | null;
  city: string;
  location_description: string;
  evidence_level: number;
  source_type: string;
  created_at: string;
  created_by: string | null;
};

type Side = "supporting" | "opposing";
type Collection = { items: Testimony[]; total: number; loading: boolean; error: boolean };
const pageSize = 20;
const initialCollection: Collection = { items: [], total: 0, loading: false, error: false };

const testimonyKinds: Record<string, string> = {
  witness: "شهادة شاهد",
  human_rights_report: "تقرير حقوقي",
  news: "تقرير صحفي",
  official_document: "وثيقة رسمية",
  open_source: "مصدر مفتوح",
  archive: "أرشيف",
  interview: "مقابلة",
  other: "مصدر آخر",
};

function formatDate(value: string | null) {
  if (!value) return "التاريخ غير محدد";
  return new Intl.DateTimeFormat("ar", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

export function TestimonyArchive({ parentType, parentId }: { parentType: "case" | "person_file"; parentId: string }) {
  const [collections, setCollections] = useState<Record<Side, Collection>>({ supporting: initialCollection, opposing: initialCollection });
  const [authors, setAuthors] = useState<Record<string, string>>({});

  const loadPage = useCallback(async (side: Side, offset: number, replace = false) => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setCollections((current) => ({ ...current, [side]: { ...current[side], loading: false, error: true } }));
      return;
    }

    setCollections((current) => ({ ...current, [side]: { ...current[side], loading: true, error: false } }));
    const parentColumn = parentType === "case" ? "case_id" : "person_file_id";
    const query = supabase.from("sijill_testimonies").select("id,title,description,event_date,city,location_description,evidence_level,source_type,created_at,created_by", { count: offset === 0 ? "exact" : undefined })
      .eq(parentColumn, parentId).eq("status", "published").eq("public_consent", true).eq("position", side)
      .order("event_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
    const { data, count, error } = await query;
    const authorIds = [...new Set((data ?? []).map((item) => item.created_by).filter((id): id is string => Boolean(id)))];
    if (authorIds.length) {
      const { data: profiles } = await supabase.from("sijill_public_profiles").select("user_id,display_name").in("user_id", authorIds);
      if (profiles) setAuthors((current) => ({ ...current, ...Object.fromEntries(profiles.map((profile) => [profile.user_id, profile.display_name])) }));
    }
    setCollections((current) => ({
      ...current,
      [side]: {
        items: error ? current[side].items : replace ? (data ?? []) as Testimony[] : [...current[side].items, ...((data ?? []) as Testimony[])],
        total: count ?? current[side].total,
        loading: false,
        error: Boolean(error),
      },
    }));
  }, [parentId, parentType]);

  useEffect(() => {
    setCollections({ supporting: initialCollection, opposing: initialCollection });
  }, [parentId, parentType]);

  const panel = (side: Side, label: string, tone: string) => {
    const collection = collections[side];
    return <details key={side} className="archive-frame archive-frame--nested group">
      <summary onClick={(event) => {
        if (collection.items.length === 0 && !collection.loading && !collection.error) void loadPage(side, 0, true);
        if (collection.error) { event.preventDefault(); void loadPage(side, 0, true); }
      }} className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 marker:hidden sm:px-5">
        <span className="flex items-center gap-3"><span className={`size-2 rounded-full ${tone}`} /><span className="font-semibold">{label}</span><span className="rounded-full bg-white/8 px-2.5 py-1 text-xs tabular-nums text-stone-300">{collection.total}</span></span>
        <span aria-hidden="true" className="text-sm text-[#c0dec2] group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-white/10 px-3 pb-3 sm:px-4">
        {collection.error ? <p className="py-5 text-sm leading-7 text-amber-200">تعذر تحميل الشهادات. تأكد من تطبيق تحديث قاعدة البيانات ثم أعد المحاولة.</p>
          : collection.items.length === 0 && !collection.loading ? <p className="py-5 text-sm text-stone-400">لا توجد شهادات منشورة في هذا القسم حتى الآن.</p>
          : <div className="space-y-2 pt-3">{collection.items.map((item) => <details key={item.id} className="archive-file-tab">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden"><span className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="text-lg">▤</span><span className="truncate font-semibold">{item.title}</span></span><span className="shrink-0 text-xs text-stone-700">⌄</span></summary>
            <div className="border-t border-black/10 px-4 py-4 text-sm leading-7 text-stone-200">
              <p className="text-xs text-[#d5c293]">{formatDate(item.event_date)} · {[item.city, item.location_description].filter(Boolean).join("، ") || "الموقع غير محدد"}</p>
              <p className="mt-3 whitespace-pre-wrap">{item.description}</p>
              <p className="mt-3 text-xs text-stone-400">مقدم الشهادة: <ContributorLink userId={item.created_by} name={authors[item.created_by ?? ""]}/></p>
              <p className="mt-3 border-t border-white/10 pt-3 text-xs text-stone-400">المصدر: {testimonyKinds[item.source_type] ?? "مصدر آخر"} · مستوى التوثيق: {item.evidence_level} من 5</p>
              <p className="mt-2 text-[11px] leading-6 text-stone-500">هذا سجل توثيقي منسوب إلى مقدم الشهادة ومصدرها، ولا يمثل حكماً قضائياً.</p>
            </div>
          </details>)}</div>}
        {collection.items.length < collection.total && <button type="button" disabled={collection.loading} onClick={() => void loadPage(side, collection.items.length)} className="mt-3 w-full rounded-lg border border-white/10 px-4 py-2.5 text-xs text-stone-300 hover:bg-white/5 disabled:opacity-50">{collection.loading ? "جارٍ تحميل الشهادات…" : "تحميل المزيد"}</button>}
        {collection.loading && collection.items.length === 0 && <p className="py-5 text-sm text-stone-400">جارٍ تحميل الشهادات…</p>}
      </div>
    </details>;
  };

  return <section className="mt-6 space-y-3" aria-label="سجل الشهادات">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs text-[#b69a6d]">السجلات والشهادات المرتبطة</p><h2 className="mt-1 text-xl font-semibold">الشهادات</h2></div><Link href={`/testimonies/new?${parentType === "case" ? "case_id" : "person_file_id"}=${encodeURIComponent(parentId)}`} className="rounded-lg bg-[#c0dec2] px-3 py-2 text-xs font-semibold text-[#14251d]">＋ إضافة شهادة</Link></div>
    {panel("supporting", "الشهادات المؤيدة", "bg-emerald-400")}
    {panel("opposing", "الشهادات المعارضة", "bg-rose-400")}
  </section>;
}
