import type { InputHTMLAttributes } from "react";

/** Ô nhập có nhãn + thông báo lỗi, dùng chung cho toàn bộ form đặt hàng. */
export default function Field({
  label,
  error,
  hint,
  required,
  ...inputProps
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-label-sm text-on-surface-variant">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>

      <input
        {...inputProps}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-2xl px-4 py-3 text-body-md text-on-surface transition-all placeholder:text-on-surface-variant/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-on-surface focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest ${
          error
            ? "bg-error-container focus:bg-error-container"
            : "bg-surface-container-low/70 focus:bg-surface-container"
        }`}
      />

      {error ? (
        <span className="text-body-sm text-error">{error}</span>
      ) : hint ? (
        <span className="text-body-sm text-on-surface-variant/70">{hint}</span>
      ) : null}
    </label>
  );
}
