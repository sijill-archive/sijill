"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function useArchiveCounts(governorate?: string) {
  const [counts, setCounts] = useState({ cases: 0, files: 0 });

  useEffect(() => {
    let active = true;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    const load = async () => {
      let casesQuery = supabase.from("sijill_cases").select("id", { count: "exact", head: true }).eq("status", "published");
      let filesQuery = supabase.from("sijill_person_files").select("id", { count: "exact", head: true }).eq("status", "published");
      if (governorate) {
        casesQuery = casesQuery.eq("governorate", governorate);
        filesQuery = filesQuery.eq("governorate", governorate);
      }
      const [cases, files] = await Promise.all([casesQuery, filesQuery]);
      if (active) setCounts({ cases: cases.count ?? 0, files: files.count ?? 0 });
    };
    void load();
    return () => { active = false; };
  }, [governorate]);

  return counts;
}
