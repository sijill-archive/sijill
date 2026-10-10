"use client";

import { YoutubeFields } from "@/components/youtube-fields";

export function ArchiveMediaFields() {
  return (
    <section className="space-y-4 border-t border-stone-100 pt-6 dark:border-stone-800">
      <h2 className="text-lg font-semibold">الصور والفيديوهات وروابط YouTube</h2>
      <label className="block text-sm font-medium">الصور
        <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-[#121815]" />
        <span className="mt-1 block text-xs font-normal leading-6 text-stone-500">حتى 10 صور، بحد أقصى 10 ميغابايت للصورة.</span>
      </label>
      <label className="block text-sm font-medium">الفيديوهات
        <input type="file" name="videos" multiple accept="video/mp4,video/webm,video/quicktime" className="mt-2 block w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-[#121815]" />
        <span className="mt-1 block text-xs font-normal leading-6 text-stone-500">حتى 3 فيديوهات، بحد أقصى 50 ميغابايت للفيديو.</span>
      </label>
      <YoutubeFields />
      <p className="rounded-xl bg-stone-50 p-4 text-xs leading-6 text-stone-600 dark:bg-stone-900 dark:text-stone-400">تُحفظ المرفقات في مساحة خاصة، ولا تصبح متاحة للزوار إلا بعد اعتماد ونشر القضية أو الملف.</p>
    </section>
  );
}
