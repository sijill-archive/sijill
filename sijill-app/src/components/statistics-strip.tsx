export type Statistic = {
  label: string;
  value: string | number;
};

export function StatisticsStrip({
  items,
  tone = "adaptive",
  className = "",
}: {
  items: Statistic[];
  tone?: "adaptive" | "dark";
  className?: string;
}) {
  const colors = tone === "dark"
    ? "border-white/10 bg-white/[0.035] text-[#eff3e9]"
    : "border-stone-200 bg-white/75 text-[#1c2922] dark:border-stone-800 dark:bg-[#1a211d]/80 dark:text-[#f1f1e9]";
  const secondary = tone === "dark" ? "text-[#95a89b]" : "text-stone-500 dark:text-stone-400";
  const valueColor = tone === "dark" ? "text-[#e7d6ad]" : "text-[#194537] dark:text-[#c0dec2]";

  return (
    <dl className={`grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className={`rounded-2xl border px-4 py-3 text-right shadow-sm backdrop-blur-sm ${colors}`}>
          <dt className={`text-[10px] leading-5 ${secondary}`}>{item.label}</dt>
          <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${valueColor}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
