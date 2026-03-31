interface StatCardProps {
  title: string;
  value: string;
  trend: string;
}

export const StatCard = ({ title, value, trend }: StatCardProps) => (
  <article className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-ink/60">{title}</p>
    <p className="mt-2 text-2xl font-semibold">{value}</p>
    <p className="mt-1 text-sm text-moss">{trend}</p>
  </article>
);
