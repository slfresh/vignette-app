"use client";

interface ResultSectionHeadingProps {
  title: string;
  subtitle?: string;
}

export function ResultSectionHeading({ title, subtitle }: ResultSectionHeadingProps) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}
    </div>
  );
}
