import type { Metadata } from "next";
import { AccountForm } from "@/components/account-form";

export const metadata: Metadata = {
  title: "الحساب | سِجِلّ",
  description: "إنشاء حساب أو تسجيل الدخول إلى منصة سِجِلّ.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ mode?: string; next?: string }> }) {
  const { mode, next } = await searchParams;
  const nextPath = next === "/cases/new" || next === "/workspace?add=file" ? next : "/workspace";
  const accountMode = mode === "signup" || mode === "verified" || mode === "recovery" || mode === "update-password" ? mode : "login";
  return <AccountForm mode={accountMode} nextPath={nextPath} />;
}
