"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { CaseSearchPicker, type CaseOption } from "@/components/case-search-picker";
import { GeographySelects } from "@/components/geography-selects";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { geography } from "@/lib/geography";
import { ArchiveMediaFields } from "@/components/archive-media-fields";
import { uploadArchiveMedia, validateArchiveMedia } from "@/lib/archive-media";

export default function NewFilePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<{ title: string; description: string; location: string; caseIds: string[]; caseTitles: string[] } | null>(null);
  const [selectedCases, setSelectedCases] = useState<CaseOption[]>([]);
  const [formResetKey, setFormResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { router.replace("/account?mode=login&next=%2Ffiles%2Fnew"); return; }
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setReady(true);
        const selectedCase = new URLSearchParams(window.location.search).get("caseId");
        if (selectedCase && /^[0-9a-f-]{36}$/i.test(selectedCase)) {
          const result = await supabase.from("sijill_cases").select("id,title,aliases,governorate,district_name,city,event_date,approximate_date").eq("status", "published").eq("id", selectedCase).maybeSingle();
          if (result.data) setSelectedCases([result.data]);
        }
      }
      else router.replace("/account?mode=login&next=%2Ffiles%2Fnew");
    });
  }, [router]);

  const showPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try { validateArchiveMedia(values); } catch (error) { setErrorMessage(error instanceof Error ? error.message : "تحقق من المرفقات."); return; }
    const cityChoice = String(values.get("city") ?? "");
    const city = cityChoice === "__other__" ? String(values.get("cityOther") ?? "") : cityChoice;
    const governorate = String(values.get("governorate") ?? "");
    const districtId = String(values.get("district") ?? "");
    const district = geography.governorates.find((item) => item.name === governorate)?.districts.find((item) => item.id === districtId);
    const caseIds = values.getAll("caseIds").map(String);
    const caseTitles = selectedCases.filter((item) => caseIds.includes(item.id)).map((item) => item.title);
    const location = [governorate, district?.name, city].filter(Boolean).join("، ");
    setErrorMessage("");
    setMessage("");
    setPreview({
      title: String(values.get("title") ?? ""),
      description: String(values.get("description") ?? ""),
      location,
      caseIds,
      caseTitles,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sendFile = async () => {
    if (!preview || busy) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setErrorMessage("تعذر الاتصال بقاعدة البيانات."); return; }
    setBusy(true);
    setErrorMessage("");
    let draftId: string | null = null;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.replace("/account?mode=login&next=%2Ffiles%2Fnew"); return; }
      const form = document.querySelector<HTMLFormElement>("form[data-person-file-form]");
      if (!form) throw new Error("Form is unavailable");
      const values = new FormData(form);
      validateArchiveMedia(values);
      const governorate = String(values.get("governorate") ?? "");
      const districtId = String(values.get("district") ?? "");
      const district = geography.governorates.find((item) => item.name === governorate)?.districts.find((item) => item.id === districtId);
      const cityChoice = String(values.get("city") ?? "");
      const city = cityChoice === "__other__" ? String(values.get("cityOther") ?? "").trim() : cityChoice;
      const { data: created, error } = await supabase.from("sijill_person_files").insert({
        created_by: user.id,
        title: preview.title.trim(),
        description: preview.description.trim(),
        case_id: preview.caseIds[0] || null,
        country: governorate ? "سوريا" : null,
        governorate: governorate || null,
        district_id: district?.id ?? null,
        district_name: district?.name ?? null,
        city: city || null,
        location_description: String(values.get("locationDescription") ?? "").trim() || null,
        status: "draft",
      }).select("id").single();
      if (error) throw error;
      draftId = created.id;
      if (preview.caseIds.length) {
        const { error: linksError } = await supabase.from("sijill_case_person_files").insert(preview.caseIds.map((caseId) => ({ case_id: caseId, person_file_id: created.id })));
        if (linksError) throw linksError;
      }
      const media = await uploadArchiveMedia(supabase, "files", created.id, values);
      const { error: submitError } = await supabase.from("sijill_person_files").update({ media, status: "submitted" }).eq("id", created.id);
      if (submitError) {
        await supabase.storage.from("sijill-media").remove([...media.images, ...media.videos]);
        throw submitError;
      }
      setMessage("أُرسل الملف إلى لوحة الإدارة للمراجعة. سيظهر للزوار بعد اعتماده ونشره.");
      setPreview(null);
      form.reset();
      setSelectedCases([]);
      setFormResetKey((key) => key + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Failed to submit Sijill person file", error);
      if (draftId) await supabase.from("sijill_person_files").delete().eq("id", draftId);
      setErrorMessage(error instanceof Error && (error.message.includes("ميغابايت") || error.message.includes("YouTube") || error.message.includes("صور كحد") || error.message.includes("فيديوهات كحد"))
        ? error.message
        : "تعذر إرسال الملف أو مرفقاته. تحقق من الاتصال وحاول مرة أخرى.");
    } finally { setBusy(false); }
  };

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#f8f7f2] text-sm text-stone-600 dark:bg-[#131916] dark:text-stone-400">جارٍ التحقق من الحساب...</main>;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f8f7f2] px-5 py-12 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/workspace" className="text-sm text-[#527764] underline underline-offset-4">العودة إلى مساحة المساهم</Link>
        <p className="mt-8 text-xs tracking-[.2em] text-[#98704b]">المشاركة في حفظ الذاكرة</p>
        <h1 className="mt-3 text-3xl font-bold">إضافة ملف شخص</h1>
        <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-400">يُستخدم الملف لتجميع المعلومات والشهادات المرتبطة بشخص، ويمكن ربطه بقضية عامة أو توثيقه بشكل مستقل.</p>

        {message && <div role="status" className="mt-5 rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-950/30 dark:text-emerald-100">{message}</div>}
        {errorMessage && <div role="alert" className="mt-5 rounded-xl border border-rose-700/25 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900 dark:border-rose-400/20 dark:bg-rose-950/30 dark:text-rose-100">{errorMessage}</div>}
        {preview && <div role="status" className="mt-5 rounded-xl border border-[#d2c29d] bg-[#f4efdf] px-4 py-4 text-sm leading-7 dark:border-stone-700 dark:bg-stone-900"><p className="font-semibold">معاينة الملف: {preview.title}</p>{preview.caseTitles.length > 0 && <p className="mt-1">القضايا المرتبطة: {preview.caseTitles.join("، ")}</p>}{preview.location && <p className="mt-1">الموقع: {preview.location}</p>}{preview.description && <p className="mt-1 whitespace-pre-wrap">{preview.description}</p>}<p className="mt-2 text-xs text-stone-600 dark:text-stone-400">بعد التأكيد يُرسل الملف إلى الإدارة؛ لا يظهر للعامة قبل اعتماده.</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void sendFile()} className="rounded-lg bg-[#194537] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ الإرسال…" : "تأكيد الإرسال للمراجعة"}</button><button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-stone-400 px-4 py-2 text-sm">العودة للتعديل</button></div></div>}

        <form data-person-file-form onSubmit={showPreview} className="mt-6 space-y-6 rounded-3xl border border-[#dfe2d9] bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-[#1a211d] sm:p-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">معلومات الملف الأولية</h2>
            <label className="block text-sm font-medium">عنوان الملف
              <input required maxLength={180} name="title" placeholder="الاسم أو عنوان تعريفي للملف" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
            <label className="block text-sm font-medium">معلومات أولية <span className="font-normal text-stone-500">(اختياري)</span>
              <textarea maxLength={4000} name="description" rows={5} placeholder="اكتب معلومات تمهيدية ومصادرها إن وجدت. تبقى المعلومات قيد المراجعة." className="mt-2 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 leading-7 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
          </section>

          <section className="space-y-4 border-t border-stone-100 pt-6 dark:border-stone-800">
            <div><h2 className="text-lg font-semibold">القضايا المرتبطة بالشخص</h2><p className="mt-1 text-sm text-stone-500">يمكن ربط ملف الشخص بأكثر من قضية منشورة، وسيظهر الملف تحت كل قضية.</p></div>
            <CaseSearchPicker selected={selectedCases} onChange={setSelectedCases} />
          </section>

          <section className="space-y-4 border-t border-stone-100 pt-6 dark:border-stone-800">
            <div><h2 className="text-lg font-semibold">الموقع الجغرافي</h2><p className="mt-1 text-sm text-stone-500">اختياري؛ اتركه فارغاً إذا لم يكن معروفاً أو لا ينطبق على الملف.</p></div>
            <GeographySelects idPrefix="file-location" />
          </section>

          <ArchiveMediaFields key={formResetKey} />

          <section className="rounded-xl border border-[#e4dfd2] bg-[#f7f5ee] p-4 text-sm leading-7 dark:border-stone-700 dark:bg-stone-900">
            <h2 className="font-semibold">تنبيه توثيقي</h2>
            <p className="mt-1 text-stone-600 dark:text-stone-400">إنشاء الملف لا يعني ثبوت اتهام أو صدور حكم. ستُعرض المعلومات بعد اعتماد آلية التحقق والمراجعة، مع توضيح مصادرها ومستوى توثيقها.</p>
          </section>

          <button type="submit" className="w-full rounded-xl bg-[#194537] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#255c49] dark:bg-[#c0dec2] dark:text-[#13271f]">معاينة بيانات الملف</button>
          <p className="text-center text-xs leading-6 text-stone-500">المعاينة لا تحفظ البيانات؛ بعد التأكيد يُرسل الملف ومرفقاته إلى الإدارة للمراجعة.</p>
        </form>
      </div>
    </main>
  );
}
