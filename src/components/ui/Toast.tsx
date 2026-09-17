import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useToastStore, type ToastTone } from "@/store/toast";

const TONE: Record<ToastTone, { bg: string; fg: string; Icon: typeof Info }> = {
  success: {
    bg: "bg-secondary-container",
    fg: "text-on-secondary-container",
    Icon: CheckCircle2,
  },
  error: { bg: "bg-error-container", fg: "text-on-error-container", Icon: AlertCircle },
  info: { bg: "bg-surface-container-lowest", fg: "text-on-surface", Icon: Info },
};

/**
 * Chỗ hiển thị toast, gắn một lần ở RootLayout.
 *
 * Đặt ở MÉP TRÊN vì mép dưới đã kín: Bottom Navigation ở các tab chính và
 * sticky add-to-cart / nút đặt hàng ở các màn toàn trang.
 */
export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-margin-mobile pt-safe"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-md flex-col gap-2 pt-3">
        {toasts.map((t) => {
          const { bg, fg, Icon } = TONE[t.tone];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-lift ${bg} ${fg}`}
            >
              <Icon size={18} strokeWidth={2.4} className="shrink-0" />
              <p className="min-w-0 flex-1 text-label-md">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="-m-1 shrink-0 p-1 opacity-70 transition-opacity hover:opacity-100"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
