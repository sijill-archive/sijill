"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Vote = "supporting" | "opposing";
type VoteCounts = { supporting: number; opposing: number };

export function ArchiveVoteBar({ parentType, parentId }: { parentType: "case" | "person_file"; parentId: string }) {
  const [counts, setCounts] = useState<VoteCounts>({ supporting: 0, opposing: 0 });
  const [myVote, setMyVote] = useState<Vote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    const table = parentType === "case" ? "sijill_case_votes" : "sijill_person_file_votes";
    const parentColumn = parentType === "case" ? "case_id" : "person_file_id";
    const [totals, { data: { user } }] = await Promise.all([
      supabase.rpc("sijill_vote_totals", {
        p_case_id: parentType === "case" ? parentId : null,
        p_person_file_id: parentType === "person_file" ? parentId : null,
      }),
      supabase.auth.getUser(),
    ]);
    const totalsRow = Array.isArray(totals.data) ? totals.data[0] : totals.data;
    setCounts({ supporting: Number(totalsRow?.supporting ?? 0), opposing: Number(totalsRow?.opposing ?? 0) });
    if (user) {
      const { data } = await supabase.from(table).select("position").eq(parentColumn, parentId).eq("user_id", user.id).maybeSingle();
      setMyVote((data?.position as Vote | undefined) ?? null);
    } else setMyVote(null);
  }, [parentId, parentType]);

  useEffect(() => { void refresh(); }, [refresh]);

  const castVote = async (position: Vote) => {
    if (busy) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setMessage("تعذر الاتصال الآن. حاول مرة أخرى."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const path = parentType === "case" ? `/cases/${parentId}` : `/files/${parentId}`;
      window.location.assign(`/account?mode=login&next=${encodeURIComponent(path)}`);
      return;
    }

    setBusy(true);
    setMessage("");
    const table = parentType === "case" ? "sijill_case_votes" : "sijill_person_file_votes";
    const parentColumn = parentType === "case" ? "case_id" : "person_file_id";
    const { error } = await supabase.from(table).upsert(
      { [parentColumn]: parentId, user_id: user.id, position },
      { onConflict: `${parentColumn},user_id` },
    );
    if (error) setMessage("تعذر تسجيل اختيارك. حاول مرة أخرى.");
    else { setMyVote(position); await refresh(); }
    setBusy(false);
  };

  return <section className="archive-vote-bar mt-4" aria-label="التأييد والرفض">
    <p className="sr-only">اختر موقفك من هذا السجل. يمكن تغيير الاختيار لاحقاً.</p>
    <button type="button" aria-pressed={myVote === "opposing"} disabled={busy} onClick={() => void castVote("opposing")} className={`archive-vote-button archive-vote-button--opposing ${myVote === "opposing" ? "is-selected" : ""}`}><span>رفض</span><span className="tabular-nums">{counts.opposing}</span></button>
    <button type="button" aria-pressed={myVote === "supporting"} disabled={busy} onClick={() => void castVote("supporting")} className={`archive-vote-button archive-vote-button--supporting ${myVote === "supporting" ? "is-selected" : ""}`}><span>تأييد</span><span className="tabular-nums">{counts.supporting}</span></button>
    {message && <p role="status" className="col-span-2 text-center text-xs text-amber-200">{message}</p>}
  </section>;
}
