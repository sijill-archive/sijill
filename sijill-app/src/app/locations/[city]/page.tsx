import { redirect } from "next/navigation";
import aleppoMap from "@/data/aleppo-explorer.json";

export default async function CityFilterPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: rawCity } = await params;
  const city = decodeURIComponent(rawCity);
  const place = aleppoMap.districts.flatMap((district) => district.places).find((item) => item.slug === city || item.name === city);
  redirect(`/testimonies?city=${encodeURIComponent(place?.name ?? city)}`);
}
