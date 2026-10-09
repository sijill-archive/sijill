"use client";

import { useParams } from "next/navigation";
import { ContributorHistory } from "@/components/contributor-history";

export default function AdminContributorPage() {
  const { id } = useParams<{ id: string }>();
  return <ContributorHistory userId={id} admin/>;
}
