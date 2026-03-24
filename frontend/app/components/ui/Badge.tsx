import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "error" | "info";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default:  "bg-brand-bg text-brand-muted border border-brand-border",
  accent:   "bg-brand-accentMid text-brand-accent border border-brand-accent/20",
  success:  "bg-status-successBg text-status-success border border-status-success/20",
  warning:  "bg-status-warningBg text-status-warning border border-status-warning/20",
  error:    "bg-status-errorBg text-status-error border border-status-error/20",
  info:     "bg-status-infoBg text-status-info border border-status-info/20",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
