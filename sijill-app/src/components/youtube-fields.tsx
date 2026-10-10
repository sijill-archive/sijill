"use client";

import { useState } from "react";
const field = "mt-2 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm dark:border-stone-700 dark:bg-[#121815]";

export function YoutubeFields() {
  const [rows, setRows] = useState([0]);
  const [nextId, setNextId] = useState(1);
  return <fieldset className="space-y-3"><legend className="text-sm font-semibold">توثيق عبر YouTube</legend>
    {rows.map((id) => <div key={id} className="grid grid-cols-2 items-start gap-3 rounded-xl border border-stone-200 p-3 dark:border-stone-700 sm:grid-cols-[1fr_1.4fr_auto]">
      <label className="min-w-0 text-xs">اسم الفيديو<input name="youtube_title" maxLength={180} placeholder="مثال: توثيق أحداث الحاجز" className={field}/></label>
      <label className="min-w-0 text-xs">رابط الفيديو<input name="youtube_url" type="url" maxLength={1000} placeholder="https://www.youtube.com/watch?v=…" dir="ltr" className={field}/></label>
      <button type="button" aria-label={`إزالة توثيق YouTube رقم ${rows.indexOf(id) + 1}`} onClick={() => setRows((current) => current.filter((row) => row !== id))} className="col-span-2 justify-self-end self-end rounded-lg sm:col-span-1 border border-stone-300 px-3 py-3 text-xs text-stone-500 dark:border-stone-700">إزالة</button>
    </div>)}
    <button type="button" disabled={rows.length >= 10} onClick={() => { setRows((current) => [...current, nextId]); setNextId((current) => current + 1); }} className="rounded-lg border border-[#527764]/40 px-4 py-2 text-sm disabled:opacity-40">＋ إضافة توثيق YouTube آخر</button>
    <p className="text-xs leading-6 text-stone-500">اختياري؛ أدخل اسمًا ورابطًا لكل فيديو. حتى 10 روابط YouTube.</p>
  </fieldset>;
}
