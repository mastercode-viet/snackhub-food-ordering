import type { Tables } from "@/types/database";

/**
 * "Giao tận nơi" (delivery) / "Nhận tại quán" (pickup) — nhãn và chỗ nhận
 * dùng chung giữa trang khách, trang admin và thống kê.
 * Đơn pickup không có toà (building = null).
 */
export type DeliveryMethod = Tables<"orders">["delivery_method"];

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  delivery: "Giao tận nơi",
  pickup: "Nhận tại quán",
};

/** Nhóm/lọc theo "chỗ nhận": đơn giao theo toà, đơn pickup gom riêng một nhóm. */
export const PICKUP_GROUP = "Nhận tại quán";

export function placeKey(o: { delivery_method: DeliveryMethod; building: string | null }): string {
  return o.delivery_method === "pickup" || !o.building ? PICKUP_GROUP : o.building;
}

/** "Toà A" | "Nhận tại quán" */
export function placeLabel(o: { delivery_method: DeliveryMethod; building: string | null }): string {
  const key = placeKey(o);
  return key === PICKUP_GROUP ? PICKUP_GROUP : `Toà ${key}`;
}

/** Đơn pickup ở bước 'delivering' nghĩa là món đã xong, đang chờ khách tới lấy. */
export const PICKUP_READY_LABEL = "Chờ khách lấy";
