"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const actions = [
  { title: "إضافة قضية", description: "إنشاء سجل لحدث عام وربط الملفات والشهادات به.", href: "/cases/new" },
  { title: "إضافة ملف", description: "إنشاء ملف شخص وربطه بقضية أو توثيق مستقل." },
  { title: "شهاداتي", description: "مراجعة الشهادات التي أرسلتها أو ساهمت بها.", href: "/testimonies" },
  { title: "الصندوق الوارد", description: "رسائل الإدارة وإشعارات مراجعة المساهمات." },
  { title: "مخاطبة الإدارة", description: "إرسال طلب تعديل أو بلاغ أو استفسار." },
  { title: "حسابي", description: "مراجعة بيانات الحساب وإعداداته." },
];

export default function WorkspacePage() {
  const router = useRouter();
  const [requestedAdd, setRequestedAdd] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const add = new URLSearchParams(window.location.search).get("add");
    if (add === "case" || add === "file") setRequestedAdd(add);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { router.replace("/account?mode=login"); return; }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else router.replace("/account?mode=login");
    });
  }, [router]);
  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#f8f7f2] text-sm text-stone-600 dark:bg-[#131916] dark:text-stone-400">جارٍ التحقق من الحساب...</main>;
  return (
    <main dir="rtl" className="min-h-screen bg-[#f8f7f2] px-5 py-12 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-[#527764] underline underline-offset-4">العودة إلى الصفحة الرئيسية</Link>
        <h1 className="mt-8 text-3xl font-bold">مساحة المساهم</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600 dark:text-stone-400">تم تأكيد تسجيل الدخول. هذه خيارات حسابك؛ سنفعّل نماذج إضافة القضايا والملفات ونظام المراسلات بعد تجهيز صفحاتها وربطها بقاعدة البيانات.</p>
        {requestedAdd === "case" || requestedAdd === "file" ? <p role="status" className="mt-5 rounded-xl border border-[#d2c29d] bg-[#f4efdf] px-4 py-3 text-sm leading-6 dark:border-stone-700 dark:bg-stone-900">تم توجيهك إلى خيار إضافة {requestedAdd === "case" ? "قضية" : "ملف"}. سيُبنى نموذج الإضافة في الخطوة التالية.</p> : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {actions.map((action) => {
            const card = <><h2 className="font-semibold">{action.title}</h2><p className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-400">{action.description}</p>{!action.href && <span className="mt-4 inline-block text-xs text-[#98704b]">سيُفعّل في المرحلة التالية</span>}</>;
            return action.href
              ? <Link key={action.title} href={action.href} className="rounded-2xl border border-[#dfe2d9] bg-white p-5 transition hover:border-[#8aa291] dark:border-stone-800 dark:bg-[#1a211d]">{card}</Link>
              : <section key={action.title} className="rounded-2xl border border-[#dfe2d9] bg-white/60 p-5 dark:border-stone-800 dark:bg-[#1a211d]/60">{card}</section>;
          })}
        </div>
        <p className="mt-8 rounded-xl border border-[#e4dfd2] bg-[#f1eee5] px-4 py-3 text-xs leading-6 text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">تُضاف الشهادة دائماً داخل قضية أو ملف شخصي؛ المحافظة والمنطقة تستخدمان لتصفية البحث فقط.</p>
      </div>
    </main>
  );
}
