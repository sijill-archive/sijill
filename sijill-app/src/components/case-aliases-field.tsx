export function parseCaseAliases(values: FormData): string[] {
  const aliases = [...new Set(String(values.get("aliases") ?? "").split("\n").map((name) => name.trim()).filter(Boolean))];
  if (aliases.length > 10 || aliases.some((name) => name.length > 180)) throw new Error("أضف حتى 10 أسماء أخرى للقضية، بحد أقصى 180 حرفًا لكل اسم.");
  return aliases;
}

export function CaseAliasesField({ aliases = [] }: { aliases?: string[] }) {
  return <label className="block text-sm font-medium">أسماء أخرى للقضية <span className="font-normal text-stone-500">(اختياري)</span><textarea name="aliases" defaultValue={aliases.join("\n")} rows={2} maxLength={1809} placeholder="كل اسم في سطر مستقل" className="mt-2 w-full rounded-xl border border-stone-300 bg-transparent px-4 py-3 dark:border-stone-700"/><span className="mt-1 block text-xs font-normal leading-6 text-stone-500">أسماء متداولة لنفس الحدث فقط؛ تساعد الآخرين على العثور عليه دون إنشاء قضية مكررة.</span></label>;
}
