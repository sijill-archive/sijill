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
  const [preview, setPreview] = useState<{ title: string; eventType: string; governorate: string; district: string; city: string } | null>(null);
  const [approximateDate, setApproximateDate] = useState(false);
  const [links, setLinks] = useState([""]);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { router.replace("/account?mode=login&next=%2Fcases%2Fnew"); return; }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else router.replace("/account?mode=login&next=%2Fcases%2Fnew");
    });
  }, [router]);

  const showPreview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const governorateName = String(values.get("governorate") ?? "");
    const districtId = String(values.get("district") ?? "");
    const cityChoice = String(values.get("city") ?? "");
    const district = geography.governorates.find((item) => item.name === governorateName)?.districts.find((item) => item.id === districtId);
    setPreview({
      title: String(values.get("title") ?? ""),
      eventType: String(values.get("eventType") ?? ""),
      governorate: governorateName,
      district: district?.name ?? "",
      city: cityChoice === "__other__" ? String(values.get("cityOther") ?? "") : cityChoice,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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

        {preview && <div role="status" className="mt-5 rounded-xl border border-[#d2c29d] bg-[#f4efdf] px-4 py-4 text-sm leading-7 dark:border-stone-700 dark:bg-stone-900"><p className="font-semibold">معاينة القضية: {preview.title}</p><p className="mt-1">النوع: {preview.eventType} · الموقع: {[preview.governorate, preview.district, preview.city].filter(Boolean).join("، ")}</p><p className="mt-1 text-xs text-stone-600 dark:text-stone-400">هذه معاينة فقط؛ لم تُحفظ البيانات أو تُرفع الملفات بعد. سنربط الإرسال والمراجعة بقاعدة البيانات في مرحلة لاحقة.</p></div>}

        <form onSubmit={showPreview} className="mt-6 space-y-6 rounded-3xl border border-[#dfe2d9] bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-[#1a211d] sm:p-8">
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
            <GeographySelects required idPrefix="case-location" />
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
            <label className="block text-sm font-medium">صور أو وثائق
              <input type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={(event) => setFiles((current) => [...current.filter((file) => !file.type.startsWith("image/")), ...Array.from(event.target.files ?? [])])} className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-[#e9efe9] file:px-3 file:py-2 file:text-[#194537] dark:border-stone-700 dark:bg-[#121815] dark:file:bg-stone-800 dark:file:text-[#c0dec2]" />
            </label>
            <label className="block text-sm font-medium">فيديوهات
              <input type="file" multiple accept="video/*" onChange={(event) => setFiles((current) => [...current.filter((file) => !file.type.startsWith("video/")), ...Array.from(event.target.files ?? [])])} className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm file:ml-3 file:rounded-lg file:border-0 file:bg-[#e9efe9] file:px-3 file:py-2 file:text-[#194537] dark:border-stone-700 dark:bg-[#121815] dark:file:bg-stone-800 dark:file:text-[#c0dec2]" />
            </label>
            {files.length > 0 && <p className="text-xs leading-6 text-stone-500">الملفات المحددة: {files.map((file) => file.name).join("، ")}</p>}
            <div className="space-y-3">
              <p className="text-sm font-medium">روابط YouTube</p>
              {links.map((url, index) => <div key={index} className="flex gap-2"><input type="url" value={url} onChange={(event) => setLinks((current) => current.map((item, i) => i === index ? event.target.value : item))} placeholder="https://www.youtube.com/..." dir="ltr" className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-sm outline-none focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />{links.length > 1 && <button type="button" onClick={() => setLinks((current) => current.filter((_, i) => i !== index))} className="px-3 text-xs text-rose-700 dark:text-rose-300">حذف</button>}</div>)}
              <button type="button" onClick={() => setLinks((current) => [...current, ""])} className="text-sm font-semibold text-[#527764] underline underline-offset-4">＋ إضافة رابط آخر</button>
            </div>
          </section>

          <section className="rounded-xl border border-[#e4dfd2] bg-[#f7f5ee] p-4 text-sm leading-7 dark:border-stone-700 dark:bg-stone-900">
            <h2 className="font-semibold">بعد الإرسال</h2>
            <p className="mt-1 text-stone-600 dark:text-stone-400">تُرسل القضية للمراجعة قبل النشر. بعد قبولها يمكن للناس إضافة شهاداتهم، مع تمييز الشاهد المباشر عن المصدر المنقول. لا يُستخدم تصويت شعبي لإثبات التهمة أو نفيها.</p>
          </section>

          <button type="submit" className="w-full rounded-xl bg-[#194537] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#255c49] dark:bg-[#c0dec2] dark:text-[#13271f]">معاينة بيانات القضية</button>
          <p className="text-center text-xs leading-6 text-stone-500">المعاينة حالياً لا تحفظ البيانات ولا ترفع الملفات؛ يجري تجهيز قاعدة البيانات وخطوة المراجعة.</p>
        </form>
      </div>
    </main>
  );
}
