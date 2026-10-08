"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type CaseRow = { id: string; title: string; event_type: string; governorate: string | null; district_name: string | null; city: string | null; event_date: string | null; approximate_date: string | null };
type FileRow = { id: string; title: string; case_id: string | null; caseIds: string[] };

export function CaseArchiveList({ governorate, district, city }: { governorate?: string; district?: string; city?: string }) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setUnavailable(true); setLoading(false); return; }
    const load = async () => {
      let casesQuery = supabase.from("sijill_cases").select("id,title,event_type,governorate,district_name,city,event_date,approximate_date").eq("status", "published");
      let filesQuery = supabase.from("sijill_person_files").select("id,title,case_id").eq("status", "published");
      if (governorate) {
        casesQuery = casesQuery.eq("governorate", governorate);
        filesQuery = filesQuery.eq("governorate", governorate);
      }
      if (district) {
        casesQuery = casesQuery.eq("district_name", district);
        filesQuery = filesQuery.eq("district_name", district);
      }
      if (city) {
        casesQuery = casesQuery.eq("city", city);
        filesQuery = filesQuery.eq("city", city);
      }
      const [casesResult, directFilesResult] = await Promise.all([
        casesQuery.order("title", { ascending: true }).limit(500),
        filesQuery.order("title", { ascending: true }).limit(500),
      ]);
      if (casesResult.error || directFilesResult.error) {
        if (active) { setUnavailable(true); setLoading(false); }
        return;
      }
      const rows = (casesResult.data ?? []) as CaseRow[];
      const directFiles = (directFilesResult.data ?? []) as Omit<FileRow, "caseIds">[];
      const [linksResult, legacyResult] = rows.length ? await Promise.all([
        supabase.from("sijill_case_person_files").select("case_id,person_file_id").in("case_id", rows.map((row) => row.id)),
        supabase.from("sijill_person_files").select("id,title,case_id").eq("status", "published").in("case_id", rows.map((row) => row.id)),
      ]) : [{ data: [], error: null }, { data: [], error: null }];
      const links = linksResult;
      const linksByFile = new Map<string, string[]>();
      for (const link of links.data ?? []) {
        linksByFile.set(link.person_file_id, [...(linksByFile.get(link.person_file_id) ?? []), link.case_id]);
      }
      const directFileIds = new Set(directFiles.map((file) => file.id));
      const legacyFiles = ((legacyResult.data ?? []) as Omit<FileRow, "caseIds">[]).filter((file) => !directFileIds.has(file.id));
      const relatedIds = [...new Set((links.data ?? []).map((link) => link.person_file_id))].filter((id) => !directFileIds.has(id) && !legacyFiles.some((file) => file.id === id));
      let linkedFiles: Omit<FileRow, "caseIds">[] = legacyFiles;
      if (relatedIds.length) {
        const related = await supabase.from("sijill_person_files").select("id,title,case_id").eq("status", "published").in("id", relatedIds);
        linkedFiles = (related.data ?? []) as Omit<FileRow, "caseIds">[];
      }
      const allFiles = [...directFiles, ...linkedFiles];
      const childFiles: FileRow[] = allFiles.map((file) => ({
        ...file,
        caseIds: [...new Set([...(linksByFile.get(file.id) ?? []), ...(file.case_id ? [file.case_id] : [])])],
      }));
      if (active) { setCases(rows); setFiles(childFiles.sort((a, b) => a.title.localeCompare(b.title, "ar"))); setUnavailable(false); setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [governorate, district, city]);

  return <section className="mt-8 rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6" aria-labelledby="case-archive-heading">
    <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-xs text-[#b69a6d]">الأرشيف المنشور</p><h2 id="case-archive-heading" className="mt-2 text-xl font-semibold">القضايا والملفات</h2></div><span className="text-xs text-stone-500">{[governorate && `محافظة ${governorate}`, district && `منطقة ${district}`, city].filter(Boolean).join(" · ") || "كل المحافظات"}</span></div>
    {loading ? <p className="py-6 text-sm text-stone-500">جارٍ تحميل السجلات المنشورة...</p> : unavailable ? <p role="status" className="py-6 text-sm text-amber-300">تعذر تحميل الأرشيف الآن. تحقق من اتصال Supabase ثم أعد المحاولة.</p> : cases.length === 0 && files.length === 0 ? <p className="py-6 text-sm text-stone-500">لا توجد قضايا أو ملفات منشورة في هذا النطاق بعد.</p> : <>
      {cases.length > 0 && <><h3 className="mt-5 text-sm font-semibold text-stone-300">القضايا</h3><ul className="mt-3 space-y-3">{cases.map((item) => {
      const linked = files.filter((file) => file.caseIds.includes(item.id));
      return <li key={item.id} className="archive-frame archive-frame--case p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link href={`/cases/${item.id}`} className="text-base font-semibold text-[#e7d6ad] transition hover:text-white">{item.title}</Link><p className="mt-1 text-xs text-stone-400">{item.event_type} · {[item.governorate, item.district_name, item.city].filter(Boolean).join("، ")} · {item.event_date ?? item.approximate_date ?? "التاريخ غير محدد"}</p></div><Link href={`/cases/${item.id}`} className="text-xs text-stone-400 underline underline-offset-4">عرض القضية</Link></div>
        {linked.length > 0 ? <ul className="mr-4 mt-3 space-y-2 border-r border-[#a58c62]/40 pr-4">{linked.map((file) => <li key={file.id} className="archive-frame archive-frame--nested px-3 py-2"><Link href={`/files/${file.id}`} className="text-sm text-stone-200 transition hover:text-[#c0dec2]">📁 {file.title}</Link></li>)}</ul> : <p className="mr-4 mt-3 border-r border-white/10 pr-4 text-xs text-stone-500">لا توجد ملفات أشخاص مرتبطة منشورة بعد.</p>}
      </li>;
      })}</ul></>}
      {files.filter((file) => !file.caseIds.some((caseId) => cases.some((item) => item.id === caseId))).length > 0 && <><h3 className="mt-6 text-sm font-semibold text-stone-300">الملفات المستقلة</h3><ul className="mt-3 grid gap-3 sm:grid-cols-2">{files.filter((file) => !file.caseIds.some((caseId) => cases.some((item) => item.id === caseId))).map((file) => <li key={file.id} className="archive-frame archive-frame--nested px-4 py-3"><Link href={`/files/${file.id}`} className="text-sm font-semibold text-stone-200 hover:text-[#c0dec2]">📁 {file.title}</Link></li>)}</ul></>}
    </>}
  </section>;
}
