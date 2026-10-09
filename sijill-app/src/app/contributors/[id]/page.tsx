"use client";

import { useParams } from "next/navigation";
import { ContributorHistory } from "@/components/contributor-history";

export default function ContributorPage() {
  const { id } = useParams<{ id: string }>();
  return <main className="min-h-screen bg-[#131916] px-5 py-10"><div className="mx-auto max-w-4xl"><ContributorHistory userId={id}/></div></main>;
}
