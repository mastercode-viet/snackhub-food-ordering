import { Banknote, QrCode } from "lucide-react";

/**
 * Hai phương thức đúng như project hỗ trợ: PayOS (VietQR) và COD.
 *
 * Bản Stitch liệt kê "Ví MoMo, ZaloPay, Thẻ ATM / Visa, QR Pay" — project
 * không tích hợp cổng nào trong số đó, nên không hiển thị.
 *
 * PayOS đang khoá vì chưa có PAYOS_CLIENT_ID / API_KEY / CHECKSUM_KEY. Ô vẫn
 * hiện để khách biết sắp có, nhưng không bấm được — không phải nút giả.
 */
export default function PaymentMethods({
  value,
  onChange,
  payosEnabled,
}: {
  value: "cod" | "payos";
  onChange: (v: "cod" | "payos") => void;
  payosEnabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Phương thức thanh toán">
      <Option
        active={value === "payos"}
        disabled={!payosEnabled}
        onSelect={() => onChange("payos")}
        icon={<QrCode size={20} strokeWidth={2.2} />}
        title="Chuyển khoản VietQR"
        subtitle={payosEnabled ? "Quét mã bằng app ngân hàng, xác nhận tự động" : "Sắp có — quán đang kết nối cổng thanh toán"}
        badge={payosEnabled ? "Khuyên dùng" : "Sắp có"}
      />

      <Option
        active={value === "cod"}
        onSelect={() => onChange("cod")}
        icon={<Banknote size={20} strokeWidth={2.2} />}
        title="Thanh toán khi nhận hàng"
        subtitle="Trả tiền mặt khi quán giao món tới nơi"
      />
    </div>
  );
}

function Option({
  active,
  disabled = false,
  onSelect,
  icon,
  title,
  subtitle,
  badge,
}: {
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition-all ${
        disabled
          ? "cursor-not-allowed bg-surface-container-low/40 opacity-60"
          : active
            ? "bg-surface-container ring-2 ring-on-surface"
            : "bg-surface-container-low/70"
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full ${
          active ? "bg-inverse-surface text-inverse-on-surface" : "bg-surface-container-high text-on-surface-variant"
        }`}
      >
        {icon}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-label-lg text-on-surface">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-secondary-fixed/60 px-2 py-0.5 text-label-xs font-bold text-on-secondary-fixed">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 text-body-sm text-on-surface-variant">{subtitle}</span>
      </span>

      <span
        aria-hidden="true"
        className={`size-5 shrink-0 rounded-full border-2 transition-colors ${
          active ? "border-[6px] border-primary-container" : "border-outline-variant"
        }`}
      />
    </button>
  );
}
