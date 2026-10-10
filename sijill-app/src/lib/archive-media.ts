import type { SupabaseClient } from "@supabase/supabase-js";

export type ArchiveMedia = { images: string[]; videos: string[]; youtube: string[]; youtube_titles?: Record<string, string> };
export const emptyArchiveMedia: ArchiveMedia = { images: [], videos: [], youtube: [] };
const bucket = "sijill-media";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function filesFrom(data: FormData, name: string) {
  return data.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
}

export function isYoutubeUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname); }
  catch { return false; }
}

export function validateYoutubeFields(data: FormData): { youtube: string[]; youtube_titles: Record<string, string> } {
  const urls = data.getAll("youtube_url").map(String);
  const titles = data.getAll("youtube_title").map(String);
  const youtube_titles: Record<string, string> = {};
  const youtube = urls.length ? urls.flatMap((raw, index) => {
    const url = raw.trim(); const title = (titles[index] ?? "").trim();
    if (!url && !title) return [];
    if (!url || !title || title.length > 180) throw new Error("أدخل اسم الفيديو ورابط YouTube معًا، بحد أقصى 180 حرفًا للاسم.");
    youtube_titles[url] = title; return [url];
  }) : String(data.get("youtube") ?? "").split(/[\n,]/).map((url) => url.trim()).filter(Boolean);
  if (youtube.length > 10 || youtube.some((value) => !isYoutubeUrl(value))) throw new Error("أدخل روابط YouTube صحيحة فقط، بحد أقصى 10 روابط.");
  if (new Set(youtube).size !== youtube.length) throw new Error("رابط YouTube مكرر؛ أرفق الفيديو مرة واحدة فقط.");
  return { youtube, youtube_titles };
}

export function validateArchiveMedia(data: FormData): { images: File[]; videos: File[]; youtube: string[]; youtube_titles: Record<string, string> } {
  const images = filesFrom(data, "images");
  const videos = filesFrom(data, "videos");
  const { youtube, youtube_titles } = validateYoutubeFields(data);
  if (images.length > 10) throw new Error("يمكن إرفاق 10 صور كحد أقصى.");
  if (videos.length > 3) throw new Error("يمكن إرفاق 3 فيديوهات كحد أقصى.");
  if (images.some((file) => !imageTypes.has(file.type) || file.size > 10 * 1024 * 1024)) throw new Error("الصور المقبولة JPG أو PNG أو WebP أو GIF، وبحجم لا يتجاوز 10 ميغابايت للصورة.");
  if (videos.some((file) => !videoTypes.has(file.type) || file.size > 50 * 1024 * 1024)) throw new Error("الفيديوهات المقبولة MP4 أو WebM أو MOV، وبحجم لا يتجاوز 50 ميغابايت للفيديو.");
  return { images, videos, youtube, youtube_titles };
}

export async function uploadArchiveMedia(
  supabase: SupabaseClient,
  kind: "cases" | "files",
  recordId: string,
  data: FormData,
): Promise<ArchiveMedia> {
  const selected = validateArchiveMedia(data);
  const uploaded: string[] = [];
  const uploadGroup = async (files: File[], folder: "images" | "videos") => {
    const paths: string[] = [];
    for (const file of files) {
      const safeName = file.name.normalize("NFKC").replace(/[^\w.-]+/g, "-").slice(-100) || "media";
      const path = `${kind}/${recordId}/${folder}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      paths.push(path);
      uploaded.push(path);
    }
    return paths;
  };
  try {
    const images = await uploadGroup(selected.images, "images");
    const videos = await uploadGroup(selected.videos, "videos");
    return { images, videos, youtube: selected.youtube, youtube_titles: selected.youtube_titles };
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(bucket).remove(uploaded);
    throw error;
  }
}

export async function signedArchiveMedia(supabase: SupabaseClient, media: ArchiveMedia | null | undefined) {
  const sign = async (paths: string[] = []) => Promise.all(paths.map(async (path) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
    return error || !data?.signedUrl ? null : { path, url: data.signedUrl };
  })).then((items) => items.filter((item): item is { path: string; url: string } => item !== null));
  const [images, videos] = await Promise.all([sign(media?.images), sign(media?.videos)]);
  return { images, videos, youtube: (media?.youtube ?? []).filter(isYoutubeUrl), youtube_titles: media?.youtube_titles ?? {} };
}
