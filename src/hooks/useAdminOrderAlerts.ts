import { createContext, useContext } from "react";

/** Tách riêng khỏi AdminLayout.tsx theo đúng khuôn useAdminSidebar.ts để tránh vòng lặp import. */
export type AdminOrderAlertsState = {
  soundEnabled: boolean;
  enableSound: () => Promise<void>;
  disableSound: () => void;
  /** Số đơn "chờ xác nhận" hiện tại — hiển thị huy hiệu trên menu Đơn hàng. */
  pendingCount: number;
};

export const AdminOrderAlertsContext = createContext<AdminOrderAlertsState | null>(null);

/**
 * Âm báo đơn mới + số đếm badge — được cấp phát MỘT LẦN ở <AdminLayout>, không
 * phải ở từng trang con. Trước đây hook realtime này chỉ mount trong
 * AdminOrdersPage nên rời khỏi trang Đơn hàng (vd. sang Thực đơn) là mất luôn
 * âm báo dù kênh Supabase Realtime vẫn cần chạy xuyên suốt phiên Admin.
 */
export function useAdminOrderAlerts(): AdminOrderAlertsState {
  const ctx = useContext(AdminOrderAlertsContext);
  if (!ctx) throw new Error("useAdminOrderAlerts phải gọi bên trong <AdminLayout>.");
  return ctx;
}
