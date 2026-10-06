import { Bell, BellOff } from "lucide-react";

export default function OrderSoundToggle({
  enabled,
  blocked = false,
  onEnable,
  onDisable,
}: {
  enabled: boolean;
  /** Bật nhưng trình duyệt chưa cho phát — bấm nút này (hay chạm bất kỳ đâu) là kích hoạt. */
  blocked?: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => (enabled && !blocked ? onDisable() : onEnable())}
      aria-pressed={enabled}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-card border px-3 text-label-md font-semibold transition-colors ${
        enabled
          ? "border-secondary/40 bg-secondary/10 text-secondary"
          : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {enabled ? <Bell size={16} strokeWidth={2.2} /> : <BellOff size={16} strokeWidth={2.2} />}
      {!enabled ? "Bật âm báo đơn mới" : blocked ? "Âm báo: Bật · chạm để kích hoạt" : "Âm báo: Bật"}
    </button>
  );
}
