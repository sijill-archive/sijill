"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ArchiveMediaGallery } from "@/components/archive-media-gallery";
import type { ArchiveMedia } from "@/lib/archive-media";

type CaseRecord = { id: string; title: string; event_type: string; description: string; governorate: string; district_name: string; city: string; location_description: string | null; event_date: string | null; approximate_date: string | null; media: ArchiveMedia | null };
type PersonFile = { id: string; title: string; description: string; governorate: string | null; district_name: string | null; city: string | null };

export default function PublicCasePage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [files, setFiles] = useState<PersonFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !id) { setLoading(false); setMissing(true); return; }
    const load = async () => {
      const { data } = await supabase.from("sijill_cases").select("id,title,event_type,description,governorate,district_name,city,location_description,event_date,approximate_date,media").eq("id", id).eq("status", "published").maybeSingle();
      if (!active) return;
      if (!data) { setMissing(true); setLoading(false); return; }
      setRecord(data as CaseRecord);
      const result = await supabase.from("sijill_person_files").select("id,title,description,governorate,district_name,city").eq("case_id", id).eq("status", "published").order("title", { ascending: true });
      if (active) { setFiles((result.data ?? []) as PersonFile[]); setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [id]);

  return <main dir="rtl" className="min-h-screen bg-[#131916] px-5 py-8 text-[#f1f1e9] sm:px-8"><div className="mx-auto max-w-4xl"><header className="flex items-center justify-between"><Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo tone="white" className="h-12 w-12" /></Link><Link href="/" className="text-sm text-[#c0dec2] underline underline-offset-4">العودة إلى الأرشيف</Link></header>
    {loading ? <p className="py-24 text-center text-stone-400">جارٍ تحميل القضية المنشورة...</p> : missing || !record ? <section className="py-24 text-center"><h1 className="text-2xl font-semibold">القضية غير متاحة</h1><p className="mt-3 text-sm text-stone-400">قد تكون قيد المراجعة أو غير منشورة.</p></section> : <>
      <article className="archive-frame archive-frame--case mt-10 p-6 sm:p-9"><p className="text-xs text-[#b69a6d]">قضية موثقة في الأرشيف</p><h1 className="mt-3 text-3xl font-bold">{record.title}</h1><p className="mt-3 text-sm text-stone-400">{record.event_type} · {[record.governorate, record.district_name, record.city, record.location_description].filter(Boolean).join("، ")}</p><p className="mt-1 text-sm text-stone-500">{record.event_date ?? record.approximate_date ?? "التاريخ غير محدد"}</p><div className="mt-6 whitespace-pre-wrap border-t border-white/10 pt-6 text-sm leading-8 text-stone-200">{record.description}</div><ArchiveMediaGallery media={record.media} /><p className="mt-6 rounded-xl bg-black/15 p-4 text-xs leading-6 text-stone-400">هذا سجل توثيقي منشور بعد المراجعة. لا يُعد حكماً قضائياً، وتُعرض المعلومات المنسوبة إلى مصادرها وسياقها.</p></article>
      <section className="archive-frame archive-frame--file mt-7 p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-xs text-[#b69a6d]">الملفات المرتبطة بهذه القضية</p><h2 className="mt-2 text-xl font-semibold">أشخاص وردت أسماؤهم في سجلات القضية</h2></div><Link href={`/files/new?caseId=${record.id}`} className="rounded-xl bg-[#c0dec2] px-4 py-2.5 text-sm font-semibold text-[#14251d]">＋ إضافة ملف مرتبط</Link></div>
        {files.length === 0 ? <p className="py-8 text-sm text-stone-400">لا توجد ملفات أشخاص منشورة ومرتبطة بهذه القضية حتى الآن.</p> : <ul className="mt-4 space-y-3">{files.map((file) => <li key={file.id} className="archive-frame archive-frame--nested p-4"><Link href={`/files/${file.id}`} className="font-semibold text-[#e7d6ad] hover:text-white">📁 {file.title}</Link><p className="mt-1 text-xs text-stone-500">{[file.governorate, file.district_name, file.city].filter(Boolean).join("، ")}</p>{file.description && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">{file.description}</p>}</li>)}</ul>}
      </section>
    </>}
  </div></main>;
}
