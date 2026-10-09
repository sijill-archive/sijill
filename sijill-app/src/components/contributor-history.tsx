"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ArchiveMediaGallery } from "@/components/archive-media-gallery";
import type { ArchiveMedia } from "@/lib/archive-media";

type Kind = "case" | "person_file" | "testimony";
type Contribution = { id: string; title: string; description: string; status: string; created_at: string; published_at: string | null; media?: ArchiveMedia | null; case_id?: string | null; person_file_id?: string | null };
type Activity = { id: number; actor_id: string | null; actor_name: string | null; record_author_id: string | null; record_type: string; record_id: string; record_title: string | null; action: string; changed_fields: string[]; previous_status: string | null; new_status: string | null; happened_at: string; related_record_id: string | null };
const kinds: { kind: Kind; label: string; table: string }[] = [{ kind: "case", label: "القضايا", table: "sijill_cases" }, { kind: "person_file", label: "الملفات", table: "sijill_person_files" }, { kind: "testimony", label: "الشهادات", table: "sijill_testimonies" }];
const statusLabels: Record<string, string> = { draft: "مسودة", submitted: "بانتظار المراجعة", published: "منشور", rejected: "مرفوض", archived: "مخفي من الأرشيف" };
const recordLabels: Record<string, string> = { sijill_cases: "قضية", sijill_person_files: "ملف", sijill_testimonies: "شهادة", sijill_public_profiles: "اسم الحساب", sijill_user_roles: "صلاحيات الحساب" };
const fieldLabels: Record<string, string> = { title: "العنوان", description: "المحتوى", media: "المرفقات", status: "الحالة", event_date: "تاريخ الحدث", city: "المدينة", governorate: "المحافظة", display_name: "اسم العرض", linked_case_added: "إضافة ارتباط بقضية", linked_case_removed: "إزالة ارتباط بقضية", public_consent: "الموافقة على النشر", position: "موقف الشهادة", published_at: "وقت النشر", ai_review_status: "حالة المراجعة الآلية" };
const actionLabels: Record<string, string> = { created: "إضافة", updated: "تعديل", deleted: "حذف" };
const pageSize = 20;
const activitySize = 30;
const dateLabel = (value: string) => new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ContributorHistory({ userId, admin = false }: { userId: string; admin?: boolean }) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("case");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<Record<Kind, number>>({ case: 0, person_file: 0, testimony: 0 });
  const [records, setRecords] = useState<Contribution[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [activityPage, setActivityPage] = useState(0);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityError, setActivityError] = useState("");
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setAccess(false); setError(""); setLoading(true); setName(""); setPage(0); setActivityPage(0); setStatus(""); setRecords([]); setActivity([]);
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !uuidPattern.test(userId)) { setError("تعذر فتح سجل المساهم."); setLoading(false); return; }
    void (async () => {
      if (admin) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: role } = user ? await supabase.from("sijill_user_roles").select("role").eq("user_id", user.id).maybeSingle() : { data: null };
        if (role?.role !== "owner") { if (alive) { setError("السجل التفصيلي للمساهمين متاح للمالك فقط."); setLoading(false); } return; }
      }
      const { data: profile, error: profileError } = await supabase.from("sijill_public_profiles").select("display_name").eq("user_id", userId).maybeSingle();
      if (!alive) return;
      if (profileError || (!profile && !admin)) { setError("حساب المساهم غير متاح."); setLoading(false); return; }
      setName(profile?.display_name ?? "حساب محذوف — سجل محفوظ");
      const counts = await Promise.all(kinds.map(({ table, kind: itemKind }) => {
        let query = supabase.from(table).select("id", { head: true, count: "exact" }).eq("created_by", userId);
        if (!admin) query = query.eq("status", "published");
        if (!admin && itemKind === "testimony") query = query.eq("public_consent", true);
        return query;
      }));
      if (!alive) return;
      if (counts.some((result) => result.error)) { setError("تعذر تحميل سجل المساهم؛ أعد المحاولة."); setLoading(false); return; }
      setTotals(Object.fromEntries(kinds.map((item, index) => [item.kind, counts[index].count ?? 0])) as Record<Kind, number>);
      setAccess(true);
    })();
    return () => { alive = false; };
  }, [userId, admin]);

  useEffect(() => {
    if (!access) return;
    let alive = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    setLoading(true); setError(""); setRecords([]);
    let query = supabase.from(kinds.find((item) => item.kind === kind)!.table)
      .select(`id,title,description,status,created_at,published_at,${kind === "testimony" ? "case_id,person_file_id" : "media"}`, { count: "exact" }).eq("created_by", userId);
    if (!admin) query = query.eq("status", "published");
    else if (status) query = query.eq("status", status);
    if (!admin && kind === "testimony") query = query.eq("public_consent", true);
    void query.order("created_at", { ascending: false }).order("id").range(page * pageSize, (page + 1) * pageSize - 1).then(({ data, count, error: loadError }) => {
      if (!alive) return;
      if (loadError) setError("تعذر تحميل المساهمات؛ أعد المحاولة.");
      else { setRecords((data ?? []) as unknown as Contribution[]); setTotal(count ?? 0); }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [access, userId, admin, kind, status, page]);

  useEffect(() => {
    if (!access || !admin) return;
    let alive = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    setActivityLoading(true); setActivityError("");
    void supabase.from("sijill_activity_log")
      .select("id,actor_id,actor_name,record_author_id,record_type,record_id,record_title,action,changed_fields,previous_status,new_status,happened_at,related_record_id", { count: "exact" })
      .or(`actor_id.eq.${userId},record_author_id.eq.${userId}`)
      .in("record_type", Object.keys(recordLabels)).order("happened_at", { ascending: false }).order("id", { ascending: false })
      .range(activityPage * activitySize, (activityPage + 1) * activitySize - 1).then(({ data, count, error: loadError }) => {
        if (!alive) return;
        if (loadError) { setActivity([]); setActivityError("تعذر تحميل الحركات؛ تأكد من تطبيق ترحيل سجل المساهمين."); }
        else { setActivity((data ?? []) as Activity[]); setActivityTotal(count ?? 0); }
        setActivityLoading(false);
      });
    return () => { alive = false; };
  }, [access, admin, userId, activityPage]);

  const recordHref = (record: Contribution) => kind === "testimony" ? record.case_id ? `/cases/${record.case_id}` : record.person_file_id ? `/files/${record.person_file_id}` : null : `/${kind === "case" ? "cases" : "files"}/${record.id}`;
  return <section dir="rtl" className="space-y-6 text-stone-100">
    <header><p className="text-xs text-[#b69a6d]">{admin ? "مراجعة حساب المساهم" : "مساهم في الأرشيف"}</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">{name || "سجل المساهمات"}</h1><p className="mt-3 text-sm leading-7 text-stone-400">{admin ? "جميع المساهمات حسب حالتها، والحركات التي نفّذها الحساب أو أُجريت على محتواه." : "القضايا والملفات والشهادات المنشورة التي أضافها هذا الحساب."}</p>{admin && <p className="mt-2 break-all text-xs text-stone-500">معرّف الحساب الثابت: <span dir="ltr">{userId}</span></p>}</header>
    {error && <p role="alert" className="rounded-xl border border-amber-400/30 p-4 text-sm text-amber-200">{error}</p>}
    {access && <><div className="grid grid-cols-3 gap-3">{kinds.map((item) => <button key={item.kind} type="button" aria-pressed={kind === item.kind} onClick={() => { setKind(item.kind); setPage(0); }} className={`rounded-xl border p-4 text-center ${kind === item.kind ? "border-[#c0dec2]/60 bg-[#243b30]" : "border-white/10 bg-[#17211c]"}`}><span className="block text-xs text-stone-400">{item.label}</span><strong className="mt-2 block text-2xl tabular-nums">{totals[item.kind]}</strong></button>)}</div>
      {admin && <label className="block text-sm">حالة المحتوى<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="mr-3 rounded-lg border border-white/15 bg-[#17211c] px-3 py-2"><option value="">كل الحالات</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      {loading ? <p className="py-8 text-center text-sm text-stone-400">جارٍ تحميل المساهمات…</p> : !error && <><div className="space-y-3">{records.map((record) => <article key={record.id} className="rounded-xl border border-white/10 bg-[#17211c] p-5"><p className="text-xs text-[#b69a6d]">{kinds.find((item) => item.kind === kind)?.label} · {statusLabels[record.status] ?? record.status}</p><h2 className="mt-2 text-lg font-semibold">{record.title}</h2><p className="mt-2 text-xs leading-6 text-stone-400">أضافه: {name} · {dateLabel(record.created_at)}{record.published_at && <span className="block">تاريخ النشر: {dateLabel(record.published_at)}</span>}</p><details className="mt-3"><summary className="cursor-pointer text-sm text-[#c0dec2]">عرض المحتوى</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-stone-300">{record.description}</p>{record.media && <ArchiveMediaGallery media={record.media}/>}</details>{record.status === "published" && recordHref(record) && <Link href={recordHref(record)!} className="mt-4 inline-block text-xs text-[#c0dec2] underline">{kind === "testimony" ? "فتح القضية أو الملف المرتبط بالشهادة" : "فتح السجل المنشور"}</Link>}{admin && <p className="mt-3 break-all text-[10px] text-stone-500">معرّف السجل: {record.id}</p>}</article>)}{records.length === 0 && <p className="py-8 text-center text-sm text-stone-400">لا توجد مساهمات في هذا القسم.</p>}</div><Pagination page={page} total={total} size={pageSize} onChange={setPage}/></>}
      {admin && <section className="rounded-2xl border border-white/10 bg-[#17211c] p-5"><h2 className="text-xl font-semibold">سجل الحركات</h2><p className="mt-2 text-xs leading-6 text-stone-400">يسجل النظام وقت الحركة، ومن نفذها، والحقول التي تغيرت وحالة النشر. تُحفظ أسماء السجلات وأصحاب الحركات من الآن، وتبقى الحركات محفوظة بعد حذف المحتوى.</p>{activityError && <p role="alert" className="mt-4 text-sm text-amber-200">{activityError}</p>}{activityLoading ? <p className="py-6 text-sm text-stone-400">جارٍ تحميل الحركات…</p> : !activityError && <><ol className="mt-4 divide-y divide-white/10">{activity.map((item) => <li key={item.id} className="py-4"><p className="font-semibold">{actionLabels[item.action] ?? item.action} · {recordLabels[item.record_type] ?? item.record_type} · {item.record_title || "عنوان غير محفوظ للحركة القديمة"}</p><p className="mt-2 text-xs text-stone-400">نفّذها: {item.actor_name || (item.actor_id === userId ? name : item.actor_id ? "حساب آخر" : "النظام")} · {dateLabel(item.happened_at)}</p>{item.action === "updated" && <p className="mt-2 text-xs leading-6 text-stone-400">الحقول: {item.changed_fields.map((field) => fieldLabels[field] ?? field).join("، ") || "دون تغيير في المحتوى"}</p>}{item.new_status && <p className="mt-2 text-xs text-stone-300">الحالة: {item.previous_status ? `${statusLabels[item.previous_status] ?? item.previous_status} ← ` : ""}{statusLabels[item.new_status] ?? item.new_status}</p>}<p className="mt-2 break-all text-[10px] text-stone-500">معرّف السجل: {item.record_id}{item.related_record_id && ` · القضية المرتبطة: ${item.related_record_id}`}</p></li>)}</ol>{activity.length === 0 && <p className="py-6 text-sm text-stone-400">لا توجد حركات مسجلة لهذا الحساب.</p>}<Pagination page={activityPage} total={activityTotal} size={activitySize} onChange={setActivityPage}/></>}</section>}
    </>}
    <Link href={admin ? "/admin/contributors" : "/"} className="inline-block text-sm text-[#c0dec2] underline">{admin ? "العودة إلى المساهمين" : "العودة إلى الأرشيف"}</Link>
  </section>;
}

function Pagination({ page, total, size, onChange }: { page: number; total: number; size: number; onChange: (value: number) => void }) {
  if (total <= size) return null;
  return <nav aria-label="صفحات السجل" className="mt-4 flex items-center justify-between gap-3 text-sm"><button disabled={page === 0} onClick={() => onChange(page - 1)} className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40">السابق</button><span className="text-xs text-stone-400">الصفحة {page + 1} من {Math.ceil(total / size)}</span><button disabled={(page + 1) * size >= total} onClick={() => onChange(page + 1)} className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40">التالي</button></nav>;
}
