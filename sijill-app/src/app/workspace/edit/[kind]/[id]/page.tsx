"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { CaseAliasesField, parseCaseAliases } from "@/components/case-aliases-field";
import { CaseSearchPicker, type CaseOption } from "@/components/case-search-picker";
import { GeographySelects } from "@/components/geography-selects";
import { EditMediaFields } from "@/components/edit-media-fields";
import { emptyArchiveMedia, uploadArchiveMedia, validateArchiveMedia, type ArchiveMedia } from "@/lib/archive-media";
import { geography } from "@/lib/geography";
import { canEditContribution, editDeadline } from "@/lib/edit-window";

type Editable = {
  id: string; title: string; description: string; created_at: string; published_at: string | null; status: string; created_by: string;
  event_date?: string | null; approximate_date?: string | null; event_type?: string; position?: string; aliases?: string[];
  country?: string | null; governorate?: string | null; district_id?: string | null; city?: string | null; location_description?: string | null;
  evidence_level?: number; source_type?: string; public_consent?: boolean; case_id?: string | null; person_file_id?: string | null; media: ArchiveMedia;
};
const tableFor: Record<string, string> = { case: "sijill_cases", file: "sijill_person_files", testimony: "sijill_testimonies" };
const eventTypes = ["قصف أو هجوم", "اعتقال أو اختفاء", "تهجير أو نزوح", "انتهاك", "حدث مدني", "أخرى"];
const sources = [["witness","شهادة شاهد"],["human_rights_report","تقرير حقوقي"],["news","تقرير صحفي"],["official_document","وثيقة رسمية"],["open_source","مصدر مفتوح"],["archive","أرشيف"],["interview","مقابلة"],["other","مصدر آخر"]];
const field = "mt-2 w-full rounded-xl border border-stone-300 bg-transparent px-4 py-3 text-sm font-normal dark:border-stone-700";
function caseDescription(value: string) {
  const firsthandMarker = "\n\nما عاينه مقدم القضية:\n"; const secondhandMarker = "\n\nمعلومات منقولة أو مصادر منشورة:\n";
  const [mainAndFirst, secondhand = ""] = value.split(secondhandMarker);
  const [main, firsthand = ""] = mainAndFirst.split(firsthandMarker);
  return { main, firsthand, secondhand };
}

