import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { toIsoDate } from "@/lib/format";
import type { OrderDateRange } from "@/lib/queries";

export type { OrderDateRange };

function presetRange(days: number): { from: string; to: string } {
  const to = toIsoDate(new Date());
  const from = toIsoDate(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  return { from, to };
}

function sameRange(a: { from: string; to: string }, b: { from: string; to: string }): boolean {
  return a.from === b.from && a.to === b.to;
}

function isKnownPreset(value: OrderDateRange): boolean {
  if (value === "all") return true;
  return [1, 7, 30].some((days) => sameRange(value, presetRange(days)));
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/** Nhãn hiển thị cho 1 giá trị OrderDateRange — dùng lại được ở tiêu đề/empty-state của trang gọi component này. */
export function describeOrderDateRange(range: OrderDateRange): string {
  if (range === "all") return "Tất cả";
  if (sameRange(range, presetRange(1))) return "Hôm nay";
  if (sameRange(range, presetRange(7))) return "7 ngày qua";
  if (sameRange(range, presetRange(30))) return "30 ngày qua";
  return range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`;
}

const PRESETS: { key: string; label: string; range: OrderDateRange }[] = [
  { key: "all", label: "Tất cả", range: "all" },
  { key: "today", label: "Hôm nay", range: presetRange(1) },
  { key: "7d", label: "7 ngày qua", range: presetRange(7) },
  { key: "30d", label: "30 ngày qua", range: presetRange(30) },
];

/**
 * Bộ lọc lịch sử đơn theo khoảng thời gian: chip nhanh (Tất cả/Hôm nay/7
 * ngày/30 ngày) + tuỳ chọn Từ ngày–Đến ngày. Tuyệt đối không dùng border —
 * tách khỏi nền bằng bg-surface-container-lowest + shadow-card theo token M3
 * của Sagori (CLAUDE.md mục 3: "Card KHÔNG viền, tách khỏi nền bằng bóng").
 */
export default function OrderDateRangeFilter({
  value,
  onChange,
}: {
  value: OrderDateRange;
  onChange: (next: OrderDateRange) => void;
}) {
  const [showCustom, setShowCustom] = useState(() => !isKnownPreset(value));

  return (
    <div className="flex flex-col gap-2.5 rounded-card bg-surface-container-lowest p-3 shadow-card">
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        {PRESETS.map((p) => (
          <Chip
            key={p.key}
            label={p.label}
            active={p.range === "all" ? value === "all" : value !== "all" && sameRange(value, p.range)}
            onClick={() => {
              setShowCustom(false);
              onChange(p.range);
            }}
          />
        ))}
        <Chip
          label="Tuỳ chọn"
          icon={<CalendarRange size={13} strokeWidth={2.4} />}
          active={showCustom || !isKnownPreset(value)}
          onClick={() => setShowCustom((v) => !v)}
        />
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Từ ngày"
            value={value !== "all" ? value.from : ""}
            max={value !== "all" ? value.to : undefined}
            onChange={(e) =>
              onChange({ from: e.target.value, to: value !== "all" && value.to ? value.to : e.target.value })
            }
            className="h-11 min-w-0 flex-1 rounded-card bg-surface-container px-3 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-on-surface"
          />
          <span className="shrink-0 text-label-sm text-on-surface-variant">–</span>
          <input
            type="date"
            aria-label="Đến ngày"
            value={value !== "all" ? value.to : ""}
            min={value !== "all" ? value.from : undefined}
            onChange={(e) =>
              onChange({ from: value !== "all" && value.from ? value.from : e.target.value, to: e.target.value })
            }
            className="h-11 min-w-0 flex-1 rounded-card bg-surface-container px-3 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-on-surface"
          />
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label-sm transition-colors active:scale-95 ${
        active
          ? "bg-inverse-surface font-semibold text-inverse-on-surface shadow-cta"
          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
