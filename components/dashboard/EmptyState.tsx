interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-wrapped-border py-16 text-center">
      <p className="font-display text-lg font-semibold text-neutral-200">{title}</p>
      <p className="max-w-sm text-sm text-neutral-500">{description}</p>
    </div>
  );
}
