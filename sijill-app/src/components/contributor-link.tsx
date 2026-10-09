import Link from "next/link";

export function ContributorLink({ userId, name, admin = false }: { userId: string | null | undefined; name?: string; admin?: boolean }) {
  const label = name?.trim() || "مستخدم سِجِلّ";
  if (!userId) return <span>صاحب الإضافة غير مسجل</span>;
  return <Link href={`${admin ? "/admin" : ""}/contributors/${userId}`} className="underline decoration-current/40 underline-offset-4 hover:decoration-current" title="عرض سجل مساهمات صاحب الإضافة">{label}</Link>;
}
