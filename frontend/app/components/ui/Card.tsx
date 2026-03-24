import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

export function Card({ className = "", children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-xl border border-brand-border bg-brand-surface shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
