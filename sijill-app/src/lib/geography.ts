import geographyIndex from "@/data/geography-index.json";

export const geography = geographyIndex;
export type GeographyGovernorate = (typeof geographyIndex.governorates)[number];
export type GeographyDistrict = GeographyGovernorate["districts"][number];

export function placesInDistrict(district: GeographyDistrict) {
  return district.places;
}

export function findPlaceLocations(name: string) {
  return geography.governorates.flatMap((governorate) =>
    governorate.districts.flatMap((district) =>
      district.places.some((place) => place.name === name)
        ? [{ governorate, district }]
        : [],
    ),
  );
}
