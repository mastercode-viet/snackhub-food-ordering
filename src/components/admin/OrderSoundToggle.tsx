import { Bell, BellOff } from "lucide-react";

export default function OrderSoundToggle({
  enabled,
  onEnable,
  onDisable,
}: {
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => (enabled ? onDisable() : onEnable())}
      aria-pressed={enabled}
      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-card border px-3 text-label-md font-semibold transition-colors ${
        enabled
          ? "border-secondary/40 bg-secondary/10 text-secondary"
          : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {enabled ? <Bell size={16} strokeWidth={2.2} /> : <BellOff size={16} strokeWidth={2.2} />}
      {enabled ? "Âm báo: Bật" : "Bật âm báo đơn mới"}
    </button>
  );
}
