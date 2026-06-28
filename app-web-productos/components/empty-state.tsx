"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type EmptyStateAction =
  | {
      label: string;
      href: string;
      onClick?: never;
    }
  | {
      label: string;
      onClick: () => void;
      href?: never;
    };

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  className?: string;
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-lowest)] px-5 py-10 text-center shadow-[var(--shadow-soft)] ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f2ecff] text-[var(--primary)]">
        <Icon size={23} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-[var(--on-surface)]">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
        {description}
      </p>
      {action ? (
        action.href ? (
          <Link href={action.href} className="btn-primary mt-5">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="btn-primary mt-5">
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
