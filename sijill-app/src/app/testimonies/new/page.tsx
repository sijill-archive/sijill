"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function NewTestimonyPage() {
  const router = useRouter();
  const [caseId, setCaseId] = useState<string | null>(null); const [fileId, setFileId] = useState<string | null>(null);
  const [paramsReady, setParamsReady] = useState(false);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [parentTitle, setParentTitle] = useState(""); const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  useEffect(() => { const params = new URLSearchParams(window.location.search); setCaseId(params.get("case_id")); setFileId(params.get("person_file_id")); setParamsReady(true); }, []);
  useEffect(() => {
    if (!paramsReady) return;
    if (!supabase || Boolean(caseId) === Boolean(fileId)) { setError("يجب فتح نموذج الشهادة من داخل قضية أو ملف منشور."); setReady(true); return; }
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace(`/account?mode=login&next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
      const table = caseId ? "sijill_cases" : "sijill_person_files"; const id = caseId ?? fileId;
      const { data: parent } = await supabase.from(table).select("title").eq("id", id).eq("status", "published").maybeSingle();
      if (!parent) setError("القضية أو الملف غير منشور، لذلك لا يمكن إضافة شهادة إليه."); else setParentTitle(parent.title);
      setReady(true);
    });
  }, [caseId, fileId, paramsReady, router, supabase]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase) return;
    const values = new FormData(event.currentTarget); const description = String(values.get("description") ?? "").trim();
    if (description.split(/\s+/).filter(Boolean).length < 20) { setError("اكتب الشهادة في 20 كلمة على الأقل، مع ذكر ما تعرفه ومصدره."); return; }
    setBusy(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("انتهت جلسة الدخول. سجّل الدخول ثم حاول مجدداً."); setBusy(false); return; }
    const { error: insertError } = await supabase.from("sijill_testimonies").insert({
      created_by: user.id, title: String(values.get("title") ?? "").trim(), description,
      event_date: String(values.get("event_date") ?? "") || null, country: "سوريا", city: String(values.get("city") ?? "").trim(),
      location_description: String(values.get("location") ?? "").trim(), evidence_level: Number(values.get("evidence_level") ?? 1),
      source_type: String(values.get("source_type") ?? "other"), position: String(values.get("position") ?? "supporting"),
      case_id: caseId, person_file_id: fileId, public_consent: values.get("public_consent") === "on", status: "submitted",
    });
    if (insertError) setError(insertError.code === "23505" ? "سبق أن أرسلت شهادة لهذا السجل من هذا الحساب. يسمح النظام بشهادة واحدة لكل حساب ولكل قضية أو ملف." : "تعذر إرسال الشهادة. تحقق من تطبيق تحديث قاعدة البيانات وحاول مجدداً.");
    else setDone(true);
    setBusy(false);
  };
  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#131916] text-stone-300">جارٍ التحقق من الحساب...</main>;
  return <main dir="rtl" className="min-h-screen bg-[#f8f7f2] px-5 py-10 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9]"><div className="mx-auto max-w-3xl"><Link href={caseId ? `/cases/${caseId}` : fileId ? `/files/${fileId}` : "/"} className="text-sm text-[#527764] underline">العودة إلى السجل</Link><h1 className="mt-7 text-3xl font-bold">إضافة شهادة</h1>{parentTitle && <p className="mt-2 text-sm text-stone-500">مرتبطة بـ: {parentTitle}</p>}{error && <p role="alert" className="mt-5 rounded-xl border border-rose-400 bg-rose-50 p-4 text-sm leading-7 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{error}</p>}{done ? <section className="mt-6 rounded-2xl border border-emerald-400 bg-emerald-50 p-6 leading-7 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">وصلت الشهادة إلى الإدارة للمراجعة. ستظهر بعد اعتمادها. <Link className="underline" href={`/workspace?tab=testimonies`}>عرض شهاداتي</Link></section> : !error && <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d] sm:p-7"><label className="block text-sm font-semibold">عنوان مختصر للشهادة<input required maxLength={180} name="title" className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700" placeholder="مثال: شهادة عن الاعتقال في حاجز..."/></label><label className="block text-sm font-semibold">نص الشهادة (20 كلمة على الأقل)<textarea required name="description" minLength={80} rows={8} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal leading-7 dark:border-stone-700" placeholder="اذكر الوقائع والتواريخ والأسماء وما شاهدته بنفسك، وميّز بوضوح ما نُقل إليك ومصدره."/></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">تاريخ الواقعة<input type="date" name="event_date" className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label><label className="text-sm font-semibold">المدينة<input required name="city" maxLength={120} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label></div><label className="block text-sm font-semibold">الموقع أو المكان<input name="location" maxLength={240} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">تصنيف الشهادة<select name="position" className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"><option value="supporting">مؤيدة</option><option value="opposing">معارضة</option></select></label><label className="text-sm font-semibold">نوع المصدر<select name="source_type" className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700">{[["witness","شهادة شاهد"],["human_rights_report","تقرير حقوقي"],["news","تقرير صحفي"],["official_document","وثيقة رسمية"],["open_source","مصدر مفتوح"],["archive","أرشيف"],["interview","مقابلة"],["other","مصدر آخر"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">مستوى التوثيق<select name="evidence_level" defaultValue="1" className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700">{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} من 5</option>)}</select></label></div><label className="flex gap-3 rounded-xl bg-stone-50 p-4 text-sm leading-6 dark:bg-stone-900"><input required type="checkbox" name="public_consent" className="mt-1 size-4 accent-[#194537]"/><span>أوافق على نشر الشهادة بعد مراجعتها، وأفهم أن البيانات ستعرض ضمن الأرشيف.</span></label><button disabled={busy} className="w-full rounded-xl bg-[#194537] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ الإرسال…" : "إرسال الشهادة للمراجعة"}</button><p className="text-xs leading-6 text-stone-500">يسمح بحساب واحد بشهادة واحدة لكل قضية أو ملف. لا تُنشر الشهادة قبل مراجعتها.</p></form>}</div></main>;
}
