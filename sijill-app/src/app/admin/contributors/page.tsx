"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AdminContributorsPage() {
  const [allowed, setAllowed] = useState(false);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [profiles, setProfiles] = useState<{ user_id: string; display_name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setError("تعذر الاتصال بقاعدة البيانات."); setLoading(false); return; }
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: role } = user ? await supabase.from("sijill_user_roles").select("role").eq("user_id", user.id).maybeSingle() : { data: null };
      if (!alive) return;
      if (role?.role !== "owner") { setError("سجل المساهمين التفصيلي متاح للمالك فقط."); setLoading(false); return; }
      setAllowed(true);
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    setLoading(true); setError("");
    let request = supabase.from("sijill_public_profiles").select("user_id,display_name", { count: "exact" });
    if (search) request = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search) ? request.eq("user_id", search) : request.ilike("display_name", `%${search}%`);
    void request.order("display_name").order("user_id").range(page * 20, (page + 1) * 20 - 1).then(({ data, count, error: loadError }) => {
      if (!alive) return;
      if (loadError) { setProfiles([]); setError("تعذر تحميل قائمة المساهمين."); }
      else { setProfiles(data ?? []); setTotal(count ?? 0); }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [allowed, search, page]);
  return <section dir="rtl"><h1 className="text-2xl font-bold">المساهمون وسجل النشاط</h1><p className="mt-3 text-sm leading-7 text-stone-400">افتح حساب المساهم لمراجعة قضاياه وملفاته وشهاداته وجميع الحركات المسجلة على محتواه.</p>{allowed && <form onSubmit={(event) => { event.preventDefault(); setSearch(query.trim()); setPage(0); }} className="mt-6 flex gap-3"><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="البحث باسم المساهم أو معرّف الحساب" placeholder="اسم المساهم أو معرّف الحساب" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#17211c] px-4 py-3 text-sm"/><button className="rounded-xl bg-[#c0dec2] px-5 py-3 text-sm text-[#14251d]">بحث</button></form>}{error && <p role="alert" className="mt-6 text-sm text-amber-200">{error}</p>}{loading ? <p className="py-10 text-stone-400">جارٍ تحميل المساهمين…</p> : allowed && !error && <><ul className="mt-6 grid gap-3 sm:grid-cols-2">{profiles.map((profile) => <li key={profile.user_id}><Link href={`/admin/contributors/${profile.user_id}`} className="block rounded-xl border border-white/10 bg-[#17211c] p-5 hover:border-[#c0dec2]/40"><h2 className="font-semibold">{profile.display_name}</h2><p className="mt-2 break-all text-[10px] text-stone-500" dir="ltr">{profile.user_id}</p><span className="mt-3 block text-xs text-[#c0dec2]">عرض المساهمات وسجل الحركات ←</span></Link></li>)}</ul>{profiles.length === 0 && <p className="py-10 text-sm text-stone-400">لا توجد حسابات مطابقة.</p>}{total > 20 && <div className="mt-5 flex items-center justify-between text-sm"><button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40">السابق</button><span>الصفحة {page + 1} من {Math.ceil(total / 20)}</span><button disabled={(page + 1) * 20 >= total} onClick={() => setPage(page + 1)} className="rounded-lg border border-white/15 px-4 py-2 disabled:opacity-40">التالي</button></div>}</>}</section>;
}
