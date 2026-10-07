"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ArchiveMediaGallery } from "@/components/archive-media-gallery";
import type { ArchiveMedia } from "@/lib/archive-media";

type Activity = { id: number; actor_id: string | null; record_type: string; record_id: string; action: string; changed_fields: string[]; happened_at: string };
type VerificationRequest = { id: string; subject_type: string; request_type: string; details: string; status: string; created_at: string };
type CaseSubmission = { id: string; title: string; event_type: string; description: string; country: string; governorate: string; district_name: string; city: string; location_description: string | null; event_date: string | null; approximate_date: string | null; media: ArchiveMedia | null; created_at: string; status: string };
type PersonFile = { id: string; title: string; description: string; case_id: string | null; governorate: string | null; district_name: string | null; city: string | null; media: ArchiveMedia | null; created_at: string; status: string };
type FileCaseLink = { case_id: string; person_file_id: string };
type DashboardData = {
  totals: { cases: number; files: number; testimonies: number; articles: number };
  pending: { cases: number; files: number; testimonies: number; requests: number };
  activity: Activity[];
  requests: VerificationRequest[];
  pendingCases: CaseSubmission[];
  pendingFiles: PersonFile[];
  cases: CaseSubmission[];
  files: PersonFile[];
  fileLinks: FileCaseLink[];
};

