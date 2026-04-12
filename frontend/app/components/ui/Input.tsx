import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helper?: string;
  className?: string;
};

export function Input({
  label,
  error,
  helper,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-brand-text"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`rounded-lg border px-3 py-2 text-sm text-brand-text placeholder-brand-subtle outline-none transition-colors focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-status-error" : "border-brand-border"
        } ${className}`}
      />
      {error && (
        <p className="text-xs text-status-error">{error}</p>
      )}
      {!error && helper && (
        <p className="text-xs text-brand-muted">{helper}</p>
      )}
    </div>
  );
}
