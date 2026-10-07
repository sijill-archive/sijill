"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type FileRecord = { id: string; title: string; description: string; case_id: string | null; governorate: string | null; district_name: string | null; city: string | null };
type LinkedCase = { id: string; title: string };

export default function PublicPersonFilePage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<FileRecord | null>(null);
  const [linkedCase, setLinkedCase] = useState<LinkedCase | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !id) { setLoading(false); return; }
    const load = async () => {
      const { data } = await supabase.from("sijill_person_files").select("id,title,description,case_id,governorate,district_name,city").eq("id", id).eq("status", "published").maybeSingle();
      if (!active) return;
      if (!data) { setLoading(false); return; }
      const file = data as FileRecord;
      setRecord(file);
      if (file.case_id) {
        const result = await supabase.from("sijill_cases").select("id,title").eq("id", file.case_id).eq("status", "published").maybeSingle();
        if (active && result.data) setLinkedCase(result.data as LinkedCase);
      }
      if (active) setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [id]);
  return <main dir="rtl" className="min-h-screen bg-[#131916] px-5 py-8 text-[#f1f1e9]"><div className="mx-auto max-w-3xl"><header className="flex items-center justify-between"><Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo tone="white" className="h-12 w-12" /></Link><Link href="/" className="text-sm text-[#c0dec2] underline underline-offset-4">العودة إلى الأرشيف</Link></header>{loading ? <p className="py-24 text-center text-stone-400">جارٍ تحميل الملف...</p> : !record ? <section className="py-24 text-center"><h1 className="text-2xl font-semibold">الملف غير متاح</h1><p className="mt-3 text-sm text-stone-400">قد يكون قيد المراجعة أو غير منشور.</p></section> : <article className="archive-frame archive-frame--file mt-10 p-6 sm:p-9"><p className="text-xs text-[#b69a6d]">ملف شخص منشور في الأرشيف</p><h1 className="mt-3 text-3xl font-bold">{record.title}</h1>{[record.governorate, record.district_name, record.city].some(Boolean) && <p className="mt-3 text-sm text-stone-400">{[record.governorate, record.district_name, record.city].filter(Boolean).join("، ")}</p>}<div className="mt-6 whitespace-pre-wrap border-t border-white/10 pt-6 text-sm leading-8 text-stone-200">{record.description || "لا توجد معلومات وصفية إضافية منشورة."}</div>{linkedCase && <p className="mt-6 rounded-xl border border-white/10 bg-black/10 p-4 text-sm">القضية المرتبطة: <Link href={`/cases/${linkedCase.id}`} className="font-semibold text-[#e7d6ad] underline underline-offset-4">{linkedCase.title}</Link></p>}<p className="mt-5 rounded-xl bg-black/15 p-4 text-xs leading-6 text-stone-400">المعلومات مادة توثيقية منسوبة إلى مقدم الملف ومصادره، ولا تمثل حكماً قضائياً أو إثباتاً قاطعاً للمسؤولية.</p></article>}</div></main>;
}
