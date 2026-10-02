type PrincipleCardProps = {
  number: string;
  title: string;
  description: string;
};

export function PrincipleCard({ number, title, description }: PrincipleCardProps) {
  return (
    <article className="border-t border-stone-300 pt-5 dark:border-stone-700">
      <span className="mb-8 inline-flex text-xs font-medium tracking-widest text-orange-600 dark:text-orange-400">{number}</span>
      <h3 className="mb-2 text-xl font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
      <p className="text-sm leading-7 text-stone-600 dark:text-stone-400">{description}</p>
    </article>
  );
}
