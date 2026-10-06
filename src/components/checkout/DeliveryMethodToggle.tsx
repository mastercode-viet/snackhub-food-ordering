import { Store, Truck } from "lucide-react";
import { motion } from "motion/react";

type Method = "delivery" | "pickup";

const OPTIONS: Array<{ value: Method; label: string; hint: string; icon: typeof Truck }> = [
  { value: "delivery", label: "Giao tận nơi", hint: "Giao tới tầng 1 các toà", icon: Truck },
  { value: "pickup", label: "Nhận tại quán", hint: "Miễn phí giao · tự đến lấy", icon: Store },
];

/**
 * Thanh chọn "Giao tận nơi" / "Nhận tại quán" đầu trang thanh toán. Viền
 * outline-variant, lựa chọn đang bật nền inverse-surface (đúng CLAUDE.md);
 * nền trượt giữa hai ô bằng Motion `layoutId`.
 */
export default function DeliveryMethodToggle({ value, onChange }: { value: Method; onChange: (v: Method) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Hình thức nhận hàng"
      className="grid grid-cols-2 gap-1 rounded-card-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-card"
    >
      {OPTIONS.map(({ value: v, label, hint, icon: Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={`relative flex min-h-[56px] items-center justify-center gap-2 rounded-card px-2 py-2 text-left transition-colors ${
              active ? "text-inverse-on-surface" : "text-on-surface hover:bg-surface-container-low"
            }`}
          >
            {active && (
              <motion.span
                layoutId="delivery-method-active"
                className="absolute inset-0 -z-0 rounded-card bg-inverse-surface shadow-cta"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon size={20} strokeWidth={2.4} className="relative shrink-0" />
            <span className="relative min-w-0">
              <span className="block text-label-lg">{label}</span>
              <span className={`block truncate text-label-xs ${active ? "opacity-90" : "text-on-surface-variant"}`}>
                {hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
