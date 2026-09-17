import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Mã các đơn đã đặt trên máy này.
 *
 * Khách không đăng nhập nên server không có cách nào biết "đơn của ai" —
 * mã đơn ngẫu nhiên chính là thứ duy nhất để tra cứu. Giữ lại ở localStorage
 * để khách không phải chép tay, nhưng mất máy/xoá dữ liệu là mất danh sách,
 * nên màn tra cứu vẫn luôn có ô nhập mã thủ công.
 */
export type RecentOrder = { code: string; savedAt: string };

type RecentOrdersState = {
  orders: RecentOrder[];
  remember: (code: string) => void;
  forget: (code: string) => void;
};

const MAX_KEPT = 10;

export const useRecentOrders = create<RecentOrdersState>()(
  persist(
    (set) => ({
      orders: [],

      remember: (code) =>
        set((state) => ({
          orders: [
            { code, savedAt: new Date().toISOString() },
            ...state.orders.filter((o) => o.code !== code),
          ].slice(0, MAX_KEPT),
        })),

      forget: (code) =>
        set((state) => ({ orders: state.orders.filter((o) => o.code !== code) })),
    }),
    { name: "snackhub-recent-orders", version: 1 },
  ),
);
