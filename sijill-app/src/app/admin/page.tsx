"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Activity = { id: number; actor_id: string | null; record_type: string; record_id: string; action: string; changed_fields: string[]; happened_at: string };
type VerificationRequest = { id: string; subject_type: string; request_type: string; details: string; status: string; created_at: string };
type CaseSubmission = { id: string; title: string; event_type: string; description: string; country: string; governorate: string; district_name: string; city: string; location_description: string | null; event_date: string | null; approximate_date: string | null; created_at: string };
type DashboardData = {
  totals: { cases: number; files: number; testimonies: number; articles: number };
  pending: { cases: number; files: number; testimonies: number; requests: number };
  activity: Activity[];
  requests: VerificationRequest[];
  pendingCases: CaseSubmission[];
};

const emptyData: DashboardData = {
  totals: { cases: 0, files: 0, testimonies: 0, articles: 0 },
  pending: { cases: 0, files: 0, testimonies: 0, requests: 0 },
  activity: [],
  requests: [],
  pendingCases: [],
};

const actionLabels: Record<string, string> = { created: "إنشاء", updated: "تعديل", deleted: "حذف" };
const subjectLabels: Record<string, string> = { case: "قضية", person_file: "ملف", testimony: "شهادة", article: "مقال" };
const requestLabels: Record<string, string> = { verify: "طلب توثيق", correction: "طلب تصحيح", challenge: "اعتراض" };
const dateFormatter = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