export default function EditContributionPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<Editable | null>(null);
  const [selectedCases, setSelectedCases] = useState<CaseOption[]>([]);
  const [parent, setParent] = useState<{ title: string; href: string } | null>(null);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [approximate, setApproximate] = useState(false); const [revision, setRevision] = useState(0);
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  useEffect(() => {
    let active = true;
    setReady(false); setRecord(null); setError(""); setNotice("");
    if (!supabase || !tableFor[kind]) { setError("تعذر فتح المساهمة. تحقق من الرابط والاتصال."); setReady(true); return; }
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace(`/account?mode=login&next=${encodeURIComponent(`/workspace/edit/${kind}/${id}`)}`); return; }
        const { data, error: queryError } = await supabase.from(tableFor[kind]).select("*").eq("id", id).eq("created_by", user.id).maybeSingle();
        if (queryError || !data) throw new Error("لم نعثر على مساهمة تابعة لحسابك.");
        const row = { ...data, media: data.media ?? emptyArchiveMedia } as Editable;
        if (!canEditContribution(row.status, row.published_at, row.created_at)) throw new Error("انتهت مهلة التعديل، وهي ١٥ يوماً من تاريخ النشر.");
        if (kind === "file") {
          const { data: links, error: linksError } = await supabase.from("sijill_case_person_files").select("case_id").eq("person_file_id", id);
          if (linksError) throw new Error("تعذر تحميل القضايا المرتبطة. أعد تحميل الصفحة.");
          const ids = [...new Set([...(links ?? []).map((item) => item.case_id as string), ...(row.case_id ? [row.case_id] : [])])];
          const result = ids.length ? await supabase.from("sijill_cases").select("id,title,aliases,governorate,district_name,city,event_date,approximate_date").in("id", ids) : { data: [], error: null };
          if (result.error) throw new Error("تعذر تحميل القضايا المرتبطة. أعد تحميل الصفحة.");
          if (active) setSelectedCases(ids.map((caseId) => result.data?.find((item) => item.id === caseId) ?? { id: caseId, title: "قضية مرتبطة غير متاحة للعرض حاليًا" }));
        }
        if (kind === "testimony") {
          const parentId = row.case_id ?? row.person_file_id;
          const result = await supabase.from(row.case_id ? "sijill_cases" : "sijill_person_files").select("title").eq("id", parentId).maybeSingle();
          if (active) setParent({ title: result.data?.title ?? "السجل المرتبط بالشهادة", href: `/${row.case_id ? "cases" : "files"}/${parentId}` });
        }
        if (active) { setRecord(row); setApproximate(!row.event_date); setRevision((value) => value + 1); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "تعذر فتح المساهمة."); }
      finally { if (active) setReady(true); }
    })();
    return () => { active = false; };
  }, [id, kind, router, supabase]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !record || busy) return;
    const values = new FormData(event.currentTarget);
    const text = (name: string) => String(values.get(name) ?? "").trim();
    setError(""); setNotice("");
    setBusy(true);
    try {
      const selected = validateArchiveMedia(values);
      const retainedImages = values.getAll("retained_images").map(String).filter((path) => record.media.images.includes(path));
      const retainedVideos = values.getAll("retained_videos").map(String).filter((path) => record.media.videos.includes(path));
      if (retainedImages.length + selected.images.length > 10 || retainedVideos.length + selected.videos.length > 3) throw new Error("الحد الإجمالي 10 صور و3 فيديوهات. أزل بعض المرفقات الحالية أو قلل المرفقات الجديدة.");
      if (!canEditContribution(record.status, record.published_at, record.created_at)) throw new Error("انتهت مهلة التعديل، وهي ١٥ يوماً من تاريخ النشر.");
      let description = text("description");
      if (kind === "testimony" && description.split(/\s+/).filter(Boolean).length < 20) throw new Error("يجب ألا يقل نص الشهادة عن 20 كلمة.");
      if (kind === "case") description += [text("firsthand") ? `\n\nما عاينه مقدم القضية:\n${text("firsthand")}` : "", text("secondhand") ? `\n\nمعلومات منقولة أو مصادر منشورة:\n${text("secondhand")}` : ""].join("");
      const update: Record<string, unknown> = { title: text("title"), description, country: text("country") || (kind === "file" ? null : "سوريا") };
      if (kind !== "testimony") {
        const governorate = text("governorate");
        const district = geography.governorates.find((item) => item.name === governorate)?.districts.find((item) => item.id === text("district"));
        const city = text("city") === "__other__" ? text("cityOther") : text("city");
        if (kind === "case" && (!district || !city)) throw new Error("أكمل المحافظة والمنطقة والمدينة.");
        Object.assign(update, { governorate: governorate || null, district_id: district?.id ?? null, district_name: district?.name ?? null, city: city || null, location_description: text("locationDescription") || null });
        if (kind === "case") Object.assign(update, { event_type: text("eventType"), aliases: parseCaseAliases(values), event_date: approximate ? null : text("eventDate") || null, approximate_date: approximate ? text("approximateDate") || null : null });
      } else Object.assign(update, { city: text("city"), location_description: text("locationDescription"), event_date: text("eventDate") || null, position: text("position"), source_type: text("sourceType"), evidence_level: Number(text("evidenceLevel")), public_consent: values.get("publicConsent") === "on" });
      const uploaded = await uploadArchiveMedia(supabase, kind === "case" ? "cases" : kind === "file" ? "files" : "testimonies", record.id, values);
      const media: ArchiveMedia = { ...uploaded, images: [...retainedImages, ...uploaded.images], videos: [...retainedVideos, ...uploaded.videos] };
      update.media = media;
      const result = kind === "file" ? await supabase.rpc("edit_sijill_person_file", { p_id: record.id, p_changes: update, p_case_ids: selectedCases.map((item) => item.id) }) : await supabase.from(tableFor[kind]).update(update).eq("id", record.id).eq("created_by", record.created_by).select("id").single();
      if (result.error) throw new Error(result.error.message.includes("edit period") ? "انتهت مهلة التعديل، وهي ١٥ يوماً من تاريخ النشر." : "تعذر حفظ التعديل. بياناتك السابقة محفوظة؛ أعد تحميل الصفحة ثم حاول مجدداً.");
      setRecord({ ...record, ...update, media } as Editable); setRevision((value) => value + 1);
      setNotice("تم حفظ جميع التعديلات والمرفقات والقضايا المرتبطة."); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ التعديل."); }
    finally { setBusy(false); }
  };

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#131916] text-sm text-stone-300">جارٍ تحميل المساهمة...</main>;
  const parts = caseDescription(record?.description ?? "");
  return <main dir="rtl" className="min-h-screen bg-[#f8f7f2] px-5 py-10 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9]"><div className="mx-auto max-w-3xl">
    <Link href={`/workspace?tab=${kind === "case" ? "cases" : kind === "file" ? "files" : "testimonies"}`} className="text-sm text-[#527764] underline">العودة إلى مساهماتي</Link>
    <h1 className="mt-7 text-3xl font-bold">تعديل {kind === "case" ? "القضية" : kind === "file" ? "ملف الشخص" : "الشهادة"}</h1>
    {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400 bg-rose-50 p-4 text-sm leading-7 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{notice}</p>}
    {record && <form key={revision} onSubmit={save} className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d] sm:p-8"><fieldset disabled={busy} className="space-y-5">
      <label className="block text-sm font-semibold">{kind === "file" ? "عنوان ملف الشخص" : "العنوان"}<input required minLength={kind === "case" ? 3 : 2} maxLength={180} name="title" defaultValue={record.title} className={field}/></label>
      {kind === "case" && <><CaseAliasesField aliases={record.aliases}/><label className="block text-sm font-semibold">نوع الحدث<select name="eventType" defaultValue={record.event_type} className={field}>{[...new Set([...eventTypes, record.event_type ?? "أخرى"])].map((value) => <option key={value}>{value}</option>)}</select></label></>}
      {kind === "file" && <section className="space-y-3"><h2 className="text-lg font-semibold">القضايا المرتبطة بالشخص</h2><CaseSearchPicker selected={selectedCases} onChange={setSelectedCases}/></section>}
      {kind === "testimony" && parent && <p className="rounded-xl bg-stone-50 p-4 text-sm dark:bg-stone-900">الشهادة مرتبطة بـ: <Link href={parent.href} className="underline">{parent.title}</Link></p>}
      <section className="space-y-4 border-t border-stone-200 pt-6 dark:border-stone-800"><h2 className="text-lg font-semibold">الموقع {kind !== "file" && "والتاريخ"}</h2>
        <label className="block text-sm font-semibold">الدولة<input name="country" required={kind !== "file"} maxLength={120} defaultValue={record.country ?? ""} className={field}/></label>
        {kind !== "testimony" ? <GeographySelects required={kind === "case"} idPrefix="edit-location" initial={record}/> : <label className="block text-sm font-semibold">المدينة<input required name="city" maxLength={120} defaultValue={record.city ?? ""} className={field}/></label>}
        <label className="block text-sm font-semibold">وصف أدق للموقع<input maxLength={240} name="locationDescription" defaultValue={record.location_description ?? ""} className={field}/></label>
        {kind !== "file" && <><label className="block text-sm font-semibold">تاريخ الواقعة<input type="date" name="eventDate" required={kind === "case" && !approximate} disabled={kind === "case" && approximate} defaultValue={record.event_date ?? ""} className={field}/></label>{kind === "case" && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approximate} onChange={(e) => setApproximate(e.target.checked)}/>التاريخ تقريبي أو غير معروف</label>{approximate && <label className="block text-sm font-semibold">السنة أو الفترة التقريبية<input name="approximateDate" maxLength={80} defaultValue={record.approximate_date ?? ""} className={field}/></label>}</>}</>}
      </section>
      <label className="block text-sm font-semibold">{kind === "testimony" ? "نص الشهادة (20 كلمة على الأقل)" : kind === "case" ? "وصف الحدث" : "معلومات الملف"}<textarea required={kind !== "file"} minLength={kind === "case" ? 30 : undefined} maxLength={kind === "file" ? 4000 : kind === "case" ? 8000 : 20000} name="description" rows={8} defaultValue={kind === "case" ? parts.main : record.description} className={`${field} leading-7`}/></label>
      {kind === "case" && <><label className="block text-sm font-semibold">ما عاينته بنفسك<textarea name="firsthand" maxLength={5000} rows={4} defaultValue={parts.firsthand} className={`${field} leading-7`}/></label><label className="block text-sm font-semibold">معلومات منقولة أو مصادر منشورة<textarea name="secondhand" maxLength={5000} rows={4} defaultValue={parts.secondhand} className={`${field} leading-7`}/></label></>}
      {kind === "testimony" && <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">نوع الشهادة<select name="position" defaultValue={record.position ?? "supporting"} className={field}><option value="supporting">مؤيدة</option><option value="opposing">معارضة</option></select></label><label className="text-sm font-semibold">نوع المصدر<select name="sourceType" defaultValue={record.source_type ?? "other"} className={field}>{sources.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">مستوى التوثيق<select name="evidenceLevel" defaultValue={record.evidence_level ?? 1} className={field}>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} من 5</option>)}</select></label></div>}
      <EditMediaFields media={record.media}/>
      {kind === "testimony" && <label className="flex items-start gap-3 text-sm leading-7"><input type="checkbox" required name="publicConsent" defaultChecked={record.public_consent} className="mt-2"/>أوافق على نشر الشهادة بعد المراجعة ضمن الأرشيف.</label>}
      <p className="text-xs leading-6 text-stone-500">{record.published_at || ["published","archived"].includes(record.status) ? <>يمكنك التعديل حتى {new Intl.DateTimeFormat("ar", {dateStyle:"long"}).format(editDeadline(record.published_at,record.created_at))}. المهلة ١٥ يومًا من النشر.</> : "تبدأ مهلة التعديل البالغة ١٥ يومًا عند نشر المساهمة."}</p>
      <button disabled={busy} className="w-full rounded-xl bg-[#194537] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ حفظ التعديلات والمرفقات…" : "حفظ جميع التعديلات"}</button>
    </fieldset></form>}
  </div></main>;
}
