import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const metadata = {
  title: "إضافة شهادة | سِجِلّ",
  description: "تُضاف الشهادات من داخل القضية أو ملف الشخص المرتبط بها.",
};

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#1c2922] dark:bg-[#151916] dark:text-stone-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo className="h-12 w-12" /></Link>
        <Link href="/" className="text-sm text-stone-600 underline underline-offset-4 dark:text-stone-300">العودة إلى الخريطة</Link>
      </header>
      <section className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
        <p className="text-xs tracking-[.2em] text-[#98704b]">المساهمة في الأرشيف</p>
        <h1 className="mt-3 text-3xl font-bold text-[#194537] dark:text-stone-100 sm:text-4xl">إضافة شهادة</h1>
        <div className="mt-7 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-950 sm:p-9">
          <p className="text-base font-semibold leading-8">تُضاف الشهادة من داخل صفحة القضية أو ملف الشخص المرتبط بها.</p>
          <p className="mt-3 text-sm leading-8 text-stone-600 dark:text-stone-400">بهذا ترتبط كل شهادة بسياقها: حدث موثق أو ملف شخص. المحافظة والمنطقة والمدينة معلومات مكانية تساعد على تصفية نتائج البحث، وليست حاوية للشهادات.</p>
          <p className="mt-3 text-sm leading-8 text-stone-600 dark:text-stone-400">ابحث عن القضية أو الملف أولاً، ثم استخدم خيار «إضافة شهادة» من صفحته. ستُتاح المساهمة بعد تسجيل الدخول وتفعيل الحساب.</p>
          <Link href="/testimonies" className="mt-6 inline-flex rounded-xl bg-[#194537] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#255c49] dark:bg-[#c0dec2] dark:text-[#13271f]">استعراض الأرشيف</Link>
        </div>
      </section>
    </main>
  );
}
