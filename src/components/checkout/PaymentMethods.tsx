import { Banknote, Info, QrCode } from "lucide-react";
import type { PaymentMethod } from "@/lib/checkoutSchema";

/**
 * Phương thức thanh toán: chỉ hiện những phương thức quán đang bật cho hình
 * thức đặt hiện tại (`allowed`, lấy từ store_settings — superadmin bật/tắt ở
 * /admin/cai-dat). Mặc định giao tận nơi chỉ có VietQR, tại quầy có thêm tiền mặt.
 * Bản quyết định vẫn là create-order: giao diện chỉ để khách không chọn nhầm.
 *
 * Bản Stitch liệt kê "Ví MoMo, ZaloPay, Thẻ ATM / Visa, QR Pay" — project
 * không tích hợp cổng nào trong số đó, nên không hiển thị.
 *
 * PayOS đang khoá khi chưa có PAYOS_CLIENT_ID / API_KEY / CHECKSUM_KEY. Ô vẫn
 * hiện để khách biết sắp có, nhưng không bấm được — không phải nút giả.
 */
export default function PaymentMethods({
  value,
  onChange,
  allowed,
  payosEnabled,
  inStore = false,
}: {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
  /** Phương thức quán đang bật cho hình thức đặt này. */
  allowed: Record<PaymentMethod, boolean>;
  payosEnabled: boolean;
  /** Đặt tại quầy: đổi nhãn tiền mặt ("Tiền mặt" thay vì "Thanh toán khi nhận hàng"). */
  inStore?: boolean;
}) {
  const both = allowed.payos && allowed.cod;
  const note = !allowed.payos && !allowed.cod
    ? "Quán đang tạm ngưng nhận thanh toán cho hình thức đặt này."
    : !allowed.cod
      ? inStore
        ? "Quán hiện chỉ nhận thanh toán online."
        : "Đơn giao tận nơi hiện chỉ nhận thanh toán online (VietQR)."
      : !allowed.payos
        ? inStore
          ? "Quán đang tạm tắt thanh toán online, bạn trả tiền mặt tại quầy nhé."
          : "Quán đang tạm tắt thanh toán online, bạn trả tiền khi nhận hàng nhé."
        : null;

  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Phương thức thanh toán">
      {allowed.payos && (
        <Option
          active={value === "payos"}
          disabled={!payosEnabled}
          onSelect={() => onChange("payos")}
          icon={<QrCode size={20} strokeWidth={2.2} />}
          title={inStore ? "Thanh toán Online" : "Chuyển khoản VietQR"}
          subtitle={payosEnabled ? "Quét mã bằng app ngân hàng, xác nhận tự động" : "Sắp có — quán đang kết nối cổng thanh toán"}
          // Chỉ còn một lựa chọn thì không cần nhãn "Khuyên dùng".
          badge={payosEnabled ? (both ? "Khuyên dùng" : undefined) : "Sắp có"}
        />
      )}

      {allowed.cod && (
        <Option
          active={value === "cod"}
          onSelect={() => onChange("cod")}
          icon={<Banknote size={20} strokeWidth={2.2} />}
          title={inStore ? "Tiền mặt" : "Thanh toán khi nhận hàng"}
          subtitle={inStore ? "Trả tiền mặt cho nhân viên tại quầy" : "Trả tiền mặt khi quán giao món tới nơi"}
        />
      )}

      {note && (
        <p className="flex items-start gap-1.5 text-label-md text-on-surface-variant">
          <Info size={14} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{note}</span>
        </p>
      )}
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
