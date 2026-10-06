import type { Tables } from "@/types/database";

/**
 * Cảnh báo cho đơn có "Giờ muốn nhận" (desired_delivery_time). Dùng chung giữa
 * trang /admin/don-hang (màu thẻ, ghim, sắp xếp) và chuông + pop-up toàn cục
 * (useScheduledOrderAlerts) — chỉ định nghĩa ngưỡng ở đúng một chỗ.
 *
 * Chỉ cảnh báo khi đơn CHƯA chuyển sang "Đang giao": đã giao đi rồi thì không
 * còn gì để nhắc bếp.
 */
export const DESIRED_WARNING_MINUTES = 15;
export const DESIRED_CRITICAL_MINUTES = 5;

export type DesiredLevel = "normal" | "warning" | "critical";

type OrderStatus = Tables<"orders">["status"];

/** Đơn hẹn giờ còn cần nhắc: có giờ hẹn và đang chờ xác nhận / đang làm. */
export function isAwaitingScheduled(order: { desired_delivery_time: string | null; status: OrderStatus }): boolean {
  return (
    order.desired_delivery_time !== null && (order.status === "pending_confirmation" || order.status === "preparing")
  );
}

export function getDesiredDeliverySla(
  desiredIso: string,
  now: number,
): { minutesLeft: number; level: DesiredLevel; label: string } {
  const due = new Date(desiredIso);
  // Làm tròn lên: còn 4 phút 10 giây vẫn hiện "còn 5p", chạm 0 mới tính là trễ.
  const minutesLeft = Math.ceil((due.getTime() - now) / 60_000);

  const level: DesiredLevel =
    minutesLeft <= DESIRED_CRITICAL_MINUTES ? "critical" : minutesLeft <= DESIRED_WARNING_MINUTES ? "warning" : "normal";
  // Giờ hẹn đã hiện riêng (chip "Giao 16:30") nên nhãn chỉ nói còn/trễ bao lâu.
  const label = minutesLeft > 0 ? `còn ${minutesLeft}p` : `trễ hẹn ${-minutesLeft}p`;
  return { minutesLeft, level, label };
}

/** "16:30" — giờ hẹn hiển thị gọn. */
export function formatDesiredTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
