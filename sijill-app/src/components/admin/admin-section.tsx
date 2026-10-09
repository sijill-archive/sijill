"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ArchiveMediaGallery } from "@/components/archive-media-gallery";
import type { ArchiveMedia } from "@/lib/archive-media";

type Section = "verification" | "archive" | "reports" | "messages" | "notifications" | "settings";
type CaseRow = { id: string; title: string; description: string; governorate: string; district_name: string; city: string; event_date: string | null; status: string; created_by: string; media?: ArchiveMedia | null };
type FileRow = { id: string; title: string; description: string; governorate: string | null; district_name: string | null; city: string | null; status: string; created_by: string; media?: ArchiveMedia | null; case_id: string | null };
type TestimonyRow = { id: string; title: string; description: string; event_date: string | null; case_id: string | null; person_file_id: string | null; created_by: string | null; status: string; position?: string; public_consent?: boolean };
type RequestRow = { id: string; subject_type: string; subject_id: string; request_type: string; details: string; status: string; review_note: string; requested_by: string; created_at: string };
type RequestSubject = { title: string; description: string; media?: ArchiveMedia | null };
type Conversation = { id: string; kind: string; subject: string; updated_at: string };
type Message = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };
type AdminProfile = { user_id: string; display_name: string };
type ConversationMember = { conversation_id: string; user_id: string };
type CaseFileLink = { case_id: string; person_file_id: string };

const panel = "rounded-2xl border border-white/10 bg-[#17211c] p-5 sm:p-6";
const field = "w-full rounded-xl border border-white/15 bg-[#101713] px-3 py-2.5 text-sm text-stone-100 placeholder:text-stone-500";
const dateFormat = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });
const typeLabels: Record<string, string> = { case: "قضية", person_file: "ملف شخص", testimony: "شهادة", article: "مقال" };

