type EvidenceCardProps = {
  level: number;
  title: string;
};

export function EvidenceCard({ level, title }: EvidenceCardProps) {
  return (
    <article className="group rounded-2xl border border-stone-200 bg-white/70 p-5 transition duration-200 hover:-translate-y-1 hover:border-emerald-800/30 hover:shadow-lg hover:shadow-emerald-950/5 dark:border-stone-800 dark:bg-stone-900/70 dark:hover:border-emerald-300/30 dark:hover:shadow-black/20">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-xs font-medium text-stone-500 dark:text-stone-400">مستوى التوثيق</span>
        <span className="grid size-10 place-items-center rounded-full bg-emerald-950 text-sm font-semibold text-white dark:bg-emerald-200 dark:text-emerald-950">{level}</span>
      </div>
      <div className="mb-4 flex gap-1.5" aria-label={`المستوى ${level} من ٥`}>
        {Array.from({ length: 5 }, (_, index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < level ? "bg-orange-500" : "bg-stone-200 dark:bg-stone-700"}`} />)}
      </div>
      <h3 className="text-base font-semibold leading-7 text-stone-900 dark:text-stone-100">{title}</h3>
    </article>
  );
}
