import { Clock } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import type { Tables } from "@/types/database";

/** "06:00:00" -> "6:00" */
function shortTime(t: string): string {
  const [h, m] = t.split(":");
  return `${Number(h)}:${m}`;
}

/**
 * Badge giờ hoạt động. Thay cho badge "15-25p" của Stitch — project không có
 * cột nào lưu thời gian giao, còn giờ mở cửa thì có thật trong store_settings.
 */
export function StoreHoursBadge({ settings }: { settings: Tables<"store_settings"> | null }) {
  if (!settings) return <Skeleton className="h-8 w-24 rounded-full" />;

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full bg-surface-container-lowest px-2.5 py-1.5 border border-outline-variant shadow-card">
      <Clock size={16} className="text-primary" strokeWidth={2.5} />
      <span className="text-label-sm font-bold text-on-surface">
        {shortTime(settings.open_time)}–{shortTime(settings.close_time)}
      </span>
    </div>
  );
}

/** Dòng trạng thái quán, lấy từ RPC is_store_open() — không tự tính ở client. */
export function StoreStatusLine({ isOpen }: { isOpen: boolean | null }) {
  if (isOpen === null) return <Skeleton className="h-3.5 w-40" />;

  return (
    <span
      className={`flex items-center gap-1.5 text-label-sm font-bold uppercase tracking-wider ${
        isOpen ? "text-secondary" : "text-on-surface-variant"
      }`}
    >
      <span
        className={`size-2 rounded-full ${isOpen ? "animate-pulse bg-secondary" : "bg-outline"}`}
      />
      {isOpen ? "Đang nhận đơn" : "Ngoài giờ phục vụ"}
    </span>
  );
}

/**
 * Banner chặn đặt hàng ngoài giờ. Đây mới chỉ là lớp chặn ở giao diện —
 * Edge Function `create-order` vẫn kiểm tra lại bằng chính hàm is_store_open().
 */
export function StoreClosedBanner({ settings }: { settings: Tables<"store_settings"> | null }) {
  const range = settings ? `${shortTime(settings.open_time)}–${shortTime(settings.close_time)}` : "6:00–18:00";

  return (
    <div className="mx-margin-mobile mt-3 flex items-start gap-3 rounded-2xl bg-tertiary-fixed/70 p-3.5 shadow-card">
      <span className="text-xl" aria-hidden="true">
        🌙
      </span>
      <div>
        <p className="text-label-md text-on-tertiary-fixed">Quán đang tạm nghỉ</p>
        <p className="mt-0.5 text-body-sm text-on-tertiary-fixed-variant">
          SnackHub chỉ nhận đơn trong khung {range}. Bạn vẫn xem menu thoải mái, quay lại đặt sau nhé!
        </p>
      </div>
    </div>
  );
}
