"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { canEditUntilMonth, editDeadline } from "@/lib/edit-window";

type Tab = "cases" | "files" | "testimonies" | "inbox" | "messages" | "account";
type RecordRow = { id: string; title: string; description?: string; status: string; created_at: string; event_date?: string | null; case_id?: string | null; person_file_id?: string | null };
type Conversation = { id: string; kind: string; subject: string; updated_at: string; peerName: string; peerId: string };
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "cases", label: "القضايا المضافة" }, { id: "files", label: "الملفات المضافة" },
  { id: "testimonies", label: "شهاداتي" }, { id: "inbox", label: "الصندوق الوارد" },
  { id: "messages", label: "مراسلة مستخدم" }, { id: "account", label: "حسابي" },
];
const statusLabels: Record<string, string> = { draft: "مسودة", submitted: "قيد المراجعة", published: "منشور", rejected: "مرفوض", archived: "مؤرشف" };

export default function WorkspacePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [tab, setTab] = useState<Tab>("cases");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; body: string; sender_id: string; created_at: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ user_id: string; display_name: string }>>([]);
  const [myDisplayName, setMyDisplayName] = useState("");
  const [myLanguage, setMyLanguage] = useState<"ar" | "en">("ar");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("tab");
    const valid = tabs.some((item) => item.id === key) ? key as Tab : key === "support" ? "inbox" : "cases";
    setTab(valid);
    if (!supabase) { router.replace("/account?mode=login"); return; }
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/account?mode=login&next=%2Fworkspace"); return; }
      setUserId(data.user.id); setEmail(data.user.email ?? ""); setReady(true);
    });
  }, [router, supabase]);

  const loadRows = useCallback(async () => {
    if (!supabase || !userId) return;
    const table = tab === "cases" ? "sijill_cases" : tab === "files" ? "sijill_person_files" : "sijill_testimonies";
    const select = tab === "testimonies" ? "id,title,description,status,created_at,event_date,case_id,person_file_id" : "id,title,description,status,created_at";
    const { data, error: queryError } = await supabase.from(table).select(select).eq("created_by", userId).order("created_at", { ascending: false });
    if (queryError) setError("تعذر تحميل مساهماتك. تحقق من تحديث قاعدة البيانات ثم أعد المحاولة.");
    else setRows((data ?? []) as unknown as RecordRow[]);
  }, [supabase, tab, userId]);

  const loadConversations = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data: memberRows, error: memberError } = await supabase.from("sijill_conversation_members").select("conversation_id").eq("user_id", userId);
    if (memberError) { setError("تعذر تحميل المراسلات. تحقق من تحديث قاعدة البيانات."); return; }
    const ids = [...new Set((memberRows ?? []).map((item) => item.conversation_id))];
    if (!ids.length) { setConversations([]); return; }
    const [{ data: threads }, { data: members }] = await Promise.all([
      supabase.from("sijill_conversations").select("id,kind,subject,updated_at").in("id", ids).order("updated_at", { ascending: false }),
      supabase.from("sijill_conversation_members").select("conversation_id,user_id").in("conversation_id", ids),
    ]);
    const { data: names } = await supabase.from("sijill_public_profiles").select("user_id,display_name").limit(1000);
    setProfiles((names ?? []) as typeof profiles);
    const nameMap = new Map((names ?? []).map((profile) => [profile.user_id, profile.display_name]));
    setConversations((threads ?? []).map((thread) => {
      const peer = (members ?? []).find((member) => member.conversation_id === thread.id && member.user_id !== userId)?.user_id ?? "";
      return { ...thread, peerId: peer, peerName: thread.kind === "support" ? "الإدارة" : nameMap.get(peer) ?? "مستخدم" };
    }) as Conversation[]);
  }, [supabase, userId]);

  useEffect(() => { if (ready && ["cases", "files", "testimonies"].includes(tab)) void loadRows(); }, [ready, tab, loadRows]);
  useEffect(() => { if (ready && ["inbox", "messages"].includes(tab)) void loadConversations(); }, [ready, tab, loadConversations]);
  useEffect(() => {
    if (!supabase || !userId) return;
    void supabase.from("sijill_public_profiles").select("display_name,preferred_language").eq("user_id", userId).maybeSingle().then(({ data }) => { setMyDisplayName(data?.display_name ?? ""); setMyLanguage(data?.preferred_language === "en" ? "en" : "ar"); });
  }, [supabase, userId]);
  useEffect(() => {
    if (!supabase || !selectedConversation) { setMessages([]); return; }
    let active = true;
    const refresh = async () => {
      const { data } = await supabase.from("sijill_direct_messages").select("id,body,sender_id,created_at").eq("conversation_id", selectedConversation).order("created_at", { ascending: true });
      if (active) setMessages((data ?? []) as typeof messages);
    };
    void refresh();
    void supabase.from("sijill_conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", selectedConversation).eq("user_id", userId);
    const refreshTimer = window.setInterval(() => { void refresh(); }, 10000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [supabase, selectedConversation, userId]);

  const show = (next: Tab) => { setTab(next); setNotice(""); setError(""); router.replace(`/workspace?tab=${next}`, { scroll: false }); };
  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !selectedConversation) return;
    const formElement = event.currentTarget; const form = new FormData(formElement); const body = String(form.get("body") ?? "").trim(); if (!body) return;
    setBusy(true); setError("");
    const { error: sendError } = await supabase.from("sijill_direct_messages").insert({ conversation_id: selectedConversation, sender_id: userId, body });
    if (sendError) setError("تعذر إرسال الرسالة."); else { formElement.reset(); const { data } = await supabase.from("sijill_direct_messages").select("id,body,sender_id,created_at").eq("conversation_id", selectedConversation).order("created_at", { ascending: true }); setMessages((data ?? []) as typeof messages); void loadConversations(); }
    setBusy(false);
  };
  const startConversation = async (event: FormEvent<HTMLFormElement>, kind: "direct" | "support") => {
    event.preventDefault(); if (!supabase) return;
    const values = new FormData(event.currentTarget); const subject = String(values.get("subject") ?? "").trim(); const recipient = String(values.get("recipient") ?? "") || null;
    if (kind === "direct" && !recipient) { setError("اختر المستخدم الذي تريد مراسلته."); return; }
    setBusy(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("start_sijill_conversation", { p_recipient_id: recipient, p_subject: subject, p_kind: kind });
    if (rpcError) setError("تعذر إنشاء المحادثة. تحقق من إعداد صندوق الإدارة أو حاول لاحقاً.");
    else { await loadConversations(); setSelectedConversation(data as string); setNotice("بدأت المحادثة. اكتب رسالتك في نافذة المحادثة."); }
    setBusy(false);
  };
  const updateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase) return;
    const form = new FormData(event.currentTarget); const displayName = String(form.get("display_name") ?? "").trim(); const password = String(form.get("password") ?? ""); const language = String(form.get("language") ?? "ar");
    if (!displayName) { setError("أدخل الاسم الذي سيظهر بجانب مساهماتك."); return; }
    setBusy(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ data: { display_name: displayName, preferred_language: language }, ...(password ? { password } : {}) });
    if (updateError) setError("تعذر حفظ بيانات الحساب. تأكد من كلمة المرور الجديدة ثم أعد المحاولة.");
    else setNotice("حُفظت إعدادات الحساب والاسم الظاهر.");
    setBusy(false);
  };

  if (!ready) return <main className="grid min-h-screen place-items-center bg-[#f8f7f2] text-sm text-stone-600 dark:bg-[#131916] dark:text-stone-400">جارٍ التحقق من الحساب...</main>;
  const conversation = conversations.find((item) => item.id === selectedConversation);
  return <main dir="rtl" className="min-h-screen bg-[#f8f7f2] px-5 py-8 text-[#1c2922] dark:bg-[#131916] dark:text-[#f1f1e9] sm:px-8">
    <div className="mx-auto max-w-5xl"><Link href="/" className="text-sm text-[#527764] underline underline-offset-4">العودة إلى الصفحة الرئيسية</Link>
      <header className="mt-7"><p className="text-xs tracking-[.2em] text-[#98704b]">مساحة الحساب</p><h1 className="mt-2 text-3xl font-bold">مرحباً بك</h1><p className="mt-2 text-sm text-stone-500" dir="ltr">{email}</p></header>
      <nav className="mt-7 flex flex-wrap gap-2" aria-label="أقسام الحساب">{tabs.map((item) => <button key={item.id} onClick={() => show(item.id)} className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${tab === item.id ? "border-[#194537] bg-[#194537] text-white dark:border-[#c0dec2] dark:bg-[#c0dec2] dark:text-[#13271f]" : "border-stone-300 bg-white dark:border-stone-700 dark:bg-[#1a211d]"}`}>{item.label}</button>)}</nav>
      {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-700/25 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{notice}</p>}{error && <p role="alert" className="mt-5 rounded-xl border border-rose-700/25 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">{error}</p>}

      {["cases", "files", "testimonies"].includes(tab) && <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d] sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">{tabs.find((item) => item.id === tab)?.label}</h2><p className="mt-1 text-sm text-stone-500">هذه المساهمات مرتبطة بحسابك، ويظهر اسمك عند نشرها.</p></div>{tab === "cases" ? <Link href="/cases/new" className="rounded-lg bg-[#194537] px-4 py-2 text-sm font-semibold text-white">＋ إضافة قضية</Link> : tab === "files" ? <Link href="/files/new" className="rounded-lg bg-[#194537] px-4 py-2 text-sm font-semibold text-white">＋ إضافة ملف</Link> : null}</div>
        {rows.length === 0 ? <p className="py-12 text-center text-sm text-stone-500">لا توجد مساهمات هنا بعد.</p> : <ul className="mt-5 divide-y divide-stone-100 dark:divide-stone-800">{rows.map((row) => { const editable = canEditUntilMonth(row.created_at); const editKind = tab === "cases" ? "case" : tab === "files" ? "file" : "testimony"; return <li key={row.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{row.title}</h3><p className="mt-1 text-xs text-stone-500">{statusLabels[row.status] ?? row.status} · أُضيف {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(row.created_at))}{row.event_date ? ` · تاريخ الشهادة: ${row.event_date}` : ""}</p></div><div className="flex gap-2">{row.status === "published" && <Link href={tab === "cases" ? `/cases/${row.id}` : tab === "files" ? `/files/${row.id}` : "/testimonies"} className="rounded-lg border border-stone-300 px-3 py-2 text-xs">عرض</Link>}{editable ? <Link href={`/workspace/edit/${editKind}/${row.id}`} className="rounded-lg border border-[#9a8658] px-3 py-2 text-xs">تعديل · حتى {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(editDeadline(row.created_at))}</Link> : <span className="rounded-lg bg-stone-100 px-3 py-2 text-xs text-stone-500 dark:bg-stone-800">انتهت مدة التعديل</span>}</div></div>{row.description && <p className="mt-3 line-clamp-2 text-sm leading-7 text-stone-600 dark:text-stone-400">{row.description}</p>}</li>; })}</ul>}
      </section>}

      {tab === "inbox" && <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(250px,1fr)_2fr]"><div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d]"><h2 className="text-xl font-bold">الصندوق الوارد</h2><p className="mt-1 text-sm text-stone-500">رسائلك مع الإدارة والمستخدمين.</p><form className="mt-5 space-y-3" onSubmit={(event) => void startConversation(event, "support")}><input required name="subject" placeholder="موضوع الرسالة للإدارة" className="w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 text-sm dark:border-stone-700"/><button disabled={busy} className="w-full rounded-lg bg-[#194537] px-3 py-2 text-sm font-semibold text-white">مراسلة الإدارة</button></form><ul className="mt-5 space-y-2">{conversations.map((item) => <li key={item.id}><button onClick={() => setSelectedConversation(item.id)} className={`w-full rounded-xl border p-3 text-right ${selectedConversation === item.id ? "border-[#527764] bg-emerald-50 dark:bg-emerald-950/30" : "border-stone-200 dark:border-stone-700"}`}><span className="block font-semibold">{item.subject}</span><span className="mt-1 block text-xs text-stone-500">{item.peerName}</span></button></li>)}</ul>{conversations.length === 0 && <p className="py-6 text-sm text-stone-500">لا توجد رسائل بعد.</p>}</div><ConversationPanel conversation={conversation} messages={messages} userId={userId} onSubmit={sendMessage} busy={busy}/></section>}

      {tab === "messages" && <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(260px,1fr)_2fr]"><div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d]"><h2 className="text-xl font-bold">مراسلة مستخدم</h2><p className="mt-1 text-sm text-stone-500">يظهر هنا اسم الحساب فقط، ولا تُعرض عناوين البريد.</p><form onSubmit={(event) => void startConversation(event, "direct")} className="mt-5 space-y-3"><select required name="recipient" defaultValue="" className="w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 text-sm dark:border-stone-700"><option value="" disabled>اختر مستخدماً</option>{profiles.filter((profile) => profile.user_id !== userId).map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.display_name}</option>)}</select><input required name="subject" maxLength={180} placeholder="موضوع المحادثة" className="w-full rounded-lg border border-stone-300 bg-transparent px-3 py-2 text-sm dark:border-stone-700"/><button disabled={busy} className="w-full rounded-lg bg-[#194537] px-3 py-2 text-sm font-semibold text-white">بدء المراسلة</button></form><ul className="mt-5 space-y-2">{conversations.filter((item) => item.kind === "direct").map((item) => <li key={item.id}><button onClick={() => setSelectedConversation(item.id)} className="w-full rounded-xl border border-stone-200 p-3 text-right dark:border-stone-700"><span className="block font-semibold">{item.peerName}</span><span className="mt-1 block text-xs text-stone-500">{item.subject}</span></button></li>)}</ul></div><ConversationPanel conversation={conversation} messages={messages} userId={userId} onSubmit={sendMessage} busy={busy}/></section>}

      {tab === "account" && <AccountSettings onSubmit={updateAccount} busy={busy} email={email} initialName={myDisplayName} initialLanguage={myLanguage} />}
      <p className="mt-7 text-xs leading-6 text-stone-500">سِجِلّ يحفظ المعلومات وينظمها؛ ولا يحدد الذنب أو البراءة.</p>
    </div></main>;
}

function ConversationPanel({ conversation, messages, userId, onSubmit, busy }: { conversation?: Conversation; messages: Array<{ id: string; body: string; sender_id: string; created_at: string }>; userId: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <section className="flex min-h-[420px] flex-col rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d]"><h2 className="border-b border-stone-100 pb-4 font-bold dark:border-stone-800">{conversation ? `${conversation.peerName} · ${conversation.subject}` : "اختر محادثة لعرض الرسائل"}</h2><div className="flex-1 space-y-3 overflow-y-auto py-4">{messages.map((message) => <p key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.sender_id === userId ? "mr-auto bg-[#194537] text-white" : "ml-auto bg-stone-100 dark:bg-stone-800"}`}>{message.body}</p>)}</div>{conversation && <form onSubmit={onSubmit} className="flex gap-2 border-t border-stone-100 pt-4 dark:border-stone-800"><textarea required name="body" maxLength={10000} rows={2} placeholder="اكتب رسالتك" className="min-w-0 flex-1 resize-y rounded-xl border border-stone-300 bg-transparent px-3 py-2 text-sm dark:border-stone-700"/><button disabled={busy} className="rounded-xl bg-[#194537] px-4 text-sm font-semibold text-white">إرسال</button></form>}</section>;
}

