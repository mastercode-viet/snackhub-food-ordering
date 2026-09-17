import { ChevronDown } from "lucide-react";

/** Ô chọn có nhãn + lỗi, dùng chung kiểu dáng với Field. */
export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-label-sm text-on-surface-variant">
        {label}
        {required && <span className="text-primary"> *</span>}
      </span>

      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={`w-full appearance-none rounded-2xl py-3 pl-4 pr-9 text-body-md text-on-surface transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-on-surface focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-lowest disabled:opacity-50 ${
            error ? "bg-error-container" : "bg-surface-container-low/70 focus:bg-surface-container"
          }`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          strokeWidth={2.4}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
      </div>

      {error && <span className="text-body-sm text-error">{error}</span>}
    </label>
  );
}
