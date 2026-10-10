"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { YoutubeFields } from "@/components/youtube-fields";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { signedArchiveMedia, type ArchiveMedia } from "@/lib/archive-media";

export function EditMediaFields({ media }: { media: ArchiveMedia }) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [signed, setSigned] = useState<{ images: {path:string;url:string}[]; videos: {path:string;url:string}[] }>({ images: [], videos: [] });
  useEffect(() => {
    let active = true; const supabase = createBrowserSupabaseClient();
    if (supabase) void signedArchiveMedia(supabase, media).then((result) => { if (active) setSigned(result); });
    return () => { active = false; };
  }, [media]);
  const toggle = (path: string) => setRemoved((rows) => rows.includes(path) ? rows.filter((row) => row !== path) : [...rows, path]);
  return <section className="space-y-4 border-t border-stone-200 pt-6 dark:border-stone-800"><h2 className="text-lg font-semibold">المرفقات</h2>
    <p className="text-xs leading-6 text-stone-500">تبقى المرفقات الحالية محفوظة ما لم تختر إزالتها من المحتوى. الصور والفيديوهات الجديدة تُضاف إليها عند الحفظ.</p>
    <div className="grid gap-4 sm:grid-cols-2">{(["images","videos"] as const).flatMap((group) => media[group].map((path, index) => {
      const item = signed[group].find((row) => row.path === path); const excluded = removed.includes(path);
      return <div key={path} className={`rounded-xl border p-3 ${excluded ? "border-rose-300 opacity-60" : "border-stone-300 dark:border-stone-700"}`}>
        {!excluded && <input type="hidden" name={group === "images" ? "retained_images" : "retained_videos"} value={path}/>}
        {item ? group === "images" ? <Image src={item.url} width={600} height={400} unoptimized alt={`صورة مرفقة ${index + 1}`} className="max-h-48 w-full object-contain"/> : <video controls preload="metadata" src={item.url} className="max-h-48 w-full"/> : <p className="py-6 text-center text-xs text-stone-500">{group === "images" ? "صورة" : "فيديو"} مرفق {index + 1}</p>}
        <button type="button" onClick={() => toggle(path)} className="mt-3 rounded-lg border border-stone-300 px-3 py-2 text-xs dark:border-stone-700">{excluded ? "التراجع عن الإزالة" : "إزالة من المحتوى"}</button>
      </div>;
    }))}</div>
    <label className="block text-sm font-semibold">إضافة صور<input type="file" multiple name="images" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-stone-300 p-3 text-xs dark:border-stone-700"/><span className="mt-1 block text-xs font-normal text-stone-500">حتى 10 صور إجمالًا؛ 10 ميغابايت لكل صورة.</span></label>
    <label className="block text-sm font-semibold">إضافة فيديوهات<input type="file" multiple name="videos" accept="video/mp4,video/webm,video/quicktime" className="mt-2 block w-full rounded-xl border border-stone-300 p-3 text-xs dark:border-stone-700"/><span className="mt-1 block text-xs font-normal text-stone-500">حتى 3 فيديوهات إجمالًا؛ 50 ميغابايت لكل فيديو.</span></label>
    <YoutubeFields initial={media.youtube.map((url) => ({ url, title: media.youtube_titles?.[url] ?? "مصدر توثيقي على YouTube" }))}/>
  </section>;
}
