"use client";

import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SiteBackground() {
  useEffect(() => {
    const apply = (value: string | null | undefined) => {
      if (value && /^#[0-9a-fA-F]{6}$/.test(value)) document.documentElement.style.setProperty("--site-background", value);
    };
    const applyImage = (value: string | null | undefined) => {
      document.documentElement.style.setProperty("--site-background-image", value ? `url("${value}")` : "none");
    };
    apply(localStorage.getItem("sijill-site-background"));
    applyImage(localStorage.getItem("sijill-site-background-image"));
    const supabase = createBrowserSupabaseClient();
    if (supabase) void supabase.from("sijill_site_settings").select("background_color,background_image_url").eq("singleton", true).maybeSingle().then(({ data }) => {
      if (data?.background_color) { apply(data.background_color); localStorage.setItem("sijill-site-background", data.background_color); }
      if (data?.background_image_url) { applyImage(data.background_image_url); localStorage.setItem("sijill-site-background-image", data.background_image_url); }
      else if (data) { applyImage(null); localStorage.removeItem("sijill-site-background-image"); }
    });
  }, []);
  return <div className="site-background-layer" aria-hidden="true"><div className="site-background-blur"/><div className="site-background-shade"/></div>;
}
