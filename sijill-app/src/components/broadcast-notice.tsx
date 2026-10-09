"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Notice = { id: string; title: string; body: string; published_at: string | null };

export function BroadcastNotice() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    void supabase.from("sijill_broadcast_notifications").select("id,title,body,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(10).then(({ data }) => {
      const pending = ((data ?? []) as Notice[]).filter((item) => localStorage.getItem(`sijill-dismissed-broadcast-${item.id}`) !== "yes");
      setNotices(pending);
    });
  }, []);
  const notice = notices[0];
  if (!notice) return null;
  return <aside dir="rtl" role="status" className="fixed inset-x-3 bottom-4 z-[80] mx-auto max-w-xl rounded-2xl border border-[#c0dec2]/30 bg-[#17211c] p-4 text-[#f2f1e9] shadow-2xl sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[min(92vw,34rem)]"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] text-[#c0dec2]">إشعار من إدارة سِجِلّ</p><h2 className="mt-1 font-semibold">{notice.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-300">{notice.body}</p></div><button type="button" aria-label="إغلاق الإشعار" onClick={() => { localStorage.setItem(`sijill-dismissed-broadcast-${notice.id}`, "yes"); setNotices((current) => current.slice(1)); }} className="rounded-lg border border-white/15 px-2 py-1 text-sm">×</button></div></aside>;
}
