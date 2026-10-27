import { useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Chế độ đặt hàng của phiên: "delivery" (mặc định — giao tận nơi) hoặc
 * "in_store" (khách quét mã QR dán ở quầy, link có ?mode=in_store).
 *
 * Lưu sessionStorage: quét QR một lần là cả phiên duyệt menu → giỏ → thanh
 * toán đều ở chế độ tại quầy, dù các link nội bộ không mang theo ?mode. Đóng
 * tab là hết, lần sau mở link thường thì quay về giao hàng.
 */
export type OrderMode = "delivery" | "in_store";

type OrderModeState = {
  mode: OrderMode;
  chosen: boolean;
  setMode: (mode: OrderMode, chosen?: boolean) => void;
};

export const useOrderModeStore = create<OrderModeState>()(
  persist(
    (set) => ({
      mode: "delivery",
      chosen: false,
      setMode: (mode, chosen = true) => set({ mode, chosen }),
    }),
    { name: "snackhub-order-mode", storage: createJSONStorage(() => sessionStorage) },
  ),
);

export const useIsInStore = () => useOrderModeStore((s) => s.mode === "in_store");

/** Đọc ?mode=in_store (hoặc ?mode=delivery để thoát) trên mọi trang — gắn ở RootLayout. */
export function useOrderModeFromUrl() {
  const [params] = useSearchParams();
  const setMode = useOrderModeStore((s) => s.setMode);
  const param = params.get("mode");
  useEffect(() => {
    if (param === "in_store" || param === "delivery") setMode(param, true);
  }, [param, setMode]);
}

export function useShouldChooseOrderMode() {
  const location = useLocation();
  const chosen = useOrderModeStore((s) => s.chosen);
  const params = new URLSearchParams(location.search);
  const hasModeParam = params.get("mode") === "in_store" || params.get("mode") === "delivery";
  const isAdmin = location.pathname.startsWith("/admin");
  return !isAdmin && !chosen && !hasModeParam;
}
