"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AccessState = "checking" | "allowed" | "denied" | "setup" | "error";
type StaffRole = "owner" | "editor";

const staffItems = [
  { label: "لوحة التحكم", href: "/admin", icon: "⌂" },
  { label: "طلبات التوثيق", href: "/admin/verification", icon: "✓" },
  { label: "القضايا والملفات", href: "/admin/archive", icon: "▤" },
  { label: "التقارير", href: "/admin/reports", icon: "▧" },
  { label: "الرسائل", href: "/admin/messages", icon: "✉" },
];

const ownerItems = [
  { label: "المساهمون وسجل النشاط", href: "/admin/contributors", icon: "◎" },
  { label: "الإشعارات", href: "/admin/notifications", icon: "◉" },
  { label: "الإعدادات", href: "/admin/settings", icon: "⚙" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState<AccessState>("checking");
  const [role, setRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setAccess("setup");
      return;
    }
    let active = true;

    const verifyAccess = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        router.replace("/account?mode=login&next=%2Fadmin");
        return;
      }

      const { data, error } = await supabase
        .from("sijill_user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setAccess(error.code === "PGRST205" || error.code === "42P01" ? "setup" : "error");
        return;
      }
      if (data?.role === "owner" || data?.role === "editor") {
        setRole(data.role);
        setAccess("allowed");
      } else {
        setAccess("denied");
      }
    };

    void verifyAccess();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void verifyAccess(); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [router]);

  if (access === "checking") return <main className="grid min-h-screen place-items-center bg-[#101714] text-sm text-stone-300">جارٍ التحقق من صلاحية الدخول إلى لوحة الإدارة...</main>;
  if (access !== "allowed") {
    const setup = access === "setup";
    return <main dir="rtl" className="grid min-h-screen place-items-center bg-[#101714] px-5 text-stone-100">
      <section className="max-w-lg rounded-3xl border border-white/10 bg-[#17211c] p-7 text-center shadow-2xl">
        <BrandLogo tone="white" className="mx-auto h-16 w-16" />
        <h1 className="mt-5 text-xl font-semibold">{setup ? "إعداد Backend سِجِلّ" : access === "denied" ? "هذه المنطقة للمشرفين والمحررين" : "تعذر التحقق من الصلاحية"}</h1>
        <p className="mt-3 text-sm leading-7 text-stone-300">{setup ? "تحتاج قاعدة البيانات إلى ترحيل الإدارة قبل استخدام هذه الصفحة. راجع ملف supabase/README.md واتبع خطوة الإعداد." : access === "denied" ? "حسابك مسجل، لكنه لا يحمل دور مالك أو محرر في النظام." : "تعذر الاتصال بقاعدة البيانات. تحقق من إعداد Supabase ثم أعد المحاولة."}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => window.location.reload()} className="rounded-xl bg-[#c0dec2] px-4 py-2.5 text-sm font-semibold text-[#14251d]">إعادة المحاولة</button>
          <Link href="/" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-stone-200">العودة للموقع</Link>
        </div>
      </section>
    </main>;
  }

  return <div dir="rtl" className="min-h-screen bg-[#101714] text-[#f2f1e9]">
    <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col border-l border-white/10 bg-[#141c18] p-5 lg:flex">
      <Link href="/admin" className="flex items-center gap-3 rounded-xl p-2" aria-label="لوحة إدارة سِجِلّ">
        <BrandLogo tone="white" className="h-12 w-12" />
        <span><strong className="block text-sm">سِجِلّ</strong><small className="text-xs text-stone-400">لوحة الإدارة</small></span>
      </Link>
      <p className="mt-9 px-3 text-[10px] font-semibold tracking-[.2em] text-stone-500">إدارة الأرشيف</p>
      <nav className="mt-3 grid gap-1" aria-label="أقسام لوحة الإدارة">
        {staffItems.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${pathname === item.href ? "bg-[#243b30] text-[#d8ebd6]" : "text-stone-300 hover:bg-white/5"}`}><span className="grid size-7 place-items-center rounded-lg bg-white/5 text-base">{item.icon}</span>{item.label}</Link>)}
      </nav>
      {role === "owner" && <><p className="mt-8 px-3 text-[10px] font-semibold tracking-[.2em] text-stone-500">للمالك فقط</p><nav className="mt-3 grid gap-1" aria-label="إعدادات المالك">{ownerItems.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${pathname === item.href ? "bg-[#243b30] text-[#d8ebd6]" : "text-stone-300 hover:bg-white/5"}`}><span className="grid size-7 place-items-center rounded-lg bg-white/5 text-base">{item.icon}</span>{item.label}</Link>)}</nav></>}
      <div className="mt-auto border-t border-white/10 pt-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-stone-300"><i className="size-1.5 rounded-full bg-emerald-400" />{role === "owner" ? "المالك" : "محرر"}</span>
        <Link href="/" className="mt-3 block rounded-xl px-3 py-2 text-sm text-stone-400 hover:bg-white/5 hover:text-white">← العودة إلى الموقع</Link>
        <button onClick={async () => { await createBrowserSupabaseClient()?.auth.signOut(); router.replace("/account?mode=login"); }} className="mt-1 w-full rounded-xl px-3 py-2 text-right text-sm text-stone-400 hover:bg-white/5 hover:text-white">تسجيل الخروج</button>
      </div>
    </aside>
    <div className="lg:mr-64">
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between border-b border-white/10 bg-[#101714]/90 px-5 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3 lg:hidden"><BrandLogo tone="white" className="h-9 w-9" /><span className="text-sm font-semibold">لوحة إدارة سِجِلّ</span></div>
        <div className="hidden text-sm text-stone-400 lg:block">الإدارة <span className="mx-2 text-stone-600">/</span> {pathname === "/admin" ? "لوحة التحكم" : [...staffItems, ...ownerItems].find((item) => item.href === pathname)?.label ?? "الإدارة"}</div>
        <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-stone-300 lg:mr-auto">{role === "owner" ? "حساب المالك" : "حساب محرر"}</span>
        <Link href="/" className="mr-3 text-xs text-[#c0dec2] underline underline-offset-4 lg:hidden">الموقع</Link>
        <nav aria-label="التنقل في الإدارة" className="order-3 flex w-full gap-2 overflow-x-auto pb-2 lg:hidden">{[...staffItems, ...(role === "owner" ? ownerItems : [])].map((item) => <Link key={item.href} href={item.href} className={`shrink-0 rounded-lg border px-3 py-2 text-xs ${pathname === item.href ? "border-[#c0dec2]/40 bg-[#243b30] text-[#d8ebd6]" : "border-white/10 text-stone-300"}`}>{item.label}</Link>)}</nav>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">{children}</main>
    </div>
  </div>;
}
