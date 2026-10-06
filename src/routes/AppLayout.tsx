import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import InStoreBanner from "@/components/InStoreBanner";

/**
 * Khung 4 tab chính. Các màn hình toàn trang (chi tiết món, theo dõi đơn)
 * nằm ngoài layout này vì chúng dùng sticky bar riêng ở mép dưới.
 *
 * Mobile: chừa đáy cho thanh nav nổi.
 * Desktop: chừa đỉnh cho thanh nav ngang (h-16) và giới hạn bề rộng cột nội
 * dung — nội dung kéo dãn hết màn 27 inch thì mắt phải quét quá xa.
 */
export default function AppLayout() {
  return (
    <div className="min-h-dvh bg-background">
      {/* pb-nav-gap chừa chỗ cho thanh nav nổi, tránh che nội dung cuối trang */}
      <main className="mx-auto w-full max-w-content pb-nav-gap md:pb-12 md:pt-20">
        <InStoreBanner />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
