/**
 * SegmentedControl — pill-shaped toggle for selecting one option from a set.
 * Active option has white bg + shadow, inactive is transparent.
 */

type Option = { label: string; value: string };

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-full border border-brand-border bg-brand-bg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
            value === opt.value
              ? "bg-brand-surface text-brand-text shadow-sm"
              : "text-brand-muted hover:text-brand-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
