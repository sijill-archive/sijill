"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const contributionPath = (kind: "case" | "file") => kind === "case" ? "/cases/new" : "/files/new";

export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [drawerWidth, setDrawerWidth] = useState(360);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSignedInEmail(data.session?.user.email ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedInEmail(session?.user.email ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const resize = () => setDrawerWidth(Math.min(window.innerWidth * 0.86, 360));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const close = () => setOpen(false);
  return <>
    <Link href="/purpose" className="fixed left-5 top-[4.75rem] z-[52] rounded-full border border-[#d9ded5] bg-[#f8f7f2]/90 px-4 py-2 text-sm font-semibold text-[#234d3f] shadow-sm backdrop-blur transition hover:border-[#9bb39f] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527764] dark:border-stone-700 dark:bg-[#171e1a]/90 dark:text-stone-200 dark:hover:bg-stone-800">
      غايتنا
    </Link>
    <motion.button type="button" aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={open} onClick={() => setOpen((value) => !value)} animate={{ x: open ? -(drawerWidth - 20) : 0 }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="fixed right-5 top-[4.75rem] z-[52] grid size-11 place-items-center rounded-full text-[#234d3f] transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527764] dark:text-stone-200 dark:hover:bg-white/10">
      <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", damping: 20, stiffness: 220 }} className="flex w-5 flex-col gap-1.5"><i className="h-px w-full bg-current"/><i className="h-px w-full bg-current"/><i className="h-px w-full bg-current"/></motion.span>
    </motion.button>
    <AnimatePresence>
      {open && <>
        <motion.button aria-label="إغلاق القائمة" className="fixed inset-0 z-50 cursor-default bg-black/30 backdrop-blur-[2px]" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <motion.aside role="dialog" aria-modal="true" aria-label="القائمة الرئيسية" className="fixed inset-y-0 right-0 z-[51] flex w-[min(86vw,360px)] flex-col overflow-y-auto bg-[#f8f7f2] p-7 shadow-2xl dark:bg-[#171e1a]" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}>
          <div className="flex items-center justify-between"><Link href="/" onClick={close} aria-label="سِجِلّ، الصفحة الرئيسية"><BrandLogo className="h-14 w-14" /></Link></div>
          <Link href="/" onClick={close} className="mt-8 rounded-xl border border-[#d9ded5] px-4 py-3 text-sm font-semibold hover:bg-white dark:border-stone-700 dark:hover:bg-stone-800">الصفحة الرئيسية</Link>
          <Link href="/purpose" onClick={close} className="mt-2 rounded-xl border border-[#d9ded5] px-4 py-3 text-sm font-semibold hover:bg-white dark:border-stone-700 dark:hover:bg-stone-800">غايتنا</Link>
          {signedInEmail ? <>
            <p className="mt-5 break-all text-xs text-stone-500" dir="ltr">{signedInEmail}</p>
            <nav aria-label="خيارات الحساب" className="mt-3 grid gap-2">
              <Link onClick={close} href={contributionPath("case")} className="rounded-xl bg-[#194537] px-4 py-3 text-sm font-semibold text-white hover:bg-[#255c49]">＋ إضافة قضية</Link>
              <Link onClick={close} href={contributionPath("file")} className="rounded-xl bg-[#194537] px-4 py-3 text-sm font-semibold text-white hover:bg-[#255c49]">＋ إضافة ملف</Link>
              <Link onClick={close} href="/testimonies" className="rounded-xl border border-[#d9ded5] px-4 py-3 text-sm font-semibold hover:bg-white dark:border-stone-700 dark:hover:bg-stone-800">شهاداتي</Link>
              <Link onClick={close} href="/workspace?tab=inbox" className="rounded-xl border border-[#d9ded5] px-4 py-3 text-sm font-semibold hover:bg-white dark:border-stone-700 dark:hover:bg-stone-800">الصندوق الوارد</Link>
              <Link onClick={close} href="/workspace?tab=support" className="rounded-xl border border-[#d9ded5] px-4 py-3 text-sm font-semibold hover:bg-white dark:border-stone-700 dark:hover:bg-stone-800">مخاطبة الإدارة</Link>
              <Link onClick={close} href="/workspace?tab=account" className="rounded-xl border border-[#d9ded5] px-4 py-3 text-sm font-semibold hover:bg-white dark:border-stone-700 dark:hover:bg-stone-800">حسابي</Link>
              <button onClick={async () => { await createBrowserSupabaseClient()?.auth.signOut(); close(); }} className="rounded-xl px-4 py-3 text-right text-sm font-semibold text-rose-800 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">تسجيل الخروج</button>
            </nav>
          </> : <div className="mt-5 grid gap-3"><Link onClick={close} href="/account?mode=login" className="rounded-xl border border-[#d9ded5] px-4 py-3 text-sm font-semibold hover:bg-white dark:border-stone-700 dark:hover:bg-stone-800">تسجيل الدخول</Link><Link onClick={close} href="/account?mode=signup" className="rounded-xl bg-[#194537] px-4 py-3 text-sm font-semibold text-white hover:bg-[#255c49]">إنشاء حساب</Link></div>}
          <p className="mt-auto pt-8 text-xs leading-6 text-stone-500 dark:text-stone-400">سِجِلّ يحفظ المعلومات وينظمها؛ ولا يحدد الذنب أو البراءة.</p>
        </motion.aside>
      </>}
    </AnimatePresence>
  </>;
}

export function ContributionButtons() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => subscription.unsubscribe();
  }, []);
  const target = (kind: "case" | "file") => signedIn ? contributionPath(kind) : `/account?mode=login&next=${encodeURIComponent(contributionPath(kind))}`;
  return <div className="flex flex-wrap gap-2" aria-label="إضافة محتوى">
    <Link href={target("case")} className="inline-flex items-center gap-2 rounded-full border border-[#c7d8c8] bg-white/80 px-4 py-2 text-xs font-semibold text-[#194537] shadow-sm transition hover:border-[#527764] hover:bg-white dark:border-stone-600 dark:bg-[#1a211d] dark:text-[#d0e4cd]">
      <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#194537] text-sm leading-none text-white dark:bg-[#c0dec2] dark:text-[#13271f]">+</span> قضية
    </Link>
    <Link href={target("file")} className="inline-flex items-center gap-2 rounded-full border border-[#c7d8c8] bg-white/80 px-4 py-2 text-xs font-semibold text-[#194537] shadow-sm transition hover:border-[#527764] hover:bg-white dark:border-stone-600 dark:bg-[#1a211d] dark:text-[#d0e4cd]">
      <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-[#194537] text-sm leading-none text-white dark:bg-[#c0dec2] dark:text-[#13271f]">+</span> ملف
    </Link>
  </div>;
}