export default function AdminDashboardPage() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [databaseMissing, setDatabaseMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [caseActionId, setCaseActionId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setDatabaseMissing(true); setLoading(false); return; }
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      const { data: roleRecord } = await supabase.from("sijill_user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const owner = roleRecord?.role === "owner";
      if (active) setIsOwner(owner);

      const [caseTotal, fileTotal, testimonyTotal, articleTotal, casePending, filePending, testimonyPending, requestPending, requestRows, caseRows, activityRows] = await Promise.all([
        supabase.from("sijill_cases").select("id", { count: "exact", head: true }),
        supabase.from("sijill_person_files").select("id", { count: "exact", head: true }),
        supabase.from("sijill_testimonies").select("id", { count: "exact", head: true }),
        supabase.from("sijill_articles").select("id", { count: "exact", head: true }),
        supabase.from("sijill_cases").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("sijill_person_files").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("sijill_testimonies").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("sijill_verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("sijill_verification_requests").select("id,subject_type,request_type,details,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("sijill_cases").select("id,title,event_type,description,country,governorate,district_name,city,location_description,event_date,approximate_date,created_at").eq("status", "submitted").order("created_at", { ascending: false }).limit(20),
        owner ? supabase.from("sijill_activity_log").select("id,actor_id,record_type,record_id,action,changed_fields,happened_at").order("happened_at", { ascending: false }).limit(8) : Promise.resolve({ data: [], error: null }),
      ]);

      if (!active) return;
      const queryErrors = [caseTotal, fileTotal, testimonyTotal, articleTotal, casePending, filePending, testimonyPending, requestPending, requestRows, caseRows, activityRows].filter((result) => result.error);
      if (queryErrors.length) {
        const missingTable = queryErrors.some((result) => result.error?.code === "PGRST205" || result.error?.code === "42P01");
        setDatabaseMissing(missingTable);
        setLoadError(!missingTable);
      } else {
        setDatabaseMissing(false);
        setLoadError(false);
        setData({
          totals: { cases: caseTotal.count ?? 0, files: fileTotal.count ?? 0, testimonies: testimonyTotal.count ?? 0, articles: articleTotal.count ?? 0 },
          pending: { cases: casePending.count ?? 0, files: filePending.count ?? 0, testimonies: testimonyPending.count ?? 0, requests: requestPending.count ?? 0 },
          requests: (requestRows.data ?? []) as VerificationRequest[],
          pendingCases: (caseRows.data ?? []) as CaseSubmission[],
          activity: (activityRows.data ?? []) as Activity[],
        });
      }
      setLoading(false);
    };

    void loadDashboard();
    return () => { active = false; };
  }, []);

  const decideCase = async (submission: CaseSubmission, decision: "published" | "rejected") => {
    if (!isOwner || caseActionId) return;
    const actionLabel = decision === "published" ? "نشر هذه القضية للزوار" : "رفض هذه القضية";
    if (!window.confirm(`هل تريد ${actionLabel}؟`)) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    setCaseActionId(submission.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadError(true);
      setCaseActionId(null);
      return;
    }
    const update = decision === "published"
      ? { status: "published", published_at: new Date().toISOString(), published_by: user.id }
      : { status: "rejected" };
    const { data: updated, error } = await supabase.from("sijill_cases").update(update).eq("id", submission.id).eq("status", "submitted").select("id").maybeSingle();
    if (error || !updated) {
      setLoadError(true);
    } else {
      setData((current) => ({
        ...current,
        pending: { ...current.pending, cases: Math.max(0, current.pending.cases - 1) },
        pendingCases: current.pendingCases.filter((item) => item.id !== submission.id),
      }));
    }
    setCaseActionId(null);
  };

  const total = Object.values(data.totals).reduce((sum, value) => sum + value, 0);
  const pendingSubmissions = data.pending.cases + data.pending.files + data.pending.testimonies;

  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs tracking-[.18em] text-[#b69a6d]">ملخص الأرشيف</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">لوحة التحكم</h1><p className="mt-2 text-sm text-stone-400">متابعة المحتوى وطلبات التوثيق ونشاط المنصة.</p></div>
      <Link href="/" className="w-fit rounded-xl border border-white/15 px-4 py-2.5 text-sm text-stone-300 hover:bg-white/5">فتح الموقع ↗</Link>
    </header>

    {databaseMissing && <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-4 text-sm leading-7 text-amber-100"><strong>قاعدة الإدارة لم تُجهّز بعد.</strong> طبّق الترحيل الموجود في <code dir="ltr">supabase/migrations</code> من صفحة SQL Editor في Supabase، ثم أضف دور المالك كما يوضح <code dir="ltr">supabase/README.md</code>.</div>}
    {loadError && <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm leading-7 text-rose-100">تعذر تحميل بعض إحصاءات الإدارة. تحقق من اتصال Supabase وسياسات الوصول ثم أعد تحميل الصفحة.</div>}

    <section aria-label="إحصائيات الموقع" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        { label: "إجمالي السجلات", value: total, hint: "قضايا وملفات وشهادات ومقالات", icon: "▦" },
        { label: "القضايا والأحداث", value: data.totals.cases, hint: `${data.pending.cases} قيد المراجعة`, icon: "◈" },
        { label: "ملفات الأشخاص", value: data.totals.files, hint: `${data.pending.files} قيد المراجعة`, icon: "▤" },
        { label: "الشهادات", value: data.totals.testimonies, hint: `${data.pending.testimonies} قيد المراجعة`, icon: "☷" },
        { label: "طلبات التوثيق", value: data.pending.requests, hint: "تحتاج متابعة", icon: "✓" },
      ].map((item) => <article key={item.label} className="rounded-2xl border border-white/10 bg-[#17211c] p-5">
        <div className="flex items-center justify-between"><span className="text-sm text-stone-400">{item.label}</span><span className="grid size-9 place-items-center rounded-xl bg-[#273c31] text-lg text-[#c0dec2]">{item.icon}</span></div>
        <p className="mt-5 text-3xl font-semibold tabular-nums">{loading ? "—" : item.value}</p><p className="mt-2 text-xs text-stone-500">{item.hint}</p>
      </article>)}
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <section id="verification" className="rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#b69a6d]">متابعة المراجعة</p><h2 className="mt-2 text-xl font-semibold">طلبات التوثيق والمحتوى الجديد</h2></div><span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">{data.pending.requests + pendingSubmissions} بانتظار الإجراء</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["طلبات التوثيق", data.pending.requests],
            ["القضايا المرسلة", data.pending.cases],
            ["الملفات المرسلة", data.pending.files],
            ["الشهادات المرسلة", data.pending.testimonies],
          ].map(([label, count]) => <div key={label} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 px-4 py-3"><span className="text-sm text-stone-300">{label}</span><strong className="text-lg tabular-nums">{loading ? "—" : count}</strong></div>)}
        </div>
        <div className="mt-5 border-t border-white/10 pt-4">
          {loading ? <p className="text-sm text-stone-500">جارٍ تحميل الطلبات...</p> : data.requests.length === 0 ? <p className="text-sm text-stone-500">لا توجد طلبات توثيق تنتظر المراجعة.</p> : <ul className="divide-y divide-white/8">{data.requests.map((request) => <li key={request.id} className="flex items-start justify-between gap-4 py-3"><div><p className="text-sm font-medium">{requestLabels[request.request_type] ?? "طلب جديد"} · {subjectLabels[request.subject_type] ?? "سجل"}</p>{request.details && <p className="mt-1 line-clamp-2 text-xs leading-6 text-stone-400">{request.details}</p>}</div><time className="shrink-0 text-[10px] text-stone-500" dateTime={request.created_at}>{dateFormatter.format(new Date(request.created_at))}</time></li>)}</ul>}
        </div>
      </section>

      <section id="articles" className="rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6">
        <p className="text-xs text-[#b69a6d]">مساحات العمل</p><h2 className="mt-2 text-xl font-semibold">أقسام لوحة الإدارة</h2>
        <div className="mt-5 grid gap-3">
          <ModuleCard title="المقالات" description={`${data.totals.articles} مقال محفوظ`} state="يبدأ بعد تجهيز محرر المقالات" />
          {isOwner && <>
            <ModuleCard title="مراسلات المشتركين" description="إرسال رسائل للمسجلين في المنصة" state="يتطلب ربط خدمة البريد" />
            <ModuleCard title="الإشعارات العامة" description="نشر تنبيه يظهر لمستخدمي الموقع" state="سيكون للمالك فقط" />
          </>}
        </div>
        <div className="mt-5 rounded-xl border border-[#a58c62]/20 bg-[#8e7448]/10 p-4 text-xs leading-6 text-stone-300"><strong className="text-[#e1c995]">مراجعة الذكاء الاصطناعي غير مفعّلة بعد.</strong> لذلك لم يُضف زر نشر للمحررين؛ قاعدة البيانات لن تسمح بنشر محتواهم قبل ربط المراجعة فعلياً.</div>
      </section>
    </div>

    <section id="case-review" className="rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs text-[#b69a6d]">مراجعة المالك</p><h2 className="mt-2 text-xl font-semibold">القضايا المرسلة للمراجعة</h2><p className="mt-1 text-xs leading-6 text-stone-500">تظهر هنا القضايا المحفوظة بحالة «قيد المراجعة». نشر القضية يجعلها متاحة للزوار.</p></div>
        <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">{loading ? "—" : data.pending.cases} قيد المراجعة</span>
      </div>
      {loading ? <p className="mt-5 text-sm text-stone-500">جارٍ تحميل القضايا...</p> : data.pendingCases.length === 0 ? <p className="mt-5 rounded-xl border border-white/8 bg-black/10 p-4 text-sm text-stone-400">لا توجد قضايا جديدة للمراجعة. ستظهر القضية بعد إرسالها من نموذج الإضافة.</p> : <div className="mt-5 space-y-4">{data.pendingCases.map((submission) => <article key={submission.id} className="rounded-xl border border-white/10 bg-black/10 p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h3 className="text-lg font-semibold">{submission.title}</h3><p className="mt-1 text-xs text-stone-400">{submission.event_type} · {[submission.country, submission.governorate, submission.district_name, submission.city].filter(Boolean).join("، ")}</p><p className="mt-1 text-xs text-stone-500">{submission.event_date ? dateFormatter.format(new Date(`${submission.event_date}T00:00:00`)) : submission.approximate_date || "التاريخ غير محدد"}{submission.location_description ? ` · ${submission.location_description}` : ""}</p></div><time className="shrink-0 text-[10px] text-stone-500" dateTime={submission.created_at}>{dateFormatter.format(new Date(submission.created_at))}</time></div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-300">{submission.description}</p>
        {isOwner && <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4"><button type="button" disabled={caseActionId === submission.id} onClick={() => void decideCase(submission, "published")} className="rounded-lg bg-[#c0dec2] px-4 py-2 text-sm font-semibold text-[#14251d] disabled:opacity-50">{caseActionId === submission.id ? "جارٍ الحفظ…" : "اعتماد ونشر"}</button><button type="button" disabled={caseActionId === submission.id} onClick={() => void decideCase(submission, "rejected")} className="rounded-lg border border-rose-400/30 px-4 py-2 text-sm text-rose-200 disabled:opacity-50">رفض</button></div>}
      </article>)}</div>}
    </section>

    {isOwner && <section id="activity" className="rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-[#b69a6d]">للمالك فقط</p><h2 className="mt-2 text-xl font-semibold">سجل الحركات</h2><p className="mt-1 text-xs text-stone-500">يسجل نوع العملية والحقول التي تغيرت، ولا ينسخ نصوص الشهادات أو الأدلة إلى سجل النشاط.</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] text-stone-400">سجل غير قابل للتحرير من الواجهة</span></div>
      {loading ? <p className="mt-5 text-sm text-stone-500">جارٍ تحميل الحركات...</p> : data.activity.length === 0 ? <p className="mt-5 text-sm text-stone-500">لا توجد حركات مسجلة بعد.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-right text-sm"><thead className="text-xs text-stone-500"><tr><th className="pb-3 font-medium">العملية</th><th className="pb-3 font-medium">نوع السجل</th><th className="pb-3 font-medium">الحقول المتغيرة</th><th className="pb-3 font-medium">الوقت</th></tr></thead><tbody className="divide-y divide-white/8">{data.activity.map((entry) => <tr key={entry.id}><td className="py-3">{actionLabels[entry.action] ?? entry.action}</td><td className="py-3">{subjectLabels[entry.record_type] ?? entry.record_type}</td><td className="max-w-xs py-3 text-xs text-stone-400">{entry.changed_fields.join("، ") || "—"}</td><td className="py-3 text-xs text-stone-400">{dateFormatter.format(new Date(entry.happened_at))}</td></tr>)}</tbody></table></div>}
    </section>}

    {!isOwner && <section className="rounded-2xl border border-white/10 bg-[#17211c] p-5"><p className="text-sm leading-7 text-stone-300">يمكنك إعداد المحتوى الخاص بك ومراجعته. سجل الحركات الشامل والرسائل الجماعية والإشعارات العامة متاحة لحساب المالك فقط.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/cases/new" className="rounded-xl bg-[#c0dec2] px-4 py-2.5 text-sm font-semibold text-[#14251d]">＋ إضافة قضية</Link><Link href="/files/new" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">＋ إضافة ملف</Link></div></section>}
  </div>;
}

function ModuleCard({ title, description, state }: { title: string; description: string; state: string }) {
  return <article className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/10 px-4 py-3.5"><div><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 text-xs text-stone-500">{description}</p></div><span className="shrink-0 text-[10px] text-stone-500">{state}</span></article>;
}
