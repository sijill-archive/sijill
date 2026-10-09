"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Notice = { id: string; title: string; body: string; published_at: string | null };
const READ_KEY = "sijill-read-broadcasts";
const LEGACY_DISMISSED_PREFIX = "sijill-dismissed-broadcast-";

function readStoredIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function publishedLabel(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function BroadcastNotice() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const readIdsRef = useRef(readIds);
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const ids = readStoredIds();
    readIdsRef.current = ids;
    setReadIds(ids);
  }, []);

  const loadNotices = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    const { data, error } = await supabase.from("sijill_broadcast_notifications")
      .select("id,title,body,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(30);
    if (error || !data) return;

    const rows = data as Notice[];
    const dismissed = readStoredIds();
    rows.forEach((notice) => {
      if (localStorage.getItem(`${LEGACY_DISMISSED_PREFIX}${notice.id}`) === "yes") dismissed.add(notice.id);
    });
    readIdsRef.current = dismissed;
    setReadIds(dismissed);
    setNotices(rows);

    const known = knownIdsRef.current;
    if (known === null) {
      knownIdsRef.current = new Set(rows.map((notice) => notice.id));
      setActiveNotice(rows.find((notice) => !dismissed.has(notice.id)) ?? null);
    } else {
      const fresh = rows.filter((notice) => !known.has(notice.id));
      rows.forEach((notice) => known.add(notice.id));
      const latestFresh = fresh.find((notice) => !dismissed.has(notice.id));
      if (latestFresh) setActiveNotice(latestFresh);
    }
  }, []);

  useEffect(() => {
    void loadNotices();
    const timer = window.setInterval(() => void loadNotices(), 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void loadNotices(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadNotices]);

  const markRead = (id: string) => {
    const next = new Set(readIdsRef.current);
    next.add(id);
    readIdsRef.current = next;
    setReadIds(next);
    localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    localStorage.setItem(`${LEGACY_DISMISSED_PREFIX}${id}`, "yes");
  };

  const closeNotice = (notice: Notice) => {
    markRead(notice.id);
    setActiveNotice((current) => current?.id === notice.id ? null : current);
  };

  const unreadCount = notices.reduce((count, notice) => count + (readIds.has(notice.id) ? 0 : 1), 0);

  return <>
    <div className="fixed left-5 top-[4.75rem] z-[52]" dir="rtl">
      <button
        type="button"
        aria-label={`الإشعارات${unreadCount ? `، ${unreadCount} غير مقروء` : ""}`}
        aria-expanded={open}
        aria-controls="sijill-notification-list"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-11 place-items-center rounded-full border border-stone-300/70 bg-white/80 text-[#234d3f] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527764] dark:border-white/10 dark:bg-[#17211c]/90 dark:text-stone-100 dark:hover:bg-[#223129]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#b55742] px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "٩+" : new Intl.NumberFormat("ar").format(unreadCount)}</span>}
      </button>

      <AnimatePresence>
        {open && <>
          <motion.button
            type="button"
            aria-label="إغلاق قائمة الإشعارات"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] cursor-default bg-black/10"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.aside
            id="sijill-notification-list"
            role="dialog"
            aria-label="الإشعارات المرسلة"
            dir="rtl"
            className="absolute left-0 top-14 z-[61] w-[min(92vw,24rem)] overflow-hidden rounded-2xl border border-[#b69a6d]/40 bg-[#fbfaf5] text-[#1d2822] shadow-2xl dark:bg-[#17211c] dark:text-stone-100"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
          >
            <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-white/10">
              <div><h2 className="font-bold">إشعارات سِجِلّ</h2><p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{unreadCount ? `${new Intl.NumberFormat("ar").format(unreadCount)} غير مقروء` : "كل الإشعارات مقروءة"}</p></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="grid size-8 place-items-center rounded-full text-lg text-stone-500 hover:bg-black/5 dark:hover:bg-white/10">×</button>
            </header>
            <ul className="max-h-[min(65vh,28rem)] divide-y divide-stone-200 overflow-y-auto dark:divide-white/10">
              {notices.map((notice) => <li key={notice.id}>
                <button type="button" onClick={() => { setActiveNotice(notice); setOpen(false); markRead(notice.id); }} className="block w-full px-4 py-3 text-right transition hover:bg-[#eee9dc] dark:hover:bg-white/5">
                  <span className="flex items-center justify-between gap-3"><span className="font-semibold">{notice.title}</span>{!readIds.has(notice.id) && <span className="size-2 shrink-0 rounded-full bg-[#b55742]" aria-label="غير مقروء"/>}</span>
                  <span className="mt-1 block line-clamp-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{notice.body}</span>
                  {notice.published_at && <time dateTime={notice.published_at} className="mt-2 block text-[10px] text-stone-500">{publishedLabel(notice.published_at)}</time>}
                </button>
              </li>)}
              {notices.length === 0 && <li className="px-4 py-8 text-center text-sm text-stone-500">لا توجد إشعارات مرسلة بعد.</li>}
            </ul>
          </motion.aside>
        </>}
      </AnimatePresence>
    </div>

    <AnimatePresence>
      {activeNotice && <>
        <motion.button
          type="button"
          aria-label="إغلاق الإشعار"
          onClick={() => closeNotice(activeNotice)}
          className="fixed inset-0 z-[79] bg-black/45 backdrop-blur-[2px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        />
        <div className="pointer-events-none fixed inset-0 z-[80] grid place-items-center overflow-hidden p-4">
        <motion.aside
          key={activeNotice.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="broadcast-notice-title"
          dir="rtl"
          className="pointer-events-auto w-[min(94vw,54rem)]"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: "100%" }}
          transition={{ type: "spring", damping: 27, stiffness: 250 }}
        >
          <div className="relative overflow-hidden bg-[#c5a455] p-[2px] shadow-[0_24px_80px_rgba(0,0,0,.35)] [clip-path:polygon(0_0,calc(100%_-_28px)_0,100%_50%,calc(100%_-_28px)_100%,0_100%,18px_50%)]">
            <article className="relative overflow-hidden bg-[#fbfaf5] px-7 py-7 text-[#17211c] [clip-path:polygon(0_0,calc(100%_-_27px)_0,100%_50%,calc(100%_-_27px)_100%,0_100%,18px_50%)] sm:px-12 sm:py-9">
              <span aria-hidden="true" className="absolute inset-y-0 right-0 w-2 bg-[#e0b83e] [clip-path:polygon(0_0,100%_0,100%_100%,0_100%,55%_50%)]"/>
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-[10px] font-bold tracking-[.2em] text-[#8b7136]">إشعار من إدارة سِجِلّ</p>
                <h2 id="broadcast-notice-title" className="mt-2 text-xl font-bold sm:text-3xl">{activeNotice.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-700 sm:text-base sm:leading-8">{activeNotice.body}</p>
                {activeNotice.published_at && <time dateTime={activeNotice.published_at} className="mt-4 block text-xs text-stone-500">{publishedLabel(activeNotice.published_at)}</time>}
                <button type="button" onClick={() => closeNotice(activeNotice)} className="mt-5 rounded-full bg-[#17211c] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#294638]">فهمت</button>
              </div>
            </article>
          </div>
        </motion.aside>
        </div>
      </>}
    </AnimatePresence>
  </>;
}