export function AdminSection({ section }: { section: Section }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const supabase = createBrowserSupabaseClient();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [requestRegions, setRequestRegions] = useState<Record<string, string>>({});
  const [requestSubjects, setRequestSubjects] = useState<Record<string, RequestSubject>>({});
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [testimonies, setTestimonies] = useState<TestimonyRow[]>([]);
  const [fileLinks, setFileLinks] = useState<CaseFileLink[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState("");
  const [conversationMembers, setConversationMembers] = useState<ConversationMember[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportTarget, setReportTarget] = useState("");
  const [background, setBackground] = useState("#151916");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [backgroundImagePath, setBackgroundImagePath] = useState("");
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState("");
  const [removeBackgroundImage, setRemoveBackgroundImage] = useState(false);

  useEffect(() => {
    if (!supabase) { setError("إعداد Supabase غير متوفر."); return; }
    let alive = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive || !user) return;
      const { data: role } = await supabase.from("sijill_user_roles").select("role").eq("user_id", user.id).maybeSingle();
      const owner = role?.role === "owner";
      if (alive) { setIsOwner(owner); setOwnerId(user.id); }
      const profileQuery = supabase.from("sijill_public_profiles").select("user_id,display_name").limit(1500);
      if (section === "verification") {
        const result = await supabase.from("sijill_verification_requests").select("id,subject_type,subject_id,request_type,details,status,review_note,requested_by,created_at").order("created_at", { ascending: false }).limit(500);
        const requestData = (result.data ?? []) as RequestRow[];
        const caseIds = requestData.filter((row) => row.subject_type === "case").map((row) => row.subject_id);
        const fileIds = requestData.filter((row) => row.subject_type === "person_file").map((row) => row.subject_id);
        const testimonyIds = requestData.filter((row) => row.subject_type === "testimony").map((row) => row.subject_id);
        const [caseRows, fileRows, testimonyRows, profileResult] = await Promise.all([
          caseIds.length ? supabase.from("sijill_cases").select("id,title,description,governorate,media").in("id", caseIds) : Promise.resolve({ data: [] }),
          fileIds.length ? supabase.from("sijill_person_files").select("id,title,description,governorate,media").in("id", fileIds) : Promise.resolve({ data: [] }),
          testimonyIds.length ? supabase.from("sijill_testimonies").select("id,title,description,city,case_id,person_file_id").in("id", testimonyIds) : Promise.resolve({ data: [] }),
          profileQuery,
        ]);
        if (alive) {
          if (result.error) setError("تعذر تحميل طلبات التوثيق. تحقق من تطبيق آخر ترحيل SQL.");
          else {
            setRequests(requestData); setProfiles((profileResult.data ?? []) as AdminProfile[]);
            const subjects = [...(caseRows.data ?? []), ...(fileRows.data ?? []), ...(testimonyRows.data ?? [])] as Array<{ id: string; title: string; description: string; media?: ArchiveMedia | null }>;
            setRequestSubjects(Object.fromEntries(subjects.map((row) => [row.id, { title: row.title, description: row.description, media: row.media ?? null }])));
            const locations = Object.fromEntries([...(caseRows.data ?? []), ...(fileRows.data ?? [])].map((row) => [row.id, row.governorate ?? "غير محدد"]));
            for (const item of testimonyRows.data ?? []) locations[item.id] = locations[item.case_id ?? item.person_file_id] ?? "غير محدد";
            setRequestRegions(locations);
          }
        }
      }
      if (section === "archive" || section === "reports") {
        const [caseResult, fileResult, testimonyResult, profileResult, linkResult] = await Promise.all([
          supabase.from("sijill_cases").select("id,title,description,governorate,district_name,city,event_date,status,created_by,media").order("title").limit(2000),
          supabase.from("sijill_person_files").select("id,title,description,governorate,district_name,city,status,created_by,media,case_id").order("title").limit(2000),
          supabase.from("sijill_testimonies").select("id,title,description,event_date,case_id,person_file_id,created_by,status,position,public_consent").order("created_at", { ascending: false }).limit(3000),
          profileQuery,
          supabase.from("sijill_case_person_files").select("case_id,person_file_id"),
        ]);
        if (alive) {
          if (caseResult.error || fileResult.error || testimonyResult.error) setError("تعذر تحميل الأرشيف.");
          setCases((caseResult.data ?? []) as CaseRow[]); setFiles((fileResult.data ?? []) as FileRow[]); setTestimonies((testimonyResult.data ?? []) as TestimonyRow[]); setProfiles((profileResult.data ?? []) as AdminProfile[]); setFileLinks((linkResult.data ?? []) as CaseFileLink[]);
        }
      }
      if (section === "messages" && owner) {
        const [result, profileResult] = await Promise.all([
          supabase.from("sijill_conversations").select("id,kind,subject,updated_at").order("updated_at", { ascending: false }).limit(500),
          profileQuery,
        ]);
        const ids = (result.data ?? []).map((row) => row.id);
        const memberResult = ids.length ? await supabase.from("sijill_conversation_members").select("conversation_id,user_id").in("conversation_id", ids) : { data: [] };
        if (alive) { if (result.error) setError("تعذر فتح صندوق الرسائل."); else setConversations((result.data ?? []) as Conversation[]); setProfiles((profileResult.data ?? []) as AdminProfile[]); setConversationMembers((memberResult.data ?? []) as ConversationMember[]); }
      }
      if (section === "settings" && owner) {
        const result = await supabase.from("sijill_site_settings").select("background_color,background_image_url,background_image_path").eq("singleton", true).maybeSingle();
        if (alive && result.data) { setBackground(result.data.background_color); setBackgroundImageUrl(result.data.background_image_url ?? ""); setBackgroundImagePath(result.data.background_image_path ?? ""); }
      }
    })();
    return () => { alive = false; };
  }, [section]);

  useEffect(() => {
    if (!backgroundFile) { setBackgroundPreview(""); return; }
    const url = URL.createObjectURL(backgroundFile);
    setBackgroundPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [backgroundFile]);

  useEffect(() => { if (typeof window !== "undefined") { const kind = new URLSearchParams(window.location.search).get("kind"); if (kind === "files") setTypeFilter("person_file"); else if (kind === "testimonies") setTypeFilter("testimony"); } }, []);
  useEffect(() => {
    if (!supabase || !selectedConversation) { setMessages([]); return; }
    void (async () => {
      const { data, error: loadError } = await supabase.from("sijill_direct_messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id", selectedConversation).order("created_at");
      if (loadError) setError("تعذر تحميل المحادثة."); setMessages((data ?? []) as Message[]);
      if (ownerId) void supabase.from("sijill_conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", selectedConversation).eq("user_id", ownerId);
    })();
  }, [selectedConversation, ownerId]);

  const profileName = (id: string | null | undefined) => profiles.find((item) => item.user_id === id)?.display_name ?? "مستخدم سِجِلّ";
  const regions = useMemo(() => [...new Set([...cases.map((row) => row.governorate), ...files.map((row) => row.governorate ?? "")].filter(Boolean))].sort((a,b) => a.localeCompare(b,"ar")), [cases,files]);
  const records = useMemo(() => [...cases.map((row) => ({ ...row, recordType: "case" as const })), ...files.map((row) => ({ ...row, recordType: "person_file" as const }))].filter((row) => (!typeFilter || row.recordType === typeFilter) && (!regionFilter || row.governorate === regionFilter) && row.title.toLocaleLowerCase("ar").includes(query.toLocaleLowerCase("ar"))).sort((a,b) => a.title.localeCompare(b.title,"ar")), [cases,files,typeFilter,regionFilter,query]);

  const decideRequest = async (request: RequestRow, status: "approved" | "rejected") => {
    if (!supabase || !isOwner || busy) return;
    const reviewNote = window.prompt(status === "approved" ? "ملاحظة القرار (اختياري):" : "سبب الرفض:", "");
    if (reviewNote === null) return;
    if (status === "rejected" && !reviewNote.trim()) { setError("اكتب سبب الرفض قبل إغلاق الطلب."); return; }
    setBusy(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.from("sijill_verification_requests").update({ status, review_note: reviewNote.trim(), reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq("id", request.id);
    if (updateError) setError("تعذر حفظ القرار."); else { setRequests((rows) => rows.map((row) => row.id === request.id ? { ...row, status, review_note: reviewNote.trim() } : row)); setNotice("تم حفظ القرار وتسجيل ملاحظة المراجعة."); }
    setBusy(false);
  };

  const deleteFile = async (file: FileRow) => {
    if (!supabase || !isOwner || !window.confirm(`سيُحذف ملف «${file.title}» نهائياً. هل تريد المتابعة؟`)) return;
    setBusy(true); const { error: deleteError } = await supabase.from("sijill_person_files").delete().eq("id", file.id);
    if (deleteError) setError("تعذر حذف الملف. قد تكون له شهادات مرتبطة؛ لا نحذف السجلات المرتبطة تلقائياً حفاظاً عليها."); else { setFiles((rows) => rows.filter((row) => row.id !== file.id)); const mediaError = await removeArchiveObjects(file.media); setNotice(mediaError ? "حُذف سجل الملف، لكن تعذر حذف بعض ملفاته المرفقة من التخزين." : "تم حذف الملف ومرفقاته."); }
    setBusy(false);
  };

  const deleteCase = async (item: CaseRow) => {
    if (!supabase || !isOwner || !window.confirm(`سيُحذف سجل القضية «${item.title}» نهائياً. لن تُحذف الشهادات أو الملفات المرتبطة تلقائياً، وقد يمنع وجودها الحذف. هل تريد المتابعة؟`)) return;
    setBusy(true); setError("");
    const { error: deleteError } = await supabase.from("sijill_cases").delete().eq("id", item.id);
    if (deleteError) setError("تعذر حذف القضية لوجود ملفات أو شهادات مرتبطة بها. احذف السجلات المرتبطة أولاً أو أخفِ القضية من الأرشيف حفاظاً على ترابط السجلات.");
    else { setCases((rows) => rows.filter((row) => row.id !== item.id)); const mediaError = await removeArchiveObjects(item.media); setNotice(mediaError ? "حُذف سجل القضية، لكن تعذر حذف بعض ملفاته المرفقة من التخزين." : "تم حذف القضية ومرفقاتها."); }
    setBusy(false);
  };

  const archiveCase = async (item: CaseRow) => {
    if (!supabase || !isOwner || !window.confirm(`إخفاء القضية «${item.title}» من الأرشيف العام مع الاحتفاظ بالملفات والشهادات المرتبطة؟`)) return;
    setBusy(true); setError("");
    const { error: archiveError } = await supabase.from("sijill_cases").update({ status: "archived" }).eq("id", item.id);
    if (archiveError) setError("تعذر إخفاء القضية من الأرشيف العام.");
    else { setCases((rows) => rows.map((row) => row.id === item.id ? { ...row, status: "archived" } : row)); setNotice("أُخفيت القضية من العرض العام مع الاحتفاظ بالسجلات المرتبطة."); }
    setBusy(false);
  };

  const deleteTestimony = async (item: TestimonyRow) => {
    if (!supabase || !isOwner || !window.confirm(`سيُحذف نص الشهادة «${item.title}» نهائياً. هل تريد المتابعة؟`)) return;
    setBusy(true); setError("");
    const { error: deleteError } = await supabase.from("sijill_testimonies").delete().eq("id", item.id);
    if (deleteError) setError("تعذر حذف الشهادة. تحقق من صلاحيات المالك.");
    else { setTestimonies((rows) => rows.filter((row) => row.id !== item.id)); setNotice("تم حذف الشهادة."); }
    setBusy(false);
  };

  const removeArchiveObjects = async (media: ArchiveMedia | null | undefined) => {
    if (!supabase || !media) return null;
    const paths = [...(media.images ?? []), ...(media.videos ?? [])];
    if (!paths.length) return null;
    const { error: removeError } = await supabase.storage.from("sijill-media").remove(paths);
    return removeError;
  };

  const archiveFile = async (file: FileRow) => {
    if (!supabase || !isOwner || !window.confirm(`إخفاء ملف «${file.title}» من الأرشيف العام مع الاحتفاظ بالشهادات والروابط؟`)) return;
    setBusy(true); const { error: archiveError } = await supabase.from("sijill_person_files").update({ status: "archived", admin_updated_at: new Date().toISOString() }).eq("id", file.id);
    if (archiveError) setError("تعذر إخفاء الملف من الأرشيف العام."); else { setFiles((rows) => rows.map((row) => row.id === file.id ? { ...row, status: "archived" } : row)); setNotice("أُخفي الملف من العرض العام مع الاحتفاظ بالسجلات المرتبطة."); }
    setBusy(false);
  };

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !isOwner || !selectedConversation) return;
    const form = event.currentTarget; const body = String(new FormData(form).get("body") ?? "").trim(); if (!body) return;
    setBusy(true); setError(""); const { data: { user } } = await supabase.auth.getUser();
    const { error: sendError } = await supabase.from("sijill_direct_messages").insert({ conversation_id: selectedConversation, sender_id: user?.id, body });
    if (sendError) setError("تعذر إرسال الرد."); else { form.reset(); const result = await supabase.from("sijill_direct_messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id", selectedConversation).order("created_at"); setMessages((result.data ?? []) as Message[]); setNotice("تم إرسال الرد."); }
    setBusy(false);
  };

  const startDirectConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !isOwner) return;
    const form = event.currentTarget; const values = new FormData(form); const recipient = String(values.get("recipient") ?? ""); const subject = String(values.get("subject") ?? "").trim();
    if (!recipient || !subject) return;
    setBusy(true); setError("");
    const { data, error: startError } = await supabase.rpc("start_sijill_conversation", { p_recipient_id: recipient, p_subject: subject, p_kind: "direct" });
    if (startError || !data) setError("تعذر بدء المحادثة مع هذا المستخدم."); else {
      form.reset();
      const [threadResult, memberResult] = await Promise.all([
        supabase.from("sijill_conversations").select("id,kind,subject,updated_at").order("updated_at", { ascending: false }).limit(500),
        supabase.from("sijill_conversation_members").select("conversation_id,user_id").eq("conversation_id", data),
      ]);
      setConversations((threadResult.data ?? []) as Conversation[]); setConversationMembers((current) => [...current.filter((member) => member.conversation_id !== data), ...((memberResult.data ?? []) as ConversationMember[])]); setSelectedConversation(data); setNotice("بدأت المحادثة. يمكنك إرسال الرسالة الأولى الآن.");
    }
    setBusy(false);
  };

  const publishNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !isOwner) return;
    const form = event.currentTarget; const values = new FormData(form); const title = String(values.get("title") ?? "").trim(); const body = String(values.get("body") ?? "").trim();
    if (!title || !body || !window.confirm(`معاينة الإشعار:\n\n${title}\n\n${body}\n\nسيظهر للمستخدمين المسجلين فقط، ويصل كإشعار للجهازين الذين فعّلوا إشعارات الخلفية. نشره الآن؟`)) return;
    setBusy(true); const { data: { user } } = await supabase.auth.getUser();
    const { data: published, error: publishError } = await supabase.from("sijill_broadcast_notifications").insert({ title, body, status: "published", created_by: user?.id, published_at: new Date().toISOString() }).select("id").single();
    if (publishError || !published) setError("تعذر نشر الإشعار."); else {
      form.reset();
      const { data: { session } } = await supabase.auth.getSession();
      try {
        const pushResponse = await fetch("/api/push/send", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ notificationId: published.id }) });
        const pushResult = await pushResponse.json().catch(() => ({})) as { sent?: number; error?: string };
        if (pushResponse.status === 503) setNotice("نُشر للمستخدمين المسجلين. لإيصال الإشعار عند إغلاق الموقع، أضف مفاتيح VAPID إلى إعدادات Vercel.");
        else if (pushResponse.ok && pushResult.sent === 0) setNotice("نُشر للمستخدمين المسجلين. لا توجد أجهزة فعّلت إشعارات الخلفية بعد.");
        else if (!pushResponse.ok) setNotice("نُشر للمستخدمين المسجلين، لكن تعذر إرسال إشعارات الخلفية الآن.");
        else setNotice(`نُشر للمستخدمين المسجلين، وأُرسل إلى ${pushResult.sent ?? 0} جهازاً مفعّلاً.`);
      } catch { setNotice("نُشر للمستخدمين المسجلين. تعذر الاتصال بخدمة إشعارات الخلفية."); }
    }
    setBusy(false);
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !isOwner) return;
    const form = event.currentTarget;
    const values = new FormData(form); const color = String(values.get("background") ?? background);
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { setError("اختر لوناً صالحاً."); return; }
    if (backgroundFile && (!/^image\/(jpeg|png|webp)$/.test(backgroundFile.type) || backgroundFile.size > 10 * 1024 * 1024)) { setError("ارفع صورة JPG أو PNG أو WebP لا يتجاوز حجمها 10 ميغابايت."); return; }
    setBusy(true); setError(""); const { data: { user } } = await supabase.auth.getUser();
    let imageUrl = removeBackgroundImage ? "" : backgroundImageUrl;
    let imagePath = removeBackgroundImage ? null : (backgroundImagePath || null);
    if (backgroundFile) {
      const extension = backgroundFile.type === "image/png" ? "png" : backgroundFile.type === "image/webp" ? "webp" : "jpg";
      imagePath = `site/background.${extension}`;
      const { error: uploadError } = await supabase.storage.from("sijill-site-backgrounds").upload(imagePath, backgroundFile, { upsert: true, contentType: backgroundFile.type, cacheControl: "60" });
      if (uploadError) { setError("تعذر رفع الصورة. تأكد من تطبيق ترحيل خلفية الموقع."); setBusy(false); return; }
      imageUrl = supabase.storage.from("sijill-site-backgrounds").getPublicUrl(imagePath).data.publicUrl;
    }
    const { error: saveError } = await supabase.from("sijill_site_settings").upsert({ singleton: true, background_color: color, background_image_url: imageUrl || null, background_image_path: imagePath, updated_by: user?.id, updated_at: new Date().toISOString() });
    if (saveError) setError("تعذر حفظ الخلفية. تأكد من تطبيق ترحيل إعدادات الموقع."); else {
      setBackgroundImageUrl(imageUrl); setBackgroundImagePath(imagePath ?? ""); setBackgroundFile(null); setRemoveBackgroundImage(false);
      localStorage.setItem("sijill-site-background", color);
      if (imageUrl) localStorage.setItem("sijill-site-background-image", imageUrl); else localStorage.removeItem("sijill-site-background-image");
      document.documentElement.style.setProperty("--site-background", color);
      document.documentElement.style.setProperty("--site-background-image", imageUrl ? `url("${imageUrl}")` : "none");
      setNotice("تم حفظ خلفية الموقع وتطبيقها على جميع الصفحات.");
    }
    setBusy(false);
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !isOwner) return;
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim(); if (!email || !window.confirm(`إرسال رابط استعادة كلمة المرور إلى ${email}؟`)) return;
    setBusy(true); const redirectTo = `${window.location.origin}/account?mode=recovery`;
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (recoveryError) setError("تعذر إرسال رابط الاستعادة. راجع إعدادات البريد وعناوين إعادة التوجيه في Supabase."); else setNotice("إذا كان البريد مسجلاً، ستصله رسالة استعادة رسمية من Supabase."); setBusy(false);
  };

  const changeOwnPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !isOwner) return;
    const password = String(new FormData(event.currentTarget).get("password") ?? ""); if (password.length < 8) { setError("كلمة المرور يجب أن تتكون من 8 محارف على الأقل."); return; }
    setBusy(true); const { error: changeError } = await supabase.auth.updateUser({ password });
    if (changeError) setError("تعذر تحديث كلمة المرور. قد يطلب Supabase إعادة التحقق من الحساب."); else { event.currentTarget.reset(); setNotice("تم تغيير كلمة مرور حساب المالك."); } setBusy(false);
  };

  const requestRegionOptions = [...new Set(Object.values(requestRegions))].sort((a,b) => a.localeCompare(b,"ar"));
  const filteredRequests = requests.filter((item) => (!statusFilter || item.status === statusFilter) && (!typeFilter || item.subject_type === typeFilter) && (!regionFilter || requestRegions[item.subject_id] === regionFilter) && (!dateFrom || item.created_at.slice(0,10) >= dateFrom) && (!dateTo || item.created_at.slice(0,10) <= dateTo) && `${item.details} ${requestSubjects[item.subject_id]?.title ?? ""}`.toLocaleLowerCase("ar").includes(query.toLocaleLowerCase("ar")));
  const selectedCase = cases.find((row) => row.id === reportTarget); const selectedFile = files.find((row) => row.id === reportTarget);
  const relatedFiles = selectedCase ? files.filter((file) => file.case_id === selectedCase.id || fileLinks.some((link) => link.case_id === selectedCase.id && link.person_file_id === file.id)) : [];
  const relatedFileIds = new Set(relatedFiles.map((file) => file.id));
  const linkedTestimonies = testimonies.filter((item) => (selectedCase && (item.case_id === selectedCase.id || (item.person_file_id && relatedFileIds.has(item.person_file_id)))) || (selectedFile && item.person_file_id === selectedFile.id));

  return <main dir="rtl" className="space-y-6">
    <header><p className="text-xs tracking-[.18em] text-[#b69a6d]">إدارة الأرشيف</p><h1 className="mt-2 text-3xl font-bold">{sectionTitle(section)}</h1><p className="mt-2 text-sm text-stone-400">{sectionDescription(section)}</p></header>
    {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-100">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-4 text-sm text-emerald-100">{notice}</p>}

    {section === "verification" && <section className={panel}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><select aria-label="الحالة" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={field}><option value="pending">بانتظار المراجعة</option><option value="in_review">قيد الفحص</option><option value="approved">مقبول</option><option value="rejected">مرفوض</option><option value="">كل الحالات</option></select><select aria-label="نوع السجل" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={field}><option value="">كل أنواع السجلات</option>{Object.entries(typeLabels).map(([key,value]) => <option key={key} value={key}>{value}</option>)}</select><select aria-label="المحافظة" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className={field}><option value="">كل المحافظات</option>{requestRegionOptions.map((region) => <option key={region}>{region}</option>)}</select><label className="text-xs text-stone-400">من تاريخ الإرسال<input type="date" aria-label="من تاريخ الإرسال" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${field} mt-1`}/></label><label className="text-xs text-stone-400">إلى تاريخ الإرسال<input type="date" aria-label="إلى تاريخ الإرسال" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${field} mt-1`}/></label><input aria-label="بحث" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث في تفاصيل الطلب" className={field}/></div>
      <p className="mt-4 text-xs text-stone-500">{filteredRequests.length} طلب · اعرض التفاصيل المسجلة قبل اتخاذ القرار. قبول طلب التوثيق لا ينشر محتوى غير منشور تلقائياً.</p>
      <div className="mt-4 space-y-3">{filteredRequests.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{typeLabels[item.subject_type] ?? item.subject_type} · {item.request_type === "correction" ? "تصحيح" : item.request_type === "challenge" ? "اعتراض" : "توثيق"} · {requestSubjects[item.subject_id]?.title ?? "السجل المرتبط"}</h2><p className="mt-1 text-xs text-stone-400">مقدم الطلب: {profileName(item.requested_by)} · {requestRegions[item.subject_id] ?? "المحافظة غير محددة"} · {dateFormat.format(new Date(item.created_at))}</p><Link href={item.subject_type === "case" ? `/cases/${item.subject_id}` : item.subject_type === "person_file" ? `/files/${item.subject_id}` : "/testimonies"} className="mt-2 inline-block text-xs text-[#c0dec2] underline">فتح السجل المرتبط ↗</Link></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs">{statusLabel(item.status)}</span></div>{requestSubjects[item.subject_id] && <><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">{requestSubjects[item.subject_id].description}</p><ArchiveMediaGallery media={requestSubjects[item.subject_id].media ?? null}/></>}<div className="mt-3 rounded-lg bg-white/5 p-3"><p className="text-[10px] text-stone-500">تفاصيل طلب المراجعة</p><p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-stone-300">{item.details || "لم يضف مقدم الطلب تفاصيل."}</p></div>{item.review_note && <p className="mt-3 rounded-lg bg-white/5 p-3 text-xs text-stone-300">ملاحظة القرار: {item.review_note}</p>}{isOwner && item.status === "pending" && <div className="mt-4 flex gap-2"><button disabled={busy} onClick={() => void decideRequest(item,"approved")} className="rounded-lg bg-[#c0dec2] px-4 py-2 text-xs font-semibold text-[#14251d]">قبول</button><button disabled={busy} onClick={() => void decideRequest(item,"rejected")} className="rounded-lg border border-rose-400/30 px-4 py-2 text-xs text-rose-200">رفض</button></div>}</article>)}{filteredRequests.length === 0 && <p className="py-12 text-center text-sm text-stone-500">لا توجد طلبات مطابقة.</p>}</div>
    </section>}

    {section === "archive" && <section className={panel}>
      <div className="grid gap-3 sm:grid-cols-3"><select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={field}><option value="">القضايا والملفات والشهادات</option><option value="case">القضايا</option><option value="person_file">الملفات</option><option value="testimony">الشهادات</option></select><select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} className={field}><option value="">كل المحافظات</option>{regions.map((region) => <option key={region}>{region}</option>)}</select><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم" className={field}/></div>
      <p className="mt-4 text-xs text-stone-500">الترتيب أبجدي. لا تُعدّل الإدارة محتوى القضايا والملفات والشهادات بعد نشره؛ يقتصر دورها على المراجعة وإدارة الحالة والحذف. يحق للناشر وحده تعديل محتواه خلال ١٥ يوماً من النشر.</p>
      {typeFilter === "testimony" ? <div className="mt-4 space-y-3">{testimonies.filter((row) => { const linkedCase = cases.find((item) => item.id === row.case_id); const linkedFile = files.find((item) => item.id === row.person_file_id); const regionMatch = !regionFilter || linkedCase?.governorate === regionFilter || linkedFile?.governorate === regionFilter; return regionMatch && row.title.toLocaleLowerCase("ar").includes(query.toLocaleLowerCase("ar")); }).sort((a,b) => a.title.localeCompare(b.title,"ar")).map((row) => <article key={row.id} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] text-[#b69a6d]">شهادة · {statusLabel(row.status)}</p><h2 className="mt-1 font-semibold">{row.title}</h2><p className="mt-1 text-xs text-stone-400">أضافها {profileName(row.created_by)} · {row.event_date ?? "دون تاريخ"}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">{row.description}</p></div>{isOwner && <div className="flex shrink-0 gap-2"><button disabled={busy} onClick={() => void deleteTestimony(row)} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200">حذف نهائي</button></div>}</div></article>)}</div> : <div className="mt-4 space-y-3">{records.map((row) => <article key={`${row.recordType}-${row.id}`} className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] text-[#b69a6d]">{row.recordType === "case" ? "قضية" : "ملف شخص"} · {statusLabel(row.status)}</p><h2 className="mt-1 text-lg font-semibold">{row.title}</h2><p className="mt-1 text-xs text-stone-400">{[row.governorate,row.district_name,row.city].filter(Boolean).join("، ") || "دون موقع محدد"} · أضافه {profileName(row.created_by)}</p><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-stone-300">{row.description}</p></div><div className="flex shrink-0 flex-wrap gap-2">{row.recordType === "case" ? <><Link href={`/cases/${row.id}`} className="self-center text-xs text-[#c0dec2] underline">فتح القضية</Link>{isOwner && <>{row.status !== "archived" && <button disabled={busy} onClick={() => void archiveCase(row)} className="rounded-lg border border-amber-400/30 px-3 py-2 text-xs text-amber-100">إخفاء من الأرشيف</button>}<button disabled={busy} onClick={() => void deleteCase(row)} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200">حذف نهائي</button></>}</> : isOwner && <>{row.status !== "archived" && <button disabled={busy} onClick={() => void archiveFile(row)} className="rounded-lg border border-amber-400/30 px-3 py-2 text-xs text-amber-100">إخفاء من الأرشيف</button>}<button disabled={busy} onClick={() => void deleteFile(row)} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200">حذف نهائي</button></>}</div></div></article>)}{records.length === 0 && <p className="py-12 text-center text-sm text-stone-500">لا توجد نتائج.</p>}</div>}

    </section>}

    {section === "reports" && <section className={panel}>
      <label className="block text-sm">اختر قضية أو ملفاً<select value={reportTarget} onChange={(e) => setReportTarget(e.target.value)} className={`${field} mt-2`}><option value="">اختر سجلاً منشوراً</option><optgroup label="القضايا">{cases.filter((row) => row.status === "published").map((row) => <option key={row.id} value={row.id}>قضية · {row.title}</option>)}</optgroup><optgroup label="الملفات">{files.filter((row) => row.status === "published").map((row) => <option key={row.id} value={row.id}>ملف · {row.title}</option>)}</optgroup></select></label>
      {reportTarget ? <><div className="mt-5 flex justify-end print:hidden"><button onClick={() => window.print()} className="rounded-lg bg-[#c0dec2] px-4 py-2 text-sm font-semibold text-[#14251d]">طباعة / حفظ PDF</button></div><article className="mt-4 rounded-xl border border-white/10 bg-[#101713] p-5 print:border-0 print:bg-white print:p-0 print:text-black"><p className="text-xs text-[#b69a6d] print:text-stone-600">سِجِلّ · تقرير أرشيفي</p><h2 className="mt-2 text-2xl font-bold">{selectedCase?.title ?? selectedFile?.title}</h2><p className="mt-2 text-xs text-stone-400 print:text-stone-600">{selectedCase ? "قضية" : "ملف شخص"} · أضافه {profileName(selectedCase?.created_by ?? selectedFile?.created_by)} · {selectedCase?.event_date ?? "التاريخ غير محدد"}</p><div className="mt-5 whitespace-pre-wrap text-sm leading-8">{selectedCase?.description ?? selectedFile?.description}</div><ArchiveMediaGallery media={(selectedCase?.media ?? selectedFile?.media) ?? null}/>{selectedCase && relatedFiles.length > 0 && <><h3 className="mt-7 border-t border-white/10 pt-5 text-lg font-semibold">الملفات المرتبطة ({relatedFiles.filter((row) => row.status === "published").length})</h3>{relatedFiles.filter((row) => row.status === "published").map((row) => <section key={row.id} className="mt-4 border-b border-white/10 pb-4"><h4 className="font-semibold">{row.title}</h4><p className="mt-1 text-xs text-stone-500">أضافه {profileName(row.created_by)} · {[row.governorate,row.district_name,row.city].filter(Boolean).join("، ")}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{row.description}</p><ArchiveMediaGallery media={row.media ?? null}/></section>)}</>}<h3 className="mt-7 border-t border-white/10 pt-5 text-lg font-semibold">الشهادات المرتبطة ({linkedTestimonies.filter((row) => row.status === "published").length})</h3>{linkedTestimonies.filter((row) => row.status === "published").map((row) => <section key={row.id} className="mt-4 border-b border-white/10 pb-4"><h4 className="font-semibold">{row.title}</h4><p className="mt-1 text-xs text-stone-500">أضافها {profileName(row.created_by)} · {row.event_date ?? "دون تاريخ"}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{row.description}</p></section>)}<p className="mt-8 rounded-lg bg-white/5 p-4 text-xs leading-6 text-stone-400 print:border print:border-stone-300 print:text-stone-700">هذا تقرير لسجل توثيقي ومصادره، وليس حكماً قضائياً. تُنسب المعلومات إلى أصحاب السجلات كما أُرسلت ونُشرت بعد المراجعة.</p></article></> : <p className="mt-8 text-sm text-stone-500">بعد اختيار سجل، ستظهر المواد المنشورة المرتبطة به مع إمكانية الطباعة.</p>}
    </section>}

    {section === "messages" && <section className={`${panel} grid gap-5 lg:grid-cols-[minmax(240px,.8fr)_1.5fr]`}>
      {!isOwner ? <p className="lg:col-span-2 text-sm text-stone-400">صندوق مراسلات الإدارة مخصص للمالك.</p> : <><div><h2 className="font-semibold">صندوق الرسائل</h2><form onSubmit={(e) => void startDirectConversation(e)} className="mt-4 space-y-2 rounded-xl border border-white/10 p-3"><label className="block text-xs text-stone-400">مراسلة مستخدم مسجل<select required name="recipient" defaultValue="" className={`${field} mt-2`}><option value="" disabled>اختر المستخدم</option>{profiles.filter((profile) => profile.user_id !== ownerId).map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.display_name}</option>)}</select></label><input required name="subject" maxLength={180} placeholder="موضوع المحادثة" className={field}/><button disabled={busy} className="w-full rounded-lg border border-[#c0dec2]/30 px-3 py-2 text-xs text-[#c0dec2]">بدء محادثة</button></form><ul className="mt-4 space-y-2">{conversations.map((item) => { const peerId = conversationMembers.find((member) => member.conversation_id === item.id && member.user_id !== ownerId)?.user_id; return <li key={item.id}><button onClick={() => setSelectedConversation(item.id)} className={`w-full rounded-xl border p-3 text-right ${selectedConversation === item.id ? "border-[#c0dec2]/50 bg-white/5" : "border-white/10"}`}><span className="block text-sm font-medium">{profileName(peerId)} · {item.subject}</span><span className="mt-1 block text-[10px] text-stone-500">{item.kind === "support" ? "مراسلة واردة" : "محادثة مباشرة"} · {dateFormat.format(new Date(item.updated_at))}</span></button></li>; })}</ul>{conversations.length === 0 && <p className="mt-5 text-sm text-stone-500">لا توجد مراسلات بعد.</p>}</div><div className="flex min-h-[400px] flex-col rounded-xl border border-white/10 p-4"><h2 className="border-b border-white/10 pb-3 font-semibold">{conversations.find((item) => item.id === selectedConversation)?.subject ?? "اختر محادثة"} {conversationMembers.find((member) => member.conversation_id === selectedConversation && member.user_id !== ownerId) && <span className="text-xs text-stone-400">· {profileName(conversationMembers.find((member) => member.conversation_id === selectedConversation && member.user_id !== ownerId)?.user_id)}</span>}</h2><div className="flex-1 space-y-3 overflow-y-auto py-4">{messages.map((item) => <div key={item.id} className={`max-w-[85%] rounded-xl p-3 text-sm leading-7 ${item.sender_id === ownerId ? "mr-auto bg-emerald-950/50" : "ml-auto bg-white/5"}`}><p>{item.body}</p><time className="mt-2 block text-[10px] text-stone-500">{dateFormat.format(new Date(item.created_at))}</time></div>)}</div>{selectedConversation && <form onSubmit={(e) => void sendReply(e)} className="flex gap-2 border-t border-white/10 pt-3"><textarea name="body" required maxLength={10000} rows={2} placeholder="اكتب الرد" className={`${field} flex-1`}/><button disabled={busy} className="rounded-lg bg-[#c0dec2] px-4 text-sm font-semibold text-[#14251d]">إرسال</button></form>}</div></>}
    </section>}

    {section === "notifications" && <section className={panel}>{!isOwner ? <p className="text-sm text-stone-400">إرسال الإشعارات العامة متاح للمالك فقط.</p> : <><form onSubmit={(e) => void publishNotification(e)} className="space-y-4"><label className="block text-sm">عنوان الإشعار<input required name="title" maxLength={180} className={`${field} mt-2`}/></label><label className="block text-sm">نص الإشعار<textarea required name="body" maxLength={5000} rows={5} className={`${field} mt-2`}/></label><p className="rounded-lg border border-amber-400/20 bg-amber-950/20 p-3 text-xs leading-6 text-amber-100">تظهر الإشعارات للمستخدمين المسجلين فقط. ويمكن لمن فعّل إشعارات الجهاز استلامها في الخلفية حتى عند إغلاق صفحة الموقع، بعد ضبط مفاتيح الإرسال.</p><button disabled={busy} className="rounded-xl bg-[#c0dec2] px-5 py-3 text-sm font-semibold text-[#14251d]">معاينة ثم بث</button></form></>}</section>}

    {section === "settings" && <div className="grid gap-5 xl:grid-cols-2">{!isOwner ? <section className={panel}><p className="text-sm text-stone-400">إعدادات الموقع متاحة للمالك فقط.</p></section> : <><section className={panel}><h2 className="text-lg font-semibold">خلفية الموقع</h2><p className="mt-2 text-xs leading-6 text-stone-500">ارفع صورة أو اختر لوناً. المقاس الموصى به 1920 × 1080 بكسل (16:9)، والحد الأعلى 10 ميغابايت. تُعرض الصورة مع تغبيش ثابت وطبقة تعتيم بنسبة 30٪ للمحافظة على وضوح المحتوى.</p><form onSubmit={(e) => void saveSettings(e)} className="mt-5 space-y-4"><label className="block text-sm">صورة الخلفية (JPG أو PNG أو WebP)<input name="background-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { setBackgroundFile(e.target.files?.[0] ?? null); setRemoveBackgroundImage(false); }} className={`${field} mt-2 file:ml-3 file:rounded-lg file:border-0 file:bg-[#c0dec2] file:px-3 file:py-2 file:text-[#14251d]`}/></label>{(backgroundImageUrl || backgroundPreview) && <button type="button" onClick={() => { setBackgroundFile(null); setBackgroundImageUrl(""); setBackgroundImagePath(""); setRemoveBackgroundImage(true); }} className="text-xs text-rose-200 underline">إزالة صورة الخلفية</button>}<label className="block text-sm">اللون الاحتياطي<input name="background" type="color" value={background} onChange={(e) => setBackground(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-transparent p-1"/></label><div className="relative isolate flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-white/10 p-5 text-center"><div aria-hidden="true" className="absolute inset-[-8px] z-0 bg-cover bg-center blur-[6px]" style={{ backgroundColor: background, backgroundImage: !removeBackgroundImage && (backgroundPreview || backgroundImageUrl) ? `url("${backgroundPreview || backgroundImageUrl}")` : undefined }}/><div aria-hidden="true" className="absolute inset-0 z-0 bg-black/30"/><span className="relative z-10 text-lg font-bold drop-shadow">معاينة خلفية الموقع · سِجِلّ</span></div><button disabled={busy} className="rounded-lg bg-[#c0dec2] px-4 py-2 text-sm font-semibold text-[#14251d]">حفظ الخلفية</button></form></section><section className={`${panel} space-y-7`}><div><h2 className="text-lg font-semibold">كلمة مرور حساب المالك</h2><form onSubmit={(e) => void changeOwnPassword(e)} className="mt-4 space-y-3"><input required name="password" type="password" minLength={8} autoComplete="new-password" placeholder="كلمة مرور جديدة" className={field}/><button disabled={busy} className="rounded-lg border border-white/15 px-4 py-2 text-sm">تغيير كلمة مروري</button></form></div><div className="border-t border-white/10 pt-5"><h2 className="text-lg font-semibold">إرسال رابط استعادة لمستخدم</h2><p className="mt-2 text-xs leading-6 text-stone-500">يُرسل Supabase رابطاً رسمياً إلى المستخدم. لا يطّلع المشرف على كلمة المرور ولا يحددها عنه.</p><form onSubmit={(e) => void resetPassword(e)} className="mt-4 flex flex-col gap-3 sm:flex-row"><input required name="email" type="email" placeholder="بريد المستخدم المسجل" className={`${field} flex-1`}/><button disabled={busy} className="rounded-lg border border-white/15 px-4 py-2 text-sm">إرسال رابط الاستعادة</button></form></div></section></>}</div>}
    <Link href="/admin" className="inline-block text-xs text-[#c0dec2] underline">العودة إلى لوحة التحكم</Link>
  </main>;
}

function sectionTitle(section: Section) { return ({ verification: "طلبات التوثيق", archive: "إدارة القضايا والملفات والشهادات", reports: "التقارير", messages: "الرسائل", notifications: "الإشعارات العامة", settings: "الإعدادات" })[section]; }
function sectionDescription(section: Section) { return ({ verification: "فرز الطلبات ومراجعتها وتسجيل قرار واضح لكل طلب.", archive: "فهرس القضايا والملفات والشهادات وحالتها وموقعها ومقدمها.", reports: "جمع سجل منشور وشهاداته المرتبطة في مستند قابل للطباعة.", messages: "مراسلات الدعم بين المستخدمين والإدارة.", notifications: "إنشاء تنبيه عام مع معاينة وتأكيد قبل النشر.", settings: "إعدادات المالك والحساب وخلفية الموقع." })[section]; }
function statusLabel(status: string) { return ({ pending: "بانتظار المراجعة", in_review: "قيد الفحص", approved: "مقبول", rejected: "مرفوض", published: "منشور", submitted: "قيد المراجعة", draft: "مسودة", archived: "مؤرشف" } as Record<string,string>)[status] ?? status; }
