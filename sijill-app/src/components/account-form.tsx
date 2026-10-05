"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { SITE_URL } from "@/lib/site-url";

type AccountMode = "signup" | "login" | "verified" | "recovery" | "update-password";

const governorates = [
  "دمشق", "ريف دمشق", "حلب", "حمص", "حماة", "اللاذقية", "طرطوس", "إدلب",
  "دير الزور", "الرقة", "الحسكة", "درعا", "السويداء", "القنيطرة",
];

export function AccountForm({ mode, nextPath = "/workspace" }: { mode: AccountMode; nextPath?: string }) {
  const signup = mode === "signup";
  const verified = mode === "verified";
  const recovery = mode === "recovery";
  const updatePassword = mode === "update-password";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    if (updatePassword) return;
    if (recovery) return;
    if (!verified) {
      if (signup) return;
      let active = true;
      void supabase.auth.getSession().then(({ data }) => {
        if (active && data.session) router.replace(nextPath);
      });
      return () => { active = false; };
    }
    const savedPath = window.localStorage.getItem("sijill_after_auth");
    const destination = savedPath === "/cases/new" || savedPath === "/workspace?add=file" || savedPath === "/admin" ? savedPath : nextPath;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        window.localStorage.removeItem("sijill_after_auth");
        router.replace(destination);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.localStorage.removeItem("sijill_after_auth");
        router.replace(destination);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [verified, signup, recovery, updatePassword, router, nextPath]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setCanResendConfirmation(false);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setErrorMessage("لم نعثر على إعدادات Supabase. تأكد من حفظ ملف .env.local ثم أعد تشغيل الموقع.");
      return;
    }

    if (recovery && !email.trim()) {
      setErrorMessage("اكتب بريدك الإلكتروني أولاً.");
      return;
    }
    if ((signup || (!recovery && !updatePassword)) && password.length < 8) {
      setErrorMessage("يجب أن تتكون كلمة المرور من 8 أحرف أو أرقام على الأقل.");
      return;
    }
    if (signup && password !== confirmPassword) {
      setErrorMessage("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (updatePassword && (newPassword.length < 8 || newPassword !== confirmNewPassword)) {
      setErrorMessage(newPassword.length < 8 ? "يجب أن تتكون كلمة المرور من 8 أحرف أو أرقام على الأقل." : "كلمتا المرور الجديدتان غير متطابقتين.");
      return;
    }
    if (signup && !acceptedTerms) {
      setErrorMessage("يرجى الموافقة على الشروط والأحكام للمتابعة.");
      return;
    }

    setBusy(true);
    try {
      if (recovery) {
        window.localStorage.setItem("sijill_after_auth", nextPath);
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${SITE_URL}/account?mode=update-password`,
        });
        if (error) throw error;
        setMessage("إذا كان هذا البريد مرتبطاً بحساب، فستصلك رسالة فيها رابط آمن لتغيير كلمة المرور. افحص البريد غير المرغوب فيه أيضاً.");
        return;
      }
      if (updatePassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        const savedPath = window.localStorage.getItem("sijill_after_auth");
        const destination = savedPath === "/cases/new" || savedPath === "/workspace?add=file" || savedPath === "/admin" ? savedPath : nextPath;
        window.localStorage.removeItem("sijill_after_auth");
        router.replace(destination);
        return;
      }

      if (signup) window.localStorage.setItem("sijill_after_auth", nextPath);
      const { data, error } = signup
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: `${SITE_URL}/account?mode=verified`,
              data: { first_name: firstName.trim(), last_name: lastName.trim(), date_of_birth: birthDate, governorate },
            },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        const needsConfirmation = !signup && (error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed"));
        setCanResendConfirmation(needsConfirmation);
        setErrorMessage(needsConfirmation
          ? "هذا الحساب لم يؤكد بريده بعد. أعد إرسال رسالة التأكيد من الزر أدناه ثم افتح الرابط في بريدك."
          : signup
            ? "تعذر إنشاء الحساب. تحقق من البريد وكلمة المرور، أو جرّب تسجيل الدخول إذا كان البريد مسجلاً مسبقاً."
            : "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور أولاً.");
        return;
      }
      if (!signup && data.session) {
        window.localStorage.removeItem("sijill_after_auth");
        router.replace(nextPath);
        return;
      }
      setMessage(`أرسلنا رسالة تأكيد إلى ${email.trim()}. افتحها واضغط رابط التأكيد، ثم ستنتقل إلى المنصة.`);
    } catch {
      setErrorMessage(recovery
        ? "تعذر إرسال رابط تغيير كلمة المرور الآن. تحقق من البريد وحاول مرة أخرى."
        : updatePassword
          ? "تعذر تغيير كلمة المرور. افتح رابط الاستعادة الأحدث الذي وصلك ثم حاول مرة أخرى."
          : "تعذر الاتصال بخدمة الحساب الآن. حاول مرة أخرى بعد قليل.");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !email.trim()) {
      setErrorMessage("اكتب البريد الإلكتروني أولاً لإرسال رسالة التأكيد إليه.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    window.localStorage.setItem("sijill_after_auth", nextPath);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: `${SITE_URL}/account?mode=verified` },
      });
      if (error) throw error;
      setCanResendConfirmation(false);
      setMessage(`أعدنا إرسال رسالة تأكيد الحساب إلى ${email.trim()}. افحص صندوق الوارد والبريد غير المرغوب فيه.`);
    } catch {
      setErrorMessage("تعذر إعادة إرسال رسالة التأكيد. تحقق من عنوان البريد وحاول بعد قليل.");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (signup && !acceptedTerms) {
      setErrorMessage("يرجى الموافقة على الشروط والأحكام للمتابعة.");
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setErrorMessage("إعدادات Supabase غير مكتملة. حاول لاحقاً أو سجّل بالبريد الإلكتروني.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    window.localStorage.setItem("sijill_after_auth", nextPath);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE_URL}/account?mode=verified` },
    });
    if (error) {
      window.localStorage.removeItem("sijill_after_auth");
      setErrorMessage("تعذر بدء الدخول عبر Google. قد يحتاج هذا الخيار إلى التفعيل في إعدادات Supabase.");
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f7f2] px-5 py-12 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9]">
      <section className="w-full max-w-lg rounded-3xl border border-[#e0e2d9] bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-[#1a211d] sm:p-9">
        <header className="text-center">
          <Link href="/" aria-label="سِجِلّ، الصفحة الرئيسية" className="inline-flex"><BrandLogo className="h-16 w-16" /></Link>
          <h1 className="mt-6 text-2xl font-semibold">{verified ? "جارٍ تسجيل الدخول" : recovery ? "نسيت كلمة المرور؟" : updatePassword ? "اختر كلمة مرور جديدة" : signup ? "إنشاء حسابك في سِجِلّ" : "مرحباً بعودتك"}</h1>
          <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-400">
            {verified ? "جارٍ إكمال التحقق وإعادتك إلى المكان الذي أردت الوصول إليه..." : recovery ? "أدخل البريد المرتبط بحسابك، وسنرسل رابطاً آمناً لاختيار كلمة مرور جديدة." : updatePassword ? "اكتب كلمة مرور جديدة ثم أكدها لإكمال استعادة الحساب." : signup ? "أنشئ حساباً للمساهمة في حفظ الشهادات والأحداث. سنرسل رابط تأكيد لبريدك." : "سجّل الدخول لمتابعة مساهماتك في الأرشيف."}
          </p>
        </header>

        {!verified && (signup || mode === "login") && <>
          <div className="mt-7 grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-sm dark:bg-stone-900">
            <Link href={`/account?mode=login&next=${encodeURIComponent(nextPath)}`} aria-current={!signup ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-center font-semibold ${!signup ? "bg-white text-[#194537] shadow-sm dark:bg-stone-800 dark:text-[#c0dec2]" : "text-stone-600 dark:text-stone-400"}`}>تسجيل الدخول</Link>
            <Link href={`/account?mode=signup&next=${encodeURIComponent(nextPath)}`} aria-current={signup ? "page" : undefined} className={`rounded-lg px-3 py-2.5 text-center font-semibold ${signup ? "bg-white text-[#194537] shadow-sm dark:bg-stone-800 dark:text-[#c0dec2]" : "text-stone-600 dark:text-stone-400"}`}>إنشاء حساب</Link>
          </div>
          {signup && <label className="mt-5 flex items-start gap-3 text-sm leading-6 text-stone-600 dark:text-stone-400">
            <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-1 size-4 accent-[#194537]" />
            <span>أوافق على <Link href="/terms" className="font-semibold text-[#194537] underline underline-offset-2 dark:text-[#c0dec2]">الشروط والأحكام</Link>.</span>
          </label>}
          <button type="button" onClick={signInWithGoogle} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold transition hover:bg-stone-50 disabled:opacity-60 dark:border-stone-700 dark:bg-[#121815] dark:hover:bg-stone-900">
            <span aria-hidden="true" className="grid size-5 place-items-center rounded-full border border-stone-300 text-xs font-bold text-[#4285f4]">G</span>المتابعة باستخدام Google
          </button>
          <div className="mt-5 flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200 dark:bg-stone-700"/><span>أو باستخدام البريد الإلكتروني</span><span className="h-px flex-1 bg-stone-200 dark:bg-stone-700"/></div>
        </>}

        {!verified && <form onSubmit={submit} className="mt-6 space-y-4">
          {signup && <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium" htmlFor="first-name">الاسم الأول
                <input id="first-name" name="given-name" autoComplete="given-name" required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none transition focus:border-[#527764] focus:ring-2 focus:ring-[#527764]/15 dark:border-stone-700 dark:bg-[#121815]" />
              </label>
              <label className="block text-sm font-medium" htmlFor="last-name">الاسم الأخير
                <input id="last-name" name="family-name" autoComplete="family-name" required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none transition focus:border-[#527764] focus:ring-2 focus:ring-[#527764]/15 dark:border-stone-700 dark:bg-[#121815]" />
              </label>
            </div>
            <label className="block text-sm font-medium" htmlFor="birth-date">تاريخ الميلاد
              <input id="birth-date" name="bday" autoComplete="bday" type="date" max={new Date().toISOString().slice(0, 10)} required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none transition focus:border-[#527764] focus:ring-2 focus:ring-[#527764]/15 dark:border-stone-700 dark:bg-[#121815]" />
            </label>
            <label className="block text-sm font-medium" htmlFor="governorate">المحافظة
              <select id="governorate" name="address-level1" required value={governorate} onChange={(event) => setGovernorate(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none transition focus:border-[#527764] focus:ring-2 focus:ring-[#527764]/15 dark:border-stone-700 dark:bg-[#121815]">
                <option value="">اختر المحافظة</option>{governorates.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </>}
          {!updatePassword && <label className="block text-sm font-medium" htmlFor="email">البريد الإلكتروني
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" dir="ltr" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-base outline-none transition focus:border-[#527764] focus:ring-2 focus:ring-[#527764]/15 dark:border-stone-700 dark:bg-[#121815]" />
          </label>}
          {updatePassword ? <>
            <label className="block text-sm font-medium" htmlFor="new-password">كلمة المرور الجديدة
              <input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} dir="ltr" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-base outline-none transition focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
            <label className="block text-sm font-medium" htmlFor="confirm-new-password">تأكيد كلمة المرور الجديدة
              <input id="confirm-new-password" type="password" autoComplete="new-password" required minLength={8} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} dir="ltr" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-base outline-none transition focus:border-[#527764] dark:border-stone-700 dark:bg-[#121815]" />
            </label>
          </> : !recovery && <label className="block text-sm font-medium" htmlFor="password">كلمة المرور
            <input id="password" name="new-password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 أحرف أو أرقام على الأقل" dir="ltr" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-base outline-none transition focus:border-[#527764] focus:ring-2 focus:ring-[#527764]/15 dark:border-stone-700 dark:bg-[#121815]" />
          </label>}
          {signup && <label className="block text-sm font-medium" htmlFor="confirm-password">تأكيد كلمة المرور
            <input id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} dir="ltr" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-base outline-none transition focus:border-[#527764] focus:ring-2 focus:ring-[#527764]/15 dark:border-stone-700 dark:bg-[#121815]" />
          </label>}
          {mode === "login" && <div className="-mt-1 text-left"><Link href={`/account?mode=recovery&next=${encodeURIComponent(nextPath)}`} className="text-xs font-semibold text-[#527764] underline underline-offset-4 dark:text-[#c0dec2]">نسيت كلمة المرور؟</Link></div>}
          {errorMessage && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{errorMessage}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#194537] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#255c49] disabled:cursor-wait disabled:opacity-60 dark:bg-[#c0dec2] dark:text-[#13271f] dark:hover:bg-[#d2e6d3]">
            {busy ? "جارٍ المعالجة…" : signup ? "إنشاء الحساب" : recovery ? "إرسال رابط الاستعادة" : updatePassword ? "حفظ كلمة المرور الجديدة" : "تسجيل الدخول"}
          </button>
          {canResendConfirmation && <button type="button" disabled={busy} onClick={resendConfirmation} className="w-full rounded-xl border border-[#527764] px-5 py-3 text-sm font-semibold text-[#194537] transition hover:bg-[#edf2ed] disabled:opacity-50 dark:border-[#769481] dark:text-[#c0dec2] dark:hover:bg-stone-800">{busy ? "جارٍ إرسال رسالة التأكيد…" : "إعادة إرسال رسالة تأكيد البريد"}</button>}
        </form>}

        {message && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{message}</p>}
        {verified && <div className="mt-7 text-center"><Link href="/account?mode=login" className="inline-flex rounded-xl bg-[#194537] px-5 py-3 text-sm font-semibold text-white hover:bg-[#255c49]">الذهاب إلى تسجيل الدخول</Link></div>}
        {(signup || mode === "login") && <div className="mt-6 text-center text-sm text-stone-600 dark:text-stone-400">
          {signup ? <>لديك حساب؟ <Link href={`/account?mode=login&next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#194537] underline underline-offset-2 dark:text-[#c0dec2]">سجّل الدخول</Link></> : <>ليس لديك حساب؟ <Link href={`/account?mode=signup&next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#194537] underline underline-offset-2 dark:text-[#c0dec2]">أنشئ حساباً</Link></>}
        </div>}
        {recovery && <div className="mt-6 text-center text-sm"><Link href={`/account?mode=login&next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#194537] underline dark:text-[#c0dec2]">العودة إلى تسجيل الدخول</Link></div>}
        <div className="mt-5 text-center"><Link href="/" className="text-xs text-stone-500 underline underline-offset-2 hover:text-[#194537] dark:hover:text-[#c0dec2]">العودة إلى الصفحة الرئيسية</Link></div>
      </section>
    </main>
  );
}
