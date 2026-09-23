/**
 * Mấy mảnh form dùng chung cho khu Admin.
 *
 * Tách khỏi AdminCatalogPage khi màn Banner cần đúng ba thứ này — chép lại
 * nghĩa là sửa chiều cao vùng bấm hay vòng focus ở một màn rồi quên màn kia.
 * Mọi control ở đây đều cao tối thiểu 44px và có focus ring, vì Admin chạy
 * trên máy dùng chung tại quầy, hay bấm bằng ngón tay.
 */

import { motion } from "motion/react";

export const inputClass =
  "min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container";

/**
 * Ô nhập tiền: gõ số trần nhưng hiện dấu chấm phân cách hàng nghìn ngay khi
 * gõ (30000 -> "30.000"), khớp cách `formatVnd` hiển thị chỗ khác trong app —
 * dễ đọc/dễ nhập số lớn hơn input số trần. VNĐ không có số lẻ nên giá trị
 * qua lại vẫn luôn là số nguyên, chỉ phần hiển thị đổi.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  inputClassName = "",
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  /** Nối thêm vào `inputClass` mặc định, dùng khi ô tiền cần nhấn mạnh (vd giá bán combo). */
  inputClassName?: string;
}) {
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString("vi-VN") : ""}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        className={`${inputClass} pr-8 ${inputClassName}`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant">
        đ
      </span>
    </div>
  );
}

export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      {children}
      {hint && <span className="text-label-xs text-on-surface-variant">{hint}</span>}
    </label>
  );
}

/**
 * Track + núm tròn trượt bằng spring animation — phần hiển thị thuần của
 * công tắc bật/tắt, không tự bắt sự kiện (bọc trong button ở component gọi).
 * `tone="danger"` dành cho các trạng thái "tạm hết/ngừng" cần nổi bật cảnh
 * báo hơn (món, topping hết hàng) so với on/off trung tính (banner, mã giảm giá).
 */
export function SwitchTrack({ on, tone = "neutral" }: { on: boolean; tone?: "neutral" | "danger" }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        on ? "bg-secondary" : tone === "danger" ? "bg-error/70" : "bg-outline-variant"
      }`}
    >
      <motion.span
        className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-card"
        animate={{ x: on ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
      />
    </span>
  );
}

export function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-[44px] items-center justify-between gap-3 rounded-card border border-outline-variant px-3 text-left transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
    >
      <span className="min-w-0">
        <span className="block text-body-md text-on-surface">{label}</span>
        <span className="block text-label-xs text-on-surface-variant">{hint}</span>
      </span>
      <SwitchTrack on={on} />
    </button>
  );
}

/**
 * Công tắc bật/tắt dùng trong hàng danh sách (còn/hết hàng, kích hoạt...):
 * nhãn đổi theo trạng thái + track trượt animate. `onChange` không nhận
 * tham số — nơi gọi đã biết trạng thái hiện tại qua closure (giống các
 * `onToggle` sẵn có ở AdminCatalogPage/AdminCombosPage/...).
 */
export function LabeledSwitch({
  on,
  onChange,
  onLabel,
  offLabel,
  tone = "neutral",
}: {
  on: boolean;
  onChange: () => void;
  onLabel: string;
  offLabel: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-2.5 text-label-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container ${
        on ? "text-on-surface" : tone === "danger" ? "text-error" : "text-on-surface-variant"
      }`}
    >
      {on ? onLabel : offLabel}
      <SwitchTrack on={on} tone={tone} />
    </button>
  );
}
