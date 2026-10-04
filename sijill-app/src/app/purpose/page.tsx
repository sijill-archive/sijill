import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "غايتنا | سِجِلّ",
  description: "غايتنا في حفظ ذاكرة السوريين وتوثيق الانتهاكات والشهادات.",
};

const paragraphs = [
  "ما قامت ثورتنا إلا رفضًا للظلم الذي أحاط بنا، وقد سُفكت في سبيل رفعه دماء غزيرة لم يسلم منها طفل ولا شيخ ولا امرأة ولا رجل.",
  "وقد منَّ الله علينا بنصر ثورتنا المباركة، وما كان لنا أن نرد الظلم بظلم، أو أن نحمل الأبرياء وزر غيرهم،",
  "أما من أوغلوا في دمائنا، فقد أصبح من حقنا وواجبنا أن نوثق جرائمهم، وأن تُحفظ في سِجِلّ يبقى ما شاء الله له أن يبقى شاهدًا على إجرامهم، لتعرف الأجيال من هم الذين حكموا هذا الوطن بالحديد والنار.",
  "وحتى لا يُنسى الضحايا، ولا تُطمس الذاكرة، ولا تُطمس الحقيقة.",
];

export default function PurposePage() {
  return (
    <main className="min-h-screen bg-[#f8f7f2] text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo className="h-12 w-12" /></Link>
        <Link href="/" className="text-sm text-stone-600 transition hover:text-[#194537] dark:text-stone-300 dark:hover:text-[#c0dec2]">العودة إلى الرئيسية</Link>
      </header>

      <article className="mx-auto max-w-4xl px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
        <p className="text-xs tracking-[.2em] text-[#98704b]">سِجِلّ</p>
        <h1 className="mt-3 text-3xl font-bold text-[#194537] dark:text-stone-100 sm:text-4xl">غايتنا</h1>

        <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-950 sm:p-10">
          <p className="text-center font-serif text-xl font-semibold leading-10 text-[#194537] dark:text-[#c0dec2] sm:text-2xl">بسم الله الرحمن الرحيم</p>
          <div className="mt-7 space-y-5 text-base leading-9 text-stone-700 dark:text-stone-300 sm:text-lg sm:leading-10">
            <p>{paragraphs[0]}</p>
            <p>
              {paragraphs[1]}{" "}
              <span className="whitespace-nowrap font-serif text-[#194537] dark:text-[#c0dec2]">﴿ولا تزر وازرة وزر أخرى﴾.</span>
            </p>
            <p>{paragraphs[2]}</p>
            <p className="border-r-2 border-[#b99a6a] pr-4 font-semibold text-[#194537] dark:text-[#c0dec2]">{paragraphs[3]}</p>
          </div>
        </section>
      </article>

      <footer className="border-t border-stone-200 px-5 py-6 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">سِجِلّ © 2026</footer>
    </main>
  );
}
