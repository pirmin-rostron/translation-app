/**
 * Icons — stroke-based SVG icon set matching the design spec.
 * All icons are 20×20 viewBox, rendered at the size set by the parent (className).
 * Use: <Icons.Dashboard className="h-[18px] w-[18px]" />
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function wrap(children: React.ReactNode, props: IconProps, defaults?: Partial<IconProps>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...defaults}
      {...props}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  Dashboard: (p: IconProps) =>
    wrap(
      <>
        <rect x="2.5" y="2.5" width="6.5" height="8" rx="1.5" />
        <rect x="11" y="2.5" width="6.5" height="5" rx="1.5" />
        <rect x="11" y="9.5" width="6.5" height="8" rx="1.5" />
        <rect x="2.5" y="12.5" width="6.5" height="5" rx="1.5" />
      </>,
      p,
    ),
  Documents: (p: IconProps) =>
    wrap(
      <>
        <path d="M5 2.5h6l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
        <path d="M11 2.5V6.5h4" />
        <path d="M7 10h6M7 13h6M7 16h4" />
      </>,
      p,
    ),
  Projects: (p: IconProps) =>
    wrap(
      <path d="M2.5 6a2 2 0 0 1 2-2h3.5l2 2h5.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V6Z" />,
      p,
    ),
  Glossary: (p: IconProps) =>
    wrap(
      <>
        <path d="M4 3.5h9a3 3 0 0 1 3 3v10.5" />
        <path d="M4 3.5v12a1.5 1.5 0 0 0 1.5 1.5h10.5" />
        <path d="M7 7h6M7 10h4" />
      </>,
      p,
    ),
  Certified: (p: IconProps) =>
    wrap(
      <path d="M10 2.5l1.8 3.7 4.1.6-3 2.9.7 4.1-3.6-1.9-3.6 1.9.7-4.1-3-2.9 4.1-.6L10 2.5Z" />,
      p,
    ),
  Settings: (p: IconProps) =>
    wrap(
      <>
        <circle cx="10" cy="10" r="2.5" />
        <path d="M16.5 10a6.5 6.5 0 0 0-.1-1.1l1.7-1.3-1.6-2.8-2 .7a6.5 6.5 0 0 0-1.9-1.1l-.3-2.1h-3.2l-.3 2.1a6.5 6.5 0 0 0-1.9 1.1l-2-.7-1.6 2.8 1.7 1.3a6.5 6.5 0 0 0 0 2.2l-1.7 1.3 1.6 2.8 2-.7a6.5 6.5 0 0 0 1.9 1.1l.3 2.1h3.2l.3-2.1a6.5 6.5 0 0 0 1.9-1.1l2 .7 1.6-2.8-1.7-1.3c.07-.36.1-.73.1-1.1Z" />
      </>,
      p,
    ),
  Plus: (p: IconProps) =>
    wrap(
      <path d="M10 4.5v11M4.5 10h11" />,
      p,
      { strokeWidth: 2 },
    ),
  Search: (p: IconProps) =>
    wrap(
      <>
        <circle cx="9" cy="9" r="5.5" />
        <path d="m13.5 13.5 3 3" />
      </>,
      p,
    ),
  Arrow: (p: IconProps) =>
    wrap(
      <path d="M5 10h10M11 6l4 4-4 4" />,
      p,
    ),
  Sparkle: (p: IconProps) => (
    <svg viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path d="M10 1.5l1.6 4.8a3 3 0 0 0 1.9 1.9l4.8 1.6-4.8 1.6a3 3 0 0 0-1.9 1.9L10 16.4l-1.6-4.7a3 3 0 0 0-1.9-1.9L1.7 8.2l4.8-1.6a3 3 0 0 0 1.9-1.9L10 1.5Z" />
    </svg>
  ),
  Check: (p: IconProps) =>
    wrap(
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
      p,
      { strokeWidth: 2 },
    ),
  ChevronDown: (p: IconProps) => (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m3 4.5 3 3 3-3" />
    </svg>
  ),
  HLogo: (p: IconProps) => (
    <svg viewBox="0 0 20 20" {...p}>
      <path d="M4 3h3v14H4zM13 3h3v14h-3zM7 9h6v2H7z" fill="currentColor" />
    </svg>
  ),
} as const;
