"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { ArchiveMediaGallery, ArchiveMediaHero } from "@/components/archive-media-gallery";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { ArchiveMedia } from "@/lib/archive-media";

type FileRecord = { id: string; title: string; description: string; case_id: string | null; governorate: string | null; district_name: string | null; city: string | null; media: ArchiveMedia | null };
type LinkedCase = { id: string; title: string };
const summaryLength = 260;

export default function PublicPersonFilePage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<FileRecord | null>(null);
  const [linkedCases, setLinkedCases] = useState<LinkedCase[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !id) { setLoading(false); return; }
    const load = async () => {
      const { data } = await supabase.from("sijill_person_files").select("id,title,description,case_id,governorate,district_name,city,media").eq("id", id).eq("status", "published").maybeSingle();
      if (!active) return;
      if (!data) { setLoading(false); return; }
      const file = data as FileRecord;
      setRecord(file);
      const { data: links } = await supabase.from("sijill_case_person_files").select("case_id").eq("person_file_id", id);
      const caseIds = [...new Set([...(links ?? []).map((link) => link.case_id), file.case_id].filter((caseId): caseId is string => Boolean(caseId)))];
      if (caseIds.length) {
        const result = await supabase.from("sijill_cases").select("id,title").in("id", caseIds).eq("status", "published").order("title", { ascending: true });
        if (active) setLinkedCases((result.data ?? []) as LinkedCase[]);
      }
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [id]);

  const description = record?.description.trim() ?? "";
  const shortDescription = description.length > summaryLength ? `${description.slice(0, summaryLength).trim()}…` : description;

  return <main dir="rtl" className="min-h-screen bg-[#131916] px-5 py-8 text-[#f1f1e9]"><div className="mx-auto max-w-3xl"><header className="flex items-center justify-between"><Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo tone="white" className="h-12 w-12" /></Link><Link href="/" className="text-sm text-[#c0dec2] underline underline-offset-4">العودة إلى الأرشيف</Link></header>
    {loading ? <p className="py-24 text-center text-stone-400">جارٍ تحميل الملف...</p> : !record ? <section className="py-24 text-center"><h1 className="text-2xl font-semibold">الملف غير متاح</h1><p className="mt-3 text-sm text-stone-400">قد يكون قيد المراجعة أو غير منشور.</p></section> : <article className="archive-frame archive-frame--file mt-10 p-6 sm:p-9">
      <p className="text-right text-xs text-[#b69a6d]">ملف شخص منشور في الأرشيف</p>
      <h1 className="mt-4 border-b border-white/10 pb-6 text-center text-3xl font-bold sm:text-4xl">{record.title}</h1>
      <ArchiveMediaHero media={record.media} />

      <section className="mt-7 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold">القضايا المرتبطة بهذا الشخص</h2>
        {linkedCases.length ? <ul className="mt-4 space-y-3">{linkedCases.map((item) => <li key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><Link href={`/cases/${item.id}`} className="font-semibold text-[#e7d6ad] underline underline-offset-4">{item.title}</Link></li>)}</ul> : <p className="mt-3 text-sm text-stone-400">لا توجد قضايا منشورة مرتبطة بهذا الملف.</p>}
      </section>

      <section className="mt-7 border-t border-white/10 pt-6">
        <h2 className="text-lg font-semibold">المعلومات</h2>
        {[record.governorate, record.district_name, record.city].some(Boolean) && <p className="mt-2 text-sm text-stone-400">{[record.governorate, record.district_name, record.city].filter(Boolean).join("، ")}</p>}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-stone-200">{shortDescription || "لا توجد معلومات وصفية إضافية منشورة."}</p>
        {description.length > summaryLength && <details className="mt-3 rounded-xl border border-white/10 bg-black/10 p-4"><summary className="cursor-pointer font-semibold text-[#c0dec2]">المزيد</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-stone-300">{description.slice(summaryLength).trim()}</p></details>}
      </section>

      <ArchiveMediaGallery media={record.media} excludeFirstImage />
      <p className="mt-6 rounded-xl bg-black/15 p-4 text-xs leading-6 text-stone-400">المعلومات مادة توثيقية منسوبة إلى مقدم الملف ومصادره، ولا تمثل حكماً قضائياً أو إثباتاً قاطعاً للمسؤولية.</p>
    </article>}
  </div></main>;
}
