"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type CaseRow = { id: string; title: string; event_type: string; governorate: string; district_name: string; city: string; event_date: string | null; approximate_date: string | null };
type FileRow = { id: string; title: string; case_id: string | null; caseIds: string[] };

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
        const caseIds = rows.map((row) => row.id);
        const [linksResult, legacyResult] = await Promise.all([
          supabase.from("sijill_case_person_files").select("case_id,person_file_id").in("case_id", caseIds),
          supabase.from("sijill_person_files").select("id,title,case_id").eq("status", "published").in("case_id", caseIds),
        ]);
        const links = linksResult.data ?? [];
        const legacyFiles = (legacyResult.data ?? []) as Omit<FileRow, "caseIds">[];
        const fileIds = [...new Set([...links.map((link) => link.person_file_id), ...legacyFiles.map((file) => file.id)])];
        if (fileIds.length) {
          const filesResult = await supabase.from("sijill_person_files").select("id,title,case_id").eq("status", "published").in("id", fileIds).order("title", { ascending: true });
          childFiles = (filesResult.data ?? []).map((file) => ({ ...file, caseIds: [...new Set([...links.filter((link) => link.person_file_id === file.id).map((link) => link.case_id), ...(file.case_id ? [file.case_id] : [])])] })) as FileRow[];
        }
      }
      if (active) { setCases(rows); setFiles(childFiles); setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [governorate]);

  return <section className="mt-8 rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6" aria-labelledby="case-archive-heading">
    <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-xs text-[#b69a6d]">الأرشيف المنشور</p><h2 id="case-archive-heading" className="mt-2 text-xl font-semibold">القضايا والملفات المرتبطة</h2></div><span className="text-xs text-stone-500">{governorate ? `محافظة ${governorate}` : "كل المحافظات"}</span></div>
    {loading ? <p className="py-6 text-sm text-stone-500">جارٍ تحميل السجلات المنشورة...</p> : cases.length === 0 ? <p className="py-6 text-sm text-stone-500">لا توجد قضايا منشورة في هذا النطاق بعد.</p> : <ul className="space-y-3">{cases.map((item) => {
      const linked = files.filter((file) => file.caseIds.includes(item.id));
      return <li key={item.id} className="archive-frame archive-frame--case p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/cases/${item.id}`} className="text-base font-semibold text-[#e7d6ad] transition hover:text-white">{item.title}</Link><p className="mt-1 text-xs text-stone-400">{item.event_type} · {[item.governorate, item.district_name, item.city].filter(Boolean).join("، ")} · {item.event_date ?? item.approximate_date ?? "التاريخ غير محدد"}</p></div><Link href={`/cases/${item.id}`} className="text-xs text-stone-400 underline underline-offset-4">عرض القضية</Link></div>
        {linked.length > 0 ? <ul className="mr-4 mt-3 space-y-2 border-r border-[#a58c62]/40 pr-4">{linked.map((file) => <li key={file.id} className="archive-frame archive-frame--nested px-3 py-2"><Link href={`/files/${file.id}`} className="text-sm text-stone-200 transition hover:text-[#c0dec2]">📁 {file.title}</Link></li>)}</ul> : <p className="mr-4 mt-3 border-r border-white/10 pr-4 text-xs text-stone-500">لا توجد ملفات أشخاص مرتبطة منشورة بعد.</p>}
      </li>;
    })}</ul>}
  </section>;
}
