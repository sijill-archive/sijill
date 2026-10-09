"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { canEditContribution, editDeadline } from "@/lib/edit-window";

type Editable = { id: string; title: string; description: string; created_at: string; published_at?: string | null; status: string; event_date?: string | null; event_type?: string; position?: string };
const tableFor: Record<string, string> = { case: "sijill_cases", file: "sijill_person_files", testimony: "sijill_testimonies" };

export default function EditContributionPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<Editable | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [position, setPosition] = useState("supporting");
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    if (!supabase || !tableFor[kind]) { setError("نوع المساهمة غير صالح."); return; }
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace("/account?mode=login&next=%2Fworkspace"); return; }
      const fields = kind === "testimony" ? "id,title,description,created_at,published_at,status,event_date,position" : kind === "case" ? "id,title,description,created_at,published_at,status,event_date,event_type" : "id,title,description,created_at,published_at,status";
      const { data: result, error: queryError } = await supabase.from(tableFor[kind]).select(fields).eq("id", id).eq("created_by", data.user.id).maybeSingle();
      const row = result as unknown as Editable | null;
      if (queryError || !row) setError("لم نعثر على مساهمة تابعة لحسابك.");
      else if (!canEditContribution(row.status, row.published_at, row.created_at)) setError("انتهت مهلة التعديل، وهي ١٥ يوماً من تاريخ النشر.");
      else { setRecord(row as Editable); setEventDate(row.event_date ?? ""); setPosition(row.position ?? "supporting"); }
      setReady(true);
    });
  }, [id, kind, router, supabase]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !record) return;
    const values = new FormData(event.currentTarget); const title = String(values.get("title") ?? "").trim(); const description = String(values.get("description") ?? "").trim();
    if (kind === "testimony" && description.split(/\s+/).filter(Boolean).length < 20) { setError("يجب ألا يقل نص الشهادة عن 20 كلمة."); return; }
    setBusy(true); setError(""); setNotice("");
    const update: Record<string, string | null> = { title, description };
    if (kind === "case") update.event_date = eventDate || null;
    if (kind === "testimony") { update.event_date = eventDate || null; update.position = position; }
    const { error: saveError } = await supabase.from(tableFor[kind]).update(update).eq("id", record.id);
    if (saveError) setError(saveError.message.includes("edit period") ? "انتهت مهلة التعديل، وهي ١٥ يوماً من تاريخ النشر." : "تعذر حفظ التعديل. أعد تحميل الصفحة ثم حاول مجدداً.");
    else { setNotice("تم حفظ التعديل."); setRecord({ ...record, title, description, event_date: eventDate || null, position }); }
    setBusy(false);
  };

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#131916] text-sm text-stone-300">جارٍ تحميل المساهمة...</main>;
  return <main dir="rtl" className="min-h-screen bg-[#f8f7f2] px-5 py-10 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9]"><div className="mx-auto max-w-3xl"><Link href={`/workspace?tab=${kind === "case" ? "cases" : kind === "file" ? "files" : "testimonies"}`} className="text-sm text-[#527764] underline">العودة إلى مساهماتي</Link><h1 className="mt-7 text-3xl font-bold">تعديل {kind === "case" ? "القضية" : kind === "file" ? "الملف" : "الشهادة"}</h1>{error && <p role="alert" className="mt-5 rounded-xl border border-rose-400 bg-rose-50 p-4 text-sm leading-7 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{error}</p>}{notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{notice}</p>}{record && <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d]"><label className="block text-sm font-semibold">العنوان<input required minLength={2} maxLength={180} name="title" defaultValue={record.title} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label>{kind === "testimony" && <><label className="block text-sm font-semibold">تاريخ الحادثة<input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label><label className="block text-sm font-semibold">نوع الشهادة<select value={position} onChange={(e) => setPosition(e.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"><option value="supporting">مؤيدة</option><option value="opposing">معارضة</option></select></label></>}{kind === "case" && <label className="block text-sm font-semibold">تاريخ الحدث<input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label>}<label className="block text-sm font-semibold">{kind === "testimony" ? "نص الشهادة (20 كلمة على الأقل)" : "المعلومات"}<textarea required name="description" rows={8} defaultValue={record.description} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal leading-7 dark:border-stone-700"/></label><p className="text-xs leading-6 text-stone-500">{record.published_at || record.status === "published" || record.status === "archived" ? <>يمكن تعديل هذه المساهمة حتى {new Intl.DateTimeFormat("ar", { dateStyle: "long" }).format(editDeadline(record.published_at, record.created_at))}. تبدأ مهلة الـ١٥ يوماً من النشر.</> : "يمكنك تعديل هذه المساهمة قبل نشرها. تبدأ مهلة الـ١٥ يوماً عند نشرها."}</p><button disabled={busy} className="rounded-xl bg-[#194537] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ الحفظ…" : "حفظ التعديلات"}</button></form>}</div></main>;
}
