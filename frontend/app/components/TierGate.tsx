"use client";

import type { ReactNode } from "react";

type TierName = "free" | "pro" | "business" | "agency";

const FEATURE_TIERS: Record<string, TierName[]> = {
  manual_review: ["pro", "business", "agency"],
  create_projects: ["pro", "business", "agency"],
  reference_docs: ["business", "agency"],
  glossary: ["pro", "business", "agency"],
};

type TierGateProps = {
  feature: string;
  tier: string;
  children: ReactNode;
  fallback?: ReactNode;
};

export function TierGate({ feature, tier, children, fallback }: TierGateProps) {
  const allowedTiers = FEATURE_TIERS[feature];
  if (!allowedTiers) return <>{children}</>;

  const hasAccess = allowedTiers.includes(tier as TierName);
  if (hasAccess) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const requiredTier = allowedTiers[0] ?? "Pro";
  const tierLabel = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1);

  return (
    <div className="rounded-lg border border-brand-border bg-brand-bg p-4 text-center">
      <p className="text-sm font-medium text-brand-text">Upgrade to unlock</p>
      <p className="mt-1 text-xs text-brand-muted">
        This feature requires {tierLabel} or higher.
      </p>
      <button
        type="button"
        className="mt-3 rounded-full bg-brand-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-accentHov"
      >
        Upgrade to {tierLabel}
      </button>
    </div>
  );
}
