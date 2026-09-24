import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAdminSession } from "@/hooks/useAdminSession";
import { AdminSidebarContext, type AdminSidebarState } from "@/hooks/useAdminSidebar";
import { AdminOrderAlertsContext } from "@/hooks/useAdminOrderAlerts";
import { useOrderNotification } from "@/hooks/useOrderNotification";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import { Skeleton } from "@/components/Skeleton";
import CheckInOutWidget from "@/components/admin/CheckInOutWidget";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

/** Cho các trang con đọc lại quyền qua `useOutletContext<AdminOutletContext>()` mà không phải gọi is_admin()/is_staff() lần nữa. */
export type AdminOutletContext = {
  isAdmin: boolean;
  isStaff: boolean;
  staffId: string | null;
  /** Email của phiên đang đăng nhập — dùng để xác nhận danh tính khi thao tác nhạy cảm (vd. thu tiền COD). */
  email: string;
};

/**
 * Vỏ khu vực Admin: Sidebar cố định trên desktop (>= lg), trượt thành Drawer
 * trên mobile (< lg) qua nút hamburger ở AdminHeader. Cố ý KHÔNG nằm trong
 * AppLayout — không bottom nav, không giỏ hàng: đây là màn của nhân viên,
 * không phải của người mua.
 */
export default function AdminLayout() {
  const { status, session, signOut, isAdmin, isStaff } = useAdminSession();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const orderAlerts = useOrderNotification();

  const sidebar = useMemo<AdminSidebarState>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
    }),
    [isOpen],
  );

  // Điều hướng xong thì tự đóng Drawer — không để overlay che mất trang mới trên mobile.
  useEffect(() => setIsOpen(false), [location.pathname]);

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-content px-margin-mobile py-10">
        <Skeleton className="h-12 w-full rounded-card" />
      </div>
    );
  }

  if (status === "anon") return <AdminLoginPage />;

  return (
    <AdminSidebarContext.Provider value={sidebar}>
      <AdminOrderAlertsContext.Provider value={orderAlerts}>
        <div className="min-h-dvh bg-surface lg:flex">
          <AdminSidebar isAdmin={isAdmin} isStaff={isStaff} pendingOrderCount={orderAlerts.pendingCount} />

          <div className="flex min-w-0 flex-1 flex-col">
            <AdminHeader email={session?.user.email ?? ""} onSignOut={() => void signOut()} />

            <main className="flex-1 px-margin-mobile py-5 md:px-gutter">
              <Outlet
                context={
                  {
                    isAdmin,
                    isStaff,
                    staffId: isStaff ? (session?.user.id ?? null) : null,
                    email: session?.user.email ?? "",
                  } satisfies AdminOutletContext
                }
              />
            </main>
          </div>

          {/* Widget Check-in/Check-out: cố định trên mọi màn Admin cho tài khoản có hồ sơ nhân viên. */}
          {isStaff && session && <CheckInOutWidget staffId={session.user.id} />}
        </div>
      </AdminOrderAlertsContext.Provider>
    </AdminSidebarContext.Provider>
  );
}
