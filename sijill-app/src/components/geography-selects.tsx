"use client";

import { useMemo, useState } from "react";
import { geography } from "@/lib/geography";

type GeographySelectsProps = {
  required?: boolean;
  idPrefix: string;
  className?: string;
};

const inputClass = "mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#527764] disabled:opacity-50 dark:border-stone-700 dark:bg-[#121815]";

export function GeographySelects({ required = false, idPrefix, className = "" }: GeographySelectsProps) {
  const [governorateName, setGovernorateName] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [cityChoice, setCityChoice] = useState("");
  const governorate = geography.governorates.find((item) => item.name === governorateName);
  const districts = governorate?.districts ?? [];
  const selectedDistrict = districts.find((item) => item.id === districtId);
  const places = selectedDistrict?.places ?? [];

  const otherPlaces = useMemo(() => !selectedDistrict, [selectedDistrict]);

  return (
    <div className={`grid gap-4 sm:grid-cols-3 ${className}`}>
      <label className="block text-sm font-medium" htmlFor={`${idPrefix}-governorate`}>المحافظة{required && <span aria-hidden="true"> *</span>}
        <select id={`${idPrefix}-governorate`} name="governorate" required={required} value={governorateName} onChange={(event) => { setGovernorateName(event.target.value); setDistrictId(""); setCityChoice(""); }} className={inputClass}>
          <option value="">{required ? "اختر المحافظة" : "اختر المحافظة (اختياري)"}</option>
          {geography.governorates.map((item) => <option key={item.slug} value={item.name}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium" htmlFor={`${idPrefix}-district`}>المنطقة{required && <span aria-hidden="true"> *</span>}
        <select id={`${idPrefix}-district`} name="district" required={required} value={districtId} disabled={!governorate} onChange={(event) => { setDistrictId(event.target.value); setCityChoice(""); }} className={inputClass}>
          <option value="">{governorate ? (required ? "اختر المنطقة" : "اختر المنطقة (اختياري)") : "اختر المحافظة أولاً"}</option>
          {districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium" htmlFor={`${idPrefix}-city`}>المدينة أو البلدة{required && <span aria-hidden="true"> *</span>}
        <select id={`${idPrefix}-city`} name="city" required={required} value={cityChoice} disabled={!selectedDistrict} onChange={(event) => setCityChoice(event.target.value)} className={inputClass}>
          <option value="">{selectedDistrict ? (required ? "اختر المدينة أو البلدة" : "اختر المدينة أو البلدة (اختياري)") : "اختر المنطقة أولاً"}</option>
          {places.map((place) => <option key={place.slug || place.name} value={place.name}>{place.name}</option>)}
          <option value="__other__">مكان غير مدرج</option>
        </select>
        {cityChoice === "__other__" && <input name="cityOther" required={required} maxLength={120} placeholder="اكتب اسم المدينة أو القرية" className={inputClass} />}
      </label>
      {!required && <p className="sm:col-span-3 -mt-2 text-xs leading-6 text-stone-500 dark:text-stone-400">الموقع اختياري في ملف الشخص. اترك الخيارات فارغة إذا لم تكن المعلومة معروفة أو لا تنطبق.</p>}
      {otherPlaces && required && <p className="sm:col-span-3 -mt-2 text-xs leading-6 text-stone-500 dark:text-stone-400">يمكنك اختيار «مكان غير مدرج» وكتابة اسم القرية أو الموقع يدوياً.</p>}
    </div>
  );
}
