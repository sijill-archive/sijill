"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { emptyArchiveMedia, signedArchiveMedia, type ArchiveMedia } from "@/lib/archive-media";

export function ArchiveMediaGallery({ media, excludeFirstImage = false }: { media: ArchiveMedia | null | undefined; excludeFirstImage?: boolean }) {
  const [items, setItems] = useState<{ images: { path: string; url: string }[]; videos: { path: string; url: string }[]; youtube: string[]; youtube_titles?: Record<string,string> }>({ images: [], videos: [], youtube: [] });
  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    void signedArchiveMedia(supabase, media ?? emptyArchiveMedia).then((result) => { if (active) setItems(result); });
    return () => { active = false; };
  }, [media]);
  const images = excludeFirstImage ? items.images.slice(1) : items.images;
  if (!images.length && !items.videos.length && !items.youtube.length) return null;
  return <section className="mt-6 border-t border-white/10 pt-5"><h2 className="text-lg font-semibold">الصور والفيديوهات والمصادر</h2>
    {images.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{images.map((item) => <a key={item.path} href={item.url} target="_blank" rel="noreferrer"><Image src={item.url} alt="مرفق توثيقي" width={1200} height={900} unoptimized className="max-h-96 w-full rounded-xl border border-white/10 object-contain" /></a>)}</div>}
    {items.videos.length > 0 && <div className="mt-4 space-y-3">{items.videos.map((item) => <video key={item.path} controls preload="metadata" className="w-full rounded-xl border border-white/10"><source src={item.url} /></video>)}</div>}
    {items.youtube.length > 0 && <ul className="mt-4 space-y-2">{items.youtube.map((url) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="text-[#c0dec2] underline underline-offset-4">{items.youtube_titles?.[url] || "مشاهدة المصدر على YouTube"}</a></li>)}</ul>}
  </section>;
}

export function ArchiveMediaHero({ media }: { media: ArchiveMedia | null | undefined }) {
  const [image, setImage] = useState<{ path: string; url: string } | null>(null);
  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !media?.images?.[0]) return;
    void signedArchiveMedia(supabase, { ...emptyArchiveMedia, images: [media.images[0]] }).then((result) => {
      if (active) setImage(result.images[0] ?? null);
    });
    return () => { active = false; };
  }, [media]);
  return <div className="mx-auto mt-6 w-full max-w-xl overflow-hidden rounded-2xl border border-[#b69a6d]/30 bg-black/20">
    {image ? <a href={image.url} target="_blank" rel="noreferrer" aria-label="فتح الصورة بالحجم الكامل"><Image src={image.url} alt="صورة مرتبطة بملف الشخص" width={1200} height={900} unoptimized className="max-h-[28rem] w-full object-contain" /></a> : <div className="grid min-h-48 place-items-center text-sm text-stone-500">لا توجد صورة مرفقة بهذا الملف</div>}
  </div>;
}