function AccountSettings({ onSubmit, busy, email, initialName, initialLanguage }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; email: string; initialName: string; initialLanguage: "ar" | "en" }) {
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState<"ar" | "en">(initialLanguage);
  useEffect(() => { if (initialName) setName(initialName); }, [initialName]);
  useEffect(() => { setLanguage(initialLanguage); }, [initialLanguage]);
  return <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-5 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-[#1a211d] sm:p-7"><h2 className="text-xl font-bold">حسابي</h2><p className="text-sm text-stone-500" dir="ltr">{email}</p><label className="block text-sm font-semibold">الاسم الذي يظهر بجانب مساهماتك<input required name="display_name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label><label className="block text-sm font-semibold">كلمة مرور جديدة <span className="font-normal text-stone-500">(اتركها فارغة إن لم ترغب بتغييرها)</span><input name="password" type="password" minLength={8} autoComplete="new-password" className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"/></label><label className="block text-sm font-semibold">لغة الحساب<select name="language" value={language} onChange={(event) => setLanguage(event.target.value as "ar" | "en")} className="mt-2 w-full rounded-lg border border-stone-300 bg-transparent px-3 py-3 font-normal dark:border-stone-700"><option value="ar">العربية</option><option value="en">English</option></select></label><p className="text-xs leading-6 text-stone-500">يُحفظ اختيار اللغة في إعدادات الحساب، وستُترجم بقية صفحات الموقع ضمن مرحلة التوطين.</p><button disabled={busy} className="rounded-xl bg-[#194537] px-5 py-3 text-sm font-semibold text-white">حفظ الإعدادات</button></form>;
}
