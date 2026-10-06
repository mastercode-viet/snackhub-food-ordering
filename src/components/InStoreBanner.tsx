import { Store, X } from "lucide-react";
import { useIsInStore, useOrderModeStore } from "@/store/orderMode";

/** Dải nhắc khách đang ở chế độ "Đặt tại quầy" (quét QR ở quầy) + nút thoát về giao hàng. */
export default function InStoreBanner() {
  const inStore = useIsInStore();
  const setMode = useOrderModeStore((s) => s.setMode);
  if (!inStore) return null;
  return (
    <div className="mx-margin-mobile mt-3 flex items-center gap-2 rounded-card bg-inverse-surface px-3 py-2 text-inverse-on-surface md:mx-gutter">
      <Store size={16} strokeWidth={2.4} className="shrink-0" />
      <p className="min-w-0 flex-1 text-label-md">
        Bạn đang <strong>đặt tại quầy</strong> — đặt xong đưa mã đơn cho nhân viên.
      </p>
      <button
        type="button"
        onClick={() => setMode("delivery")}
        aria-label="Thoát chế độ đặt tại quầy"
        className="grid size-9 shrink-0 place-items-center rounded-full opacity-80 transition-opacity hover:opacity-100"
      >
        <X size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}
