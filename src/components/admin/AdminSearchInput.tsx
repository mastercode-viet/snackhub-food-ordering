import { Search, X } from "lucide-react";

/** Ô tìm kiếm dùng chung cho các màn danh sách Admin — border outline-variant, không gradient, theo CLAUDE.md mục 3. */
export default function AdminSearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        size={16}
        strokeWidth={2.2}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
      />
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest pl-9 pr-9 text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/60 focus-visible:ring-2 focus-visible:ring-primary-container [&::-webkit-search-cancel-button]:hidden"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Xoá từ khoá"
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <X size={15} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
