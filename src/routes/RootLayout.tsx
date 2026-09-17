import { Outlet, ScrollRestoration } from "react-router-dom";
import ToastHost from "@/components/ui/Toast";

/**
 * Bọc ngoài cùng mọi route.
 *
 * Toast phải gắn ở đây chứ không phải trong AppLayout: các màn toàn trang
 * (chi tiết món, đặt hàng, theo dõi đơn) nằm ngoài AppLayout nên cũng cần
 * hiển thị được thông báo.
 */
export default function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastHost />
      <ScrollRestoration />
    </>
  );
}
