"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type CaseRow = { id: string; title: string; event_type: string; governorate: string; district_name: string; city: string; event_date: string | null; approximate_date: string | null };
type FileRow = { id: string; title: string; case_id: string | null };

export function CaseArchiveList({ governorate }: { governorate?: string }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setLoading(false); return; }
    const load = async () => {
      let query = supabase.from("sijill_cases").select("id,title,event_type,governorate,district_name,city,event_date,approximate_date").eq("status", "published");
      if (governorate) query = query.eq("governorate", governorate);
      const { data } = await query.order("title", { ascending: true }).limit(100);
      const rows = (data ?? []) as CaseRow[];
      let childFiles: FileRow[] = [];
      if (rows.length) {
        const result = await supabase.from("sijill_person_files").select("id,title,case_id").eq("status", "published").in("case_id", rows.map((row) => row.id)).order("title", { ascending: true });
        childFiles = (result.data ?? []) as FileRow[];
      }
      if (active) { setCases(rows); setFiles(childFiles); setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [governorate]);

  return <section className="mt-8 rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6" aria-labelledby="case-archive-heading">
    <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-xs text-[#b69a6d]">الأرشيف المنشور</p><h2 id="case-archive-heading" className="mt-2 text-xl font-semibold">القضايا والملفات المرتبطة</h2></div><span className="text-xs text-stone-500">{governorate ? `محافظة ${governorate}` : "كل المحافظات"}</span></div>
    {loading ? <p className="py-6 text-sm text-stone-500">جارٍ تحميل السجلات المنشورة...</p> : cases.length === 0 ? <p className="py-6 text-sm text-stone-500">لا توجد قضايا منشورة في هذا النطاق بعد.</p> : <ul className="divide-y divide-white/10">{cases.map((item) => {
      const linked = files.filter((file) => file.case_id === item.id);
      return <li key={item.id} className="py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/cases/${item.id}`} className="text-base font-semibold text-[#e7d6ad] transition hover:text-white">{item.title}</Link><p className="mt-1 text-xs text-stone-400">{item.event_type} · {[item.governorate, item.district_name, item.city].filter(Boolean).join("، ")} · {item.event_date ?? item.approximate_date ?? "التاريخ غير محدد"}</p></div><Link href={`/cases/${item.id}`} className="text-xs text-stone-400 underline underline-offset-4">عرض القضية</Link></div>
        {linked.length > 0 ? <ul className="mr-4 mt-3 space-y-2 border-r border-[#a58c62]/40 pr-4">{linked.map((file) => <li key={file.id}><Link href={`/files/${file.id}`} className="text-sm text-stone-200 transition hover:text-[#c0dec2]">📁 {file.title}</Link></li>)}</ul> : <p className="mr-4 mt-3 border-r border-white/10 pr-4 text-xs text-stone-500">لا توجد ملفات أشخاص مرتبطة منشورة بعد.</p>}
      </li>;
    })}</ul>}
  </section>;
}