const emptyData: DashboardData = {
  totals: { cases: 0, files: 0, testimonies: 0, articles: 0 },
  pending: { cases: 0, files: 0, testimonies: 0, requests: 0 },
  activity: [],
  requests: [],
  pendingCases: [],
  pendingFiles: [],
  cases: [],
  files: [],
  fileLinks: [],
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
  const [archiveKind, setArchiveKind] = useState<"cases" | "files">("cases");
  const [regionFilter, setRegionFilter] = useState("");

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

      const [caseTotal, fileTotal, testimonyTotal, articleTotal, casePending, filePending, testimonyPending, requestPending, requestRows, caseRows, allCases, fileRows, allFiles, activityRows, fileLinkRows] = await Promise.all([
        supabase.from("sijill_cases").select("id", { count: "exact", head: true }),
        supabase.from("sijill_person_files").select("id", { count: "exact", head: true }),
        supabase.from("sijill_testimonies").select("id", { count: "exact", head: true }),
        supabase.from("sijill_articles").select("id", { count: "exact", head: true }),
        supabase.from("sijill_cases").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("sijill_person_files").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("sijill_testimonies").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("sijill_verification_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("sijill_verification_requests").select("id,subject_type,request_type,details,status,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        supabase.from("sijill_cases").select("id,title,event_type,description,country,governorate,district_name,city,location_description,event_date,approximate_date,media,created_at,status").eq("status", "submitted").order("title", { ascending: true }).limit(500),
        supabase.from("sijill_cases").select("id,title,event_type,description,country,governorate,district_name,city,location_description,event_date,approximate_date,media,created_at,status").neq("status", "archived").order("title", { ascending: true }).limit(500),
        supabase.from("sijill_person_files").select("id,title,description,case_id,governorate,district_name,city,media,created_at,status").eq("status", "submitted").order("title", { ascending: true }).limit(500),
        supabase.from("sijill_person_files").select("id,title,description,case_id,governorate,district_name,city,media,created_at,status").neq("status", "archived").order("title", { ascending: true }).limit(500),
        owner ? supabase.from("sijill_activity_log").select("id,actor_id,record_type,record_id,action,changed_fields,happened_at").order("happened_at", { ascending: false }).limit(8) : Promise.resolve({ data: [], error: null }),
        supabase.from("sijill_case_person_files").select("case_id,person_file_id"),
      ]);

      if (!active) return;
      const queryErrors = [caseTotal, fileTotal, testimonyTotal, articleTotal, casePending, filePending, testimonyPending, requestPending, requestRows, caseRows, allCases, fileRows, allFiles, activityRows, fileLinkRows].filter((result) => result.error);
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
          pendingFiles: (fileRows.data ?? []) as PersonFile[],
          cases: (allCases.data ?? []) as CaseSubmission[],
          files: (allFiles.data ?? []) as PersonFile[],
          fileLinks: (fileLinkRows.data ?? []) as FileCaseLink[],
          activity: (activityRows.data ?? []) as Activity[],
        });
      }
      setLoading(false);
    };

    void loadDashboard();
    return () => { active = false; };
  }, []);

  const decideSubmission = async (kind: "case" | "file", submission: CaseSubmission | PersonFile, decision: "published" | "rejected") => {
    if (!isOwner || caseActionId) return;
    const contentName = kind === "case" ? "القضية" : "الملف";
    const actionLabel = decision === "published" ? `نشر هذا ${contentName} للزوار` : `رفض هذا ${contentName}`;
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
    const table = kind === "case" ? "sijill_cases" : "sijill_person_files";
    const { data: updated, error } = await supabase.from(table).update(update).eq("id", submission.id).eq("status", "submitted").select("id").maybeSingle();
    if (error || !updated) {
      setLoadError(true);
    } else {
      const pendingKey = kind === "case" ? "cases" : "files";
      setData((current) => ({
        ...current,
        pending: { ...current.pending, [pendingKey]: Math.max(0, current.pending[pendingKey] - 1) },
        pendingCases: current.pendingCases.filter((item) => item.id !== submission.id),
        pendingFiles: current.pendingFiles.filter((item) => item.id !== submission.id),
        cases: kind === "case" ? current.cases.map((item) => item.id === submission.id ? { ...item, status: decision } : item) : current.cases,
        files: kind === "file" ? current.files.map((item) => item.id === submission.id ? { ...item, status: decision } : item) : current.files,
      }));
    }
    setCaseActionId(null);
  };

  const pendingSubmissions = data.pending.cases + data.pending.files + data.pending.testimonies;
  const regions = [...new Set([...data.cases.map((item) => item.governorate), ...data.files.map((item) => item.governorate ?? "")].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  const visibleCases = data.cases.filter((item) => !regionFilter || item.governorate === regionFilter).sort((a, b) => a.title.localeCompare(b.title, "ar"));
  const visibleFiles = data.files.filter((item) => !regionFilter || item.governorate === regionFilter).sort((a, b) => a.title.localeCompare(b.title, "ar"));

  return <div className="space-y-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs tracking-[.18em] text-[#b69a6d]">ملخص الأرشيف</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">لوحة التحكم</h1><p className="mt-2 text-sm text-stone-400">متابعة المحتوى وطلبات التوثيق ونشاط المنصة.</p></div>
      <Link href="/" className="w-fit rounded-xl border border-white/15 px-4 py-2.5 text-sm text-stone-300 hover:bg-white/5">فتح الموقع ↗</Link>
    </header>

    {databaseMissing && <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-4 text-sm leading-7 text-amber-100"><strong>قاعدة الإدارة لم تُجهّز بعد.</strong> طبّق الترحيل الموجود في <code dir="ltr">supabase/migrations</code> من صفحة SQL Editor في Supabase، ثم أضف دور المالك كما يوضح <code dir="ltr">supabase/README.md</code>.</div>}
    {loadError && <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm leading-7 text-rose-100">تعذر تحميل بعض إحصاءات الإدارة. تحقق من اتصال Supabase وسياسات الوصول ثم أعد تحميل الصفحة.</div>}

    <section aria-label="إحصائيات الموقع" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: "القضايا", value: data.totals.cases, hint: `${data.pending.cases} قيد المراجعة`, icon: "◈" },
        { label: "ملفات الأشخاص", value: data.totals.files, hint: `${data.pending.files} قيد المراجعة`, icon: "▤" },
        { label: "القضايا المنشورة", value: data.cases.filter((item) => item.status === "published").length, hint: "متاحة للزوار", icon: "✓" },
        { label: "الملفات المنشورة", value: data.files.filter((item) => item.status === "published").length, hint: "متاحة للزوار", icon: "▣" },
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
        <ArchiveMediaGallery media={submission.media} />
        {isOwner && <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4"><button type="button" disabled={caseActionId === submission.id} onClick={() => void decideSubmission("case", submission, "published")} className="rounded-lg bg-[#c0dec2] px-4 py-2 text-sm font-semibold text-[#14251d] disabled:opacity-50">{caseActionId === submission.id ? "جارٍ الحفظ…" : "اعتماد ونشر"}</button><button type="button" disabled={caseActionId === submission.id} onClick={() => void decideSubmission("case", submission, "rejected")} className="rounded-lg border border-rose-400/30 px-4 py-2 text-sm text-rose-200 disabled:opacity-50">رفض</button></div>}
      </article>)}</div>}
      <div className="mt-7 border-t border-white/10 pt-5"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">الملفات المرسلة للمراجعة</h3><span className="text-xs text-amber-200">{loading ? "—" : data.pending.files} قيد المراجعة</span></div>
        {loading ? <p className="mt-4 text-sm text-stone-500">جارٍ تحميل الملفات...</p> : data.pendingFiles.length === 0 ? <p className="mt-4 rounded-xl border border-white/8 bg-black/10 p-4 text-sm text-stone-400">لا توجد ملفات أشخاص تنتظر المراجعة.</p> : <div className="mt-4 space-y-3">{data.pendingFiles.map((submission) => <article key={submission.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{submission.title}</h4><p className="mt-1 text-xs text-stone-400">{[submission.governorate, submission.district_name, submission.city].filter(Boolean).join("، ") || "دون موقع محدد"}</p>{fileCaseNames(submission, data.fileLinks, data.cases).length > 0 && <p className="mt-1 text-xs text-[#e7d6ad]">القضايا المرتبطة: {fileCaseNames(submission, data.fileLinks, data.cases).join("، ")}</p>}</div><time className="text-[10px] text-stone-500">{dateFormatter.format(new Date(submission.created_at))}</time></div>{submission.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">{submission.description}</p>}<ArchiveMediaGallery media={submission.media} />{isOwner && <div className="mt-4 flex gap-2 border-t border-white/10 pt-4"><button type="button" disabled={caseActionId === submission.id} onClick={() => void decideSubmission("file", submission, "published")} className="rounded-lg bg-[#c0dec2] px-4 py-2 text-sm font-semibold text-[#14251d] disabled:opacity-50">{caseActionId === submission.id ? "جارٍ الحفظ…" : "اعتماد ونشر"}</button><button type="button" disabled={caseActionId === submission.id} onClick={() => void decideSubmission("file", submission, "rejected")} className="rounded-lg border border-rose-400/30 px-4 py-2 text-sm text-rose-200 disabled:opacity-50">رفض</button></div>}</article>)}</div>}
      </div>
    </section>

    <section id="archive-management" className="rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs text-[#b69a6d]">فهرس الإدارة</p><h2 className="mt-2 text-xl font-semibold">القضايا والملفات</h2><p className="mt-1 text-xs leading-6 text-stone-500">مرتبة أبجدياً، ويمكن تصفيتها بالمحافظة. الملفات المرتبطة تشير إلى القضية التابعة لها.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setArchiveKind("cases")} className={`rounded-lg px-3 py-2 text-sm ${archiveKind === "cases" ? "bg-[#c0dec2] text-[#14251d]" : "border border-white/15 text-stone-300"}`}>القضايا ({data.cases.length})</button><button type="button" onClick={() => setArchiveKind("files")} className={`rounded-lg px-3 py-2 text-sm ${archiveKind === "files" ? "bg-[#c0dec2] text-[#14251d]" : "border border-white/15 text-stone-300"}`}>الملفات ({data.files.length})</button></div></div>
      <div className="mt-4"><label className="text-xs text-stone-400">تصفية حسب المحافظة<select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} className="mt-2 block w-full rounded-lg border border-white/15 bg-[#101713] px-3 py-2 text-sm text-stone-200 sm:max-w-sm"><option value="">كل المحافظات</option>{regions.map((region) => <option key={region} value={region}>{region}</option>)}</select></label></div>
      {loading ? <p className="mt-5 text-sm text-stone-500">جارٍ تحميل الفهرس...</p> : archiveKind === "cases" ? visibleCases.length === 0 ? <p className="mt-5 text-sm text-stone-500">لا توجد قضايا ضمن هذا الاختيار.</p> : <div className="mt-5 space-y-3">{visibleCases.map((item) => { const children = data.files.filter((file) => fileHasCase(file, item.id, data.fileLinks)).sort((a, b) => a.title.localeCompare(b.title, "ar")); return <article key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-stone-400">{item.event_type} · {[item.governorate, item.district_name, item.city].filter(Boolean).join("، ")}</p><p className="mt-1 text-xs text-stone-500">الحالة: {statusLabel(item.status)} · {children.length} ملف مرتبط</p></div>{item.status === "published" && <Link href={`/files/new?caseId=${item.id}`} className="rounded-lg border border-[#c0dec2]/30 px-3 py-2 text-xs text-[#c0dec2]">＋ إضافة ملف مرتبط</Link>}</div>{children.length > 0 && <ul className="mr-3 mt-3 space-y-1 border-r border-white/15 pr-3">{children.map((file) => <li key={file.id} className="text-sm text-stone-300">📁 {file.title} <span className="text-xs text-stone-500">· {statusLabel(file.status)}</span></li>)}</ul>}</article>; })}</div> : visibleFiles.length === 0 ? <p className="mt-5 text-sm text-stone-500">لا توجد ملفات ضمن هذا الاختيار.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{visibleFiles.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-xs text-stone-400">{[item.governorate, item.district_name, item.city].filter(Boolean).join("، ") || "دون موقع محدد"}</p><p className="mt-1 text-xs text-stone-500">الحالة: {statusLabel(item.status)}{fileCaseNames(item, data.fileLinks, data.cases).length ? ` · مرتبط بـ ${fileCaseNames(item, data.fileLinks, data.cases).length} قضايا` : " · مستقل"}</p>{item.status === "published" && item.case_id && <Link href={`/cases/${item.case_id}`} className="mt-3 inline-block text-xs text-[#c0dec2] underline underline-offset-4">فتح القضية المرتبطة</Link>}</article>)}</div>}
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

function statusLabel(status: string) {
  return ({ submitted: "قيد المراجعة", published: "منشور", rejected: "مرفوض", draft: "مسودة" } as Record<string, string>)[status] ?? status;
}

function fileHasCase(file: PersonFile, caseId: string, links: FileCaseLink[]) {
  return file.case_id === caseId || links.some((link) => link.person_file_id === file.id && link.case_id === caseId);
}

function fileCaseNames(file: PersonFile, links: FileCaseLink[], cases: CaseSubmission[]) {
  const ids = new Set([...(file.case_id ? [file.case_id] : []), ...links.filter((link) => link.person_file_id === file.id).map((link) => link.case_id)]);
  return [...ids].map((id) => cases.find((item) => item.id === id)?.title).filter((title): title is string => Boolean(title));
}
