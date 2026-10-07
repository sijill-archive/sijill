"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GeographySelects } from "@/components/geography-selects";
import { geography } from "@/lib/geography";

const eventTypes = ["قصف أو هجوم", "اعتقال أو اختفاء", "تهجير أو نزوح", "انتهاك", "حدث مدني", "أخرى"];

export default function NewCasePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [approximateDate, setApproximateDate] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { router.replace("/account?mode=login&next=%2Fcases%2Fnew"); return; }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else router.replace("/account?mode=login&next=%2Fcases%2Fnew");
    });
  }, [router]);

  const submitCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setErrorMessage("");
    const values = new FormData(event.currentTarget);
    const governorateName = String(values.get("governorate") ?? "");
    const districtId = String(values.get("district") ?? "");
    const cityChoice = String(values.get("city") ?? "");
    const district = geography.governorates.find((item) => item.name === governorateName)?.districts.find((item) => item.id === districtId);
    const city = cityChoice === "__other__" ? String(values.get("cityOther") ?? "").trim() : cityChoice;
    const title = String(values.get("title") ?? "").trim();
    const eventDescription = String(values.get("description") ?? "").trim();
    const firsthand = String(values.get("firsthand") ?? "").trim();
    const secondhand = String(values.get("secondhand") ?? "").trim();
    const description = [
      eventDescription,
      firsthand ? `\n\nما عاينه مقدم القضية:\n${firsthand}` : "",
      secondhand ? `\n\nمعلومات منقولة أو مصادر منشورة:\n${secondhand}` : "",
    ].filter(Boolean).join("");

    if (title.length < 3 || !district || !city || eventDescription.length < 30) {
      setErrorMessage("أكمل عنوان القضية والموقع والوصف (30 حرفاً على الأقل) قبل الإرسال.");
      return;
    }

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setErrorMessage("تعذر الاتصال بقاعدة البيانات. أعد تحميل الصفحة وحاول مرة أخرى.");
      return;
    }

    setBusy(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.replace("/account?mode=login&next=%2Fcases%2Fnew");
        return;
      }

      const eventDate = String(values.get("eventDate") ?? "");
      const { error } = await supabase.from("sijill_cases").insert({
        created_by: user.id,
        title,
        event_type: String(values.get("eventType") ?? "أخرى"),
        description,
        country: String(values.get("country") ?? "سوريا").trim() || "سوريا",
        governorate: governorateName,
        district_id: district.id,
        district_name: district.name,
        city,
        location_description: String(values.get("locationDescription") ?? "").trim() || null,
        event_date: eventDate || null,
        approximate_date: approximateDate ? String(values.get("approximateDate") ?? "").trim() || null : null,
        status: "submitted",
      });
      if (error) throw error;

      form.reset();
      setApproximateDate(false);
      setFormResetKey((key) => key + 1);
      setMessage("أُرسلت القضية بنجاح إلى لوحة الإدارة للمراجعة. لن تظهر للعامة حتى يعتمدها المالك.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Failed to submit Sijill case", error);
      setErrorMessage("لم تُحفظ القضية. تحقق من اتصال الإنترنت وحاول مرة أخرى؛ إذا تكررت المشكلة أرسل لنا لقطة للخطأ.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#f8f7f2] text-sm text-stone-600 dark:bg-[#131916] dark:text-stone-400">جارٍ التحقق من الحساب...</main>;

  return (
    <main dir="rtl" className="min-h-screen bg-[#f8f7f2] px-5 py-12 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/workspace" className="text-sm text-[#527764] underline underline-offset-4">العودة إلى مساحة المساهم</Link>
        <p className="mt-8 text-xs tracking-[.2em] text-[#98704b]">المشاركة في حفظ الذاكرة</p>
        <h1 className="mt-3 text-3xl font-bold">إضافة قضية أو حدث</h1>
        <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-400">أنشئ مدخلاً يصف حدثاً في مكان وزمان محددين. يمكن لمن عاشوا الحدث إضافة شهادات مستقلة إليه بعد مراجعته.</p>

        <section className="mt-6 rounded-2xl border border-[#d8dfd4] bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d]">
          <h2 className="font-semibold">كيف تُعرض المشاركة؟</h2>
          <p className="mt-2 text-sm leading-7 text-stone-600 dark:text-stone-400">لا يوجد تصويت بنعم أو لا. نعرض عدد الشهادات ومصدرها ونوعها، ونراجعها قبل النشر؛ فالعدد وحده لا يحسم صحة القضية. تبقى الشهادات المتعارضة ظاهرة بعد المراجعة.</p>
        </section>

        {message && <div role="status" className="mt-5 rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-950/30 dark:text-emerald-100">{message}</div>}
        {errorMessage && <div role="alert" className="mt-5 rounded-xl border border-rose-700/25 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900 dark:border-rose-400/20 dark:bg-rose-950/30 dark:text-rose-100">{errorMessage}</div>}

        <form onSubmit={submitCase} className="mt-6 space-y-6 rounded-3xl border border-[#dfe2d9] bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-[#1a211d] sm:p-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">تعريف الحدث</h2>
            <label className="block text-sm font-medium">عنوان القضية
              <input required maxLength={180} name="title" placeholder="مثال: حدث في حي بابا عمرو" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
            <label className="block text-sm font-medium">نوع الحدث
              <select required name="eventType" defaultValue="" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]"><option value="" disabled>اختر نوع الحدث</option>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select>
            </label>
          </section>

          <section className="space-y-4 border-t border-stone-100 pt-6 dark:border-stone-800">
            <h2 className="text-lg font-semibold">الموقع والتاريخ</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">الدولة
                <input required name="country" defaultValue="سوريا" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
              </label>
            </div>
            <GeographySelects key={formResetKey} required idPrefix="case-location" />
            <label className="block text-sm font-medium">وصف أدق للموقع <span className="font-normal text-stone-500">(اختياري)</span>
              <input maxLength={240} name="locationDescription" placeholder="حيّ، شارع أو معلم قريب، دون نشر عنوان سكن خاص" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block text-sm font-medium">تاريخ الحدث
                <input type="date" name="eventDate" required={!approximateDate} disabled={approximateDate} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] disabled:opacity-50 dark:border-stone-700 dark:bg-[#121815]" />
              </label>
              <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={approximateDate} onChange={(event) => setApproximateDate(event.target.checked)} className="size-4 accent-[#194537]" />التاريخ تقريبي أو غير معروف</label>
            </div>
            {approximateDate && <label className="block text-sm font-medium">السنة أو الفترة التقريبية <span className="font-normal text-stone-500">(اختياري)</span>
              <input maxLength={80} name="approximateDate" placeholder="مثال: شتاء عام 2013 أو النصف الأول من 2014" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>}
          </section>

          <section className="space-y-4 border-t border-stone-100 pt-6 dark:border-stone-800">
            <h2 className="text-lg font-semibold">تفاصيل الحدث والشهادة</h2>
            <label className="block text-sm font-medium">وصف الحدث
              <textarea required minLength={30} maxLength={8000} name="description" rows={6} placeholder="صف ما حدث، بترتيب زمني قدر الإمكان. تجنب الجزم بما لا تعرفه مباشرة." className="mt-2 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 leading-7 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
            <label className="block text-sm font-medium">ما عاينته بنفسك <span className="font-normal text-stone-500">(اختياري)</span>
              <textarea maxLength={5000} name="firsthand" rows={4} placeholder="ما الذي شاهدته أو سمعته بنفسك؟ ومتى وأين؟" className="mt-2 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 leading-7 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
            <label className="block text-sm font-medium">معلومات وصلتك من آخرين أو مصادر منشورة <span className="font-normal text-stone-500">(اختياري)</span>
              <textarea maxLength={5000} name="secondhand" rows={3} placeholder="اذكر مصدر المعلومة بوضوح إن كان متاحاً." className="mt-2 w-full resize-y rounded-xl border border-stone-300 bg-white px-4 py-3 leading-7 outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
          </section>

          <section className="space-y-4 border-t border-stone-100 pt-6 dark:border-stone-800">
            <h2 className="text-lg font-semibold">مواد ومصادر داعمة</h2>
            <p className="rounded-xl bg-stone-50 p-4 text-sm leading-7 text-stone-600 dark:bg-stone-900 dark:text-stone-400">رفع الصور والوثائق والفيديوهات وروابط YouTube سيُفعّل بعد إعداد التخزين الآمن. لا ترفق معلومات حساسة هنا الآن؛ أرسل بيانات القضية النصية فقط.</p>
          </section>

          <section className="rounded-xl border border-[#e4dfd2] bg-[#f7f5ee] p-4 text-sm leading-7 dark:border-stone-700 dark:bg-stone-900">
            <h2 className="font-semibold">بعد الإرسال</h2>
            <p className="mt-1 text-stone-600 dark:text-stone-400">تُرسل القضية للمراجعة قبل النشر. بعد قبولها يمكن للناس إضافة شهاداتهم، مع تمييز الشاهد المباشر عن المصدر المنقول. لا يُستخدم تصويت شعبي لإثبات التهمة أو نفيها.</p>
          </section>

          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#194537] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#255c49] disabled:cursor-wait disabled:opacity-60 dark:bg-[#c0dec2] dark:text-[#13271f]">{busy ? "جارٍ إرسال القضية…" : "إرسال القضية للمراجعة"}</button>
          <p className="text-center text-xs leading-6 text-stone-500">سيتم حفظ القضية كطلب مراجعة، ولن تظهر للزوار حتى يعتمدها مالك المنصة.</p>
        </form>
      </div>
    </main>
  );
}
