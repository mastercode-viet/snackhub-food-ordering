import { Store, Truck } from "lucide-react";
import { motion } from "motion/react";
import { useOrderModeStore, useShouldChooseOrderMode } from "@/store/orderMode";

export default function OrderModeChooser() {
  const shouldChoose = useShouldChooseOrderMode();
  const setMode = useOrderModeStore((s) => s.setMode);

  if (!shouldChoose) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 md:items-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-card-lg bg-surface-container-lowest p-5 shadow-sheet"
      >
        <h2 className="text-headline-sm font-bold text-on-surface">Bạn muốn đặt hàng thế nào?</h2>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Chọn hình thức để tiếp tục. Bạn có thể đổi lại bằng cách mở link mới.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode("in_store", true)}
            className="flex items-center gap-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-card transition hover:shadow-card-hover"
          >
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <Store size={20} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg font-bold text-on-surface">Mua tại quán</span>
              <span className="block text-body-sm text-on-surface-variant">Đặt và nhận món tại quầy.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("delivery", true)}
            className="flex items-center gap-3 rounded-card border border-outline-variant bg-surface-container-lowest p-4 text-left shadow-card transition hover:shadow-card-hover"
          >
            <span className="grid size-10 place-items-center rounded-full bg-secondary/10 text-secondary">
              <Truck size={20} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg font-bold text-on-surface">Đặt giao hàng</span>
              <span className="block text-body-sm text-on-surface-variant">Giao tận nơi trong khuôn viên.</span>
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}