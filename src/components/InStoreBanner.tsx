import { Store, X } from "lucide-react";
import { useIsInStore, useOrderModeStore } from "@/store/orderMode";

/**
 * Dải báo khách đang ở chế độ "Đặt tại quầy" (quét QR ở quầy) + nút thoát về giao hàng.
 *
 * Cố ý NỔI hơn các dải khác: chế độ này đổi cách đặt (không giao, không SĐT, không phí giao),
 * khách không nhận ra thì sẽ ngồi chờ giao tận chỗ. Nền cam nung (mảng màu hành động) + chữ
 * trắng 5.2:1 đạt AA; icon nằm trong chip trắng có quầng thở nhẹ để mắt dừng lại. Quầng chỉ
 * chạy khi máy không bật "giảm chuyển động" (motion-safe).
 */
export default function InStoreBanner() {
  const inStore = useIsInStore();
  const setMode = useOrderModeStore((s) => s.setMode);
  if (!inStore) return null;
  return (
    <div className="mx-margin-mobile mt-3 flex items-center gap-3 rounded-card bg-primary-container px-3.5 py-3 text-on-primary-container shadow-badge md:mx-gutter">
      <span className="relative grid size-10 shrink-0 place-items-center">
        <span
          aria-hidden="true"
          className="absolute -inset-1 rounded-full bg-surface-container-lowest/30 motion-safe:animate-pulse"
        />
        <span className="relative grid size-10 place-items-center rounded-full bg-surface-container-lowest text-primary">
          <Store size={20} strokeWidth={2.4} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label-lg">Bạn đang đặt tại quầy</p>
        <p className="text-body-sm">Đặt xong, đưa mã đơn cho nhân viên.</p>
      </div>
      <button
        type="button"
        onClick={() => setMode("delivery")}
        aria-label="Thoát chế độ đặt tại quầy"
        className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-container-lowest/15"
      >
        <X size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
