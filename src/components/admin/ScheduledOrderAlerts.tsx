import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlarmClock, BellRing, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ScheduledAlert } from "@/hooks/useScheduledOrderAlerts";
import { formatDesiredTime, getDesiredDeliverySla } from "@/lib/orderSla";

/**
 * Pop-up nổi khi đơn hẹn giờ chạm mốc cảnh báo — hiện trên mọi trang /admin/*.
 * Vàng (còn ≤ 15p) dùng tertiary-fixed, đỏ (còn ≤ 5p / trễ) dùng error-container.
 */
export default function ScheduledOrderAlerts({
  alerts,
  onDismiss,
  soundEnabled,
  onEnableSound,
}: {
  alerts: ScheduledAlert[];
  onDismiss: (orderId: string) => void;
  /** Trình duyệt chỉ cho phát âm sau khi Admin bấm bật — chưa bật thì hiện nút ngay trên pop-up. */
  soundEnabled: boolean;
  onEnableSound: () => void;
}) {
  const navigate = useNavigate();
  // Đếm lại "còn X phút" trong lúc pop-up đang mở.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (alerts.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [alerts.length]);

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-0 z-[55] flex flex-col items-center gap-2 px-margin-mobile pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] lg:items-end lg:px-6"
    >
      <AnimatePresence initial={false}>
        {alerts.slice(0, 3).map((a) => {
          const { minutesLeft } = getDesiredDeliverySla(a.desiredAt, now);
          const critical = a.level === "critical";
          return (
            <motion.div
              key={a.orderId}
              role="alertdialog"
              aria-label={`Đơn hẹn giờ ${a.orderCode}`}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className={`pointer-events-auto w-full max-w-sm rounded-card-lg p-4 shadow-sheet ${
                critical ? "bg-error-container text-on-error-container" : "bg-tertiary-fixed text-on-tertiary-fixed"
              }`}
            >
              <div className="flex items-start gap-3">
                <AlarmClock size={20} strokeWidth={2.4} className={`mt-0.5 shrink-0 ${critical ? "animate-bounce" : ""}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-label-lg">
                    {minutesLeft > 0 ? `Còn ${minutesLeft} phút tới giờ hẹn` : `Trễ hẹn ${-minutesLeft} phút`}
                  </p>
                  <p className="mt-0.5 text-body-sm">
                    Đơn <strong className="font-mono">{a.orderCode}</strong> · {a.customerName} · Toà {a.building} — hẹn nhận{" "}
                    {formatDesiredTime(a.desiredAt)}, chưa chuyển "Đang giao".
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(a.orderId)}
                  aria-label="Đóng cảnh báo"
                  className="-m-1 grid size-9 shrink-0 place-items-center rounded-full opacity-80 transition-opacity hover:opacity-100"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {!soundEnabled && (
                  <button
                    type="button"
                    onClick={onEnableSound}
                    className="mr-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md"
                  >
                    <BellRing size={16} strokeWidth={2.4} />
                    Bật chuông
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismiss(a.orderId)}
                  className="min-h-[40px] rounded-card border border-outline-variant px-3 text-label-md"
                >
                  Đã biết
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDismiss(a.orderId);
                    navigate(`/admin/don-hang?don=${a.orderId}`);
                  }}
                  className="min-h-[40px] rounded-card bg-inverse-surface px-3 text-label-md font-semibold text-inverse-on-surface"
                >
                  Xem đơn
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
