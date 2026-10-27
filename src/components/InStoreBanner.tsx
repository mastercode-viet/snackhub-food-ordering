import { Store, Truck } from "lucide-react";
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
  if (inStore) {
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
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-surface-container-lowest/40 bg-surface-container-lowest/20 p-1">
        <button
          type="button"
          onClick={() => setMode("delivery")}
          aria-pressed={!inStore}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-label-sm font-bold transition ${
            !inStore
              ? "bg-surface-container-lowest text-primary shadow-card"
              : "text-on-primary-container hover:bg-surface-container-lowest/40"
          }`}
        >
          <Truck size={14} strokeWidth={2.4} />
          Giao hàng
        </button>
        <button
          type="button"
          onClick={() => setMode("in_store")}
          aria-pressed={inStore}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-label-sm font-bold transition ${
            inStore
              ? "bg-surface-container-lowest text-primary shadow-card"
              : "text-on-primary-container hover:bg-surface-container-lowest/40"
          }`}
        >
          <Store size={14} strokeWidth={2.4} />
          Tại quán
        </button>
      </div>
    </div>
  );
  }

  return (
    <div className="mx-margin-mobile mt-2 flex items-center justify-end md:mx-gutter">
      <div className="flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1 shadow-card">
        <button
          type="button"
          onClick={() => setMode("delivery")}
          aria-pressed={!inStore}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-label-sm font-semibold transition ${
            !inStore
              ? "bg-secondary text-on-secondary shadow-card"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Truck size={14} strokeWidth={2.4} />
          Giao hàng
        </button>
        <button
          type="button"
          onClick={() => setMode("in_store")}
          aria-pressed={inStore}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-label-sm font-semibold transition ${
            inStore
              ? "bg-primary text-on-primary shadow-card"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Store size={14} strokeWidth={2.4} />
          Tại quán
        </button>
      </div>
    </div>
  );
}
