export const LoadingSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="h-4 animate-pulse rounded bg-ink/10" />
    ))}
  </div>
);
