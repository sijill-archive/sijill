"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SiteBackground() {
  useEffect(() => {
    const apply = (value: string | null | undefined) => {
      if (value && /^#[0-9a-fA-F]{6}$/.test(value)) document.documentElement.style.setProperty("--site-background", value);
    };
    apply(localStorage.getItem("sijill-site-background"));
    const supabase = createBrowserSupabaseClient();
    if (supabase) void supabase.from("sijill_site_settings").select("background_color").eq("singleton", true).maybeSingle().then(({ data }) => {
      if (data?.background_color) { apply(data.background_color); localStorage.setItem("sijill-site-background", data.background_color); }
    });
  }, []);
  return null;
}
