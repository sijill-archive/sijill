"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { GeographySelects } from "@/components/geography-selects";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { geography } from "@/lib/geography";

export default function NewFilePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<{ title: string; description: string; location: string; caseId: string; caseTitle: string } | null>(null);
  const [cases, setCases] = useState<{ id: string; title: string }[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { router.replace("/account?mode=login&next=%2Ffiles%2Fnew"); return; }
    void supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setReady(true);
        const result = await supabase.from("sijill_cases").select("id,title").eq("status", "published").order("title", { ascending: true }).limit(500);
        setCases(result.data ?? []);
        const selectedCase = new URLSearchParams(window.location.search).get("caseId");
        if (selectedCase) setSelectedCaseId(selectedCase);
      }
      else router.replace("/account?mode=login&next=%2Ffiles%2Fnew");
    });
  }, [router]);

  const showPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const cityChoice = String(values.get("city") ?? "");
    const city = cityChoice === "__other__" ? String(values.get("cityOther") ?? "") : cityChoice;
    const governorate = String(values.get("governorate") ?? "");
    const districtId = String(values.get("district") ?? "");
    const district = geography.governorates.find((item) => item.name === governorate)?.districts.find((item) => item.id === districtId);
    const caseId = String(values.get("caseId") ?? "");
    const linkedCase = cases.find((item) => item.id === caseId);
    const location = [governorate, district?.name, city].filter(Boolean).join("، ");
    setErrorMessage("");
    setMessage("");
    setPreview({
      title: String(values.get("title") ?? ""),
      description: String(values.get("description") ?? ""),
      location,
      caseId,
      caseTitle: linkedCase?.title ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sendFile = async () => {
    if (!preview || busy) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setErrorMessage("تعذر الاتصال بقاعدة البيانات."); return; }
    setBusy(true);
    setErrorMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.replace("/account?mode=login&next=%2Ffiles%2Fnew"); return; }
      const form = document.querySelector<HTMLFormElement>("form[data-person-file-form]");
      if (!form) throw new Error("Form is unavailable");
      const values = new FormData(form);
      const governorate = String(values.get("governorate") ?? "");
      const districtId = String(values.get("district") ?? "");
      const district = geography.governorates.find((item) => item.name === governorate)?.districts.find((item) => item.id === districtId);
      const cityChoice = String(values.get("city") ?? "");
      const city = cityChoice === "__other__" ? String(values.get("cityOther") ?? "").trim() : cityChoice;
      const { error } = await supabase.from("sijill_person_files").insert({
        created_by: user.id,
        title: preview.title.trim(),
        description: preview.description.trim(),
        case_id: preview.caseId || null,
        country: governorate ? "سوريا" : null,
        governorate: governorate || null,
        district_id: district?.id ?? null,
        district_name: district?.name ?? null,
        city: city || null,
        location_description: String(values.get("locationDescription") ?? "").trim() || null,
        status: "submitted",
      });
      if (error) throw error;
      setMessage("أُرسل الملف إلى لوحة الإدارة للمراجعة. سيظهر للزوار بعد اعتماده ونشره.");
      setPreview(null);
      form.reset();
      setSelectedCaseId("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Failed to submit Sijill person file", error);
      setErrorMessage("تعذر إرسال الملف. تحقق من الاتصال وحاول مرة أخرى.");
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
        {preview && <div role="status" className="mt-5 rounded-xl border border-[#d2c29d] bg-[#f4efdf] px-4 py-4 text-sm leading-7 dark:border-stone-700 dark:bg-stone-900"><p className="font-semibold">معاينة الملف: {preview.title}</p>{preview.caseTitle && <p className="mt-1">القضية المرتبطة: {preview.caseTitle}</p>}{preview.location && <p className="mt-1">الموقع: {preview.location}</p>}{preview.description && <p className="mt-1 whitespace-pre-wrap">{preview.description}</p>}<p className="mt-2 text-xs text-stone-600 dark:text-stone-400">بعد التأكيد يُرسل الملف إلى الإدارة؛ لا يظهر للعامة قبل اعتماده.</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void sendFile()} className="rounded-lg bg-[#194537] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "جارٍ الإرسال…" : "تأكيد الإرسال للمراجعة"}</button><button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-stone-400 px-4 py-2 text-sm">العودة للتعديل</button></div></div>}

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
            <div><h2 className="text-lg font-semibold">ربط الملف بقضية</h2><p className="mt-1 text-sm text-stone-500">اختياري. اختر قضية منشورة ليظهر هذا الملف تحتها في الأرشيف.</p></div>
            <label className="block text-sm font-medium">القضية المرتبطة
              <select name="caseId" value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]"><option value="">ملف مستقل دون قضية</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            </label>
            {cases.length === 0 && <p className="text-xs text-stone-500">ستظهر هنا القضايا بعد اعتمادها ونشرها.</p>}
          </section>

          <section className="space-y-4 border-t border-stone-100 pt-6 dark:border-stone-800">
            <div><h2 className="text-lg font-semibold">الموقع الجغرافي</h2><p className="mt-1 text-sm text-stone-500">اختياري؛ اتركه فارغاً إذا لم يكن معروفاً أو لا ينطبق على الملف.</p></div>
            <GeographySelects idPrefix="file-location" />
          </section>

          <section className="rounded-xl border border-[#e4dfd2] bg-[#f7f5ee] p-4 text-sm leading-7 dark:border-stone-700 dark:bg-stone-900">
            <h2 className="font-semibold">تنبيه توثيقي</h2>
            <p className="mt-1 text-stone-600 dark:text-stone-400">إنشاء الملف لا يعني ثبوت اتهام أو صدور حكم. ستُعرض المعلومات بعد اعتماد آلية التحقق والمراجعة، مع توضيح مصادرها ومستوى توثيقها.</p>
          </section>

          <button type="submit" className="w-full rounded-xl bg-[#194537] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#255c49] dark:bg-[#c0dec2] dark:text-[#13271f]">معاينة بيانات الملف</button>
          <p className="text-center text-xs leading-6 text-stone-500">المعاينة لا تحفظ البيانات؛ نعمل الآن على مراجعة شكل الملف ومحتواه قبل تفعيل الإرسال.</p>
        </form>
      </div>
    </main>
  );
}
