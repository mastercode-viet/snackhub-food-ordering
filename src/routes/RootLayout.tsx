import { Outlet, ScrollRestoration } from "react-router-dom";
import ToastHost from "@/components/ui/Toast";
import { useOrderModeFromUrl } from "@/store/orderMode";

/**
 * Bọc ngoài cùng mọi route.
 *
 * Toast phải gắn ở đây chứ không phải trong AppLayout: các màn toàn trang
 * (chi tiết món, đặt hàng, theo dõi đơn) nằm ngoài AppLayout nên cũng cần
 * hiển thị được thông báo.
 */
export default function RootLayout() {
  // ?mode=in_store (mã QR dán ở quầy) → cả phiên đặt hàng ở chế độ tại quầy.
  useOrderModeFromUrl();
  return (
    <>
      <Outlet />
      <ToastHost />
      <ScrollRestoration />
    </>
  );
}
