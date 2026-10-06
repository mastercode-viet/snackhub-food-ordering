import type { Tables } from "@/types/database";

/**
 * "Giao tận nơi" (delivery) / "Tại quầy" (in_store — khách quét QR ở quầy, URL
 * ?mode=in_store, tự đặt rồi đưa mã đơn cho nhân viên). Nhãn và chỗ nhận dùng
 * chung giữa trang khách, trang admin và thống kê.
 * Đơn tại quầy không có toà, không có số điện thoại, không hẹn giờ.
 */
export type DeliveryMethod = Tables<"orders">["delivery_method"];

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  delivery: "Giao tận nơi",
  in_store: "Tại quầy",
};

/** Nhóm/lọc theo "chỗ nhận": đơn giao theo toà, đơn tại quầy gom riêng một nhóm. */
export const IN_STORE_GROUP = "Tại quầy";

export function placeKey(o: { delivery_method: DeliveryMethod; building: string | null }): string {
  return o.delivery_method === "in_store" || !o.building ? IN_STORE_GROUP : o.building;
}

/** "Toà A" | "Tại quầy" */
export function placeLabel(o: { delivery_method: DeliveryMethod; building: string | null }): string {
  const key = placeKey(o);
  return key === IN_STORE_GROUP ? IN_STORE_GROUP : `Toà ${key}`;
}
