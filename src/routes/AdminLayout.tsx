import { NavLink, Outlet } from "react-router-dom";
import { LogOut, ShoppingBag, Store } from "lucide-react";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useStoreOpen, useStoreSettings } from "@/hooks/useMenu";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import { Skeleton } from "@/components/Skeleton";

/**
 * Vỏ khu vực Admin: sidebar cố định trên desktop, thanh trên cùng có trạng
 * thái quán và tài khoản. Cố ý KHÔNG nằm trong AppLayout — không bottom nav,
 * không giỏ hàng: đây là màn của nhân viên, không phải của người mua.
 *
 * Sidebar chỉ liệt kê những màn CÓ THẬT. Không dựng mục "Tổng quan",
 * "Đơn đặt hàng" cho đẹp rồi bấm vào không ra gì.
 */
export default function AdminLayout() {
  const { status, session, signOut } = useAdminSession();

  if (status === "checking") {
    return (
      <div className="mx-auto w-full max-w-content px-margin-mobile py-10">
        <Skeleton className="h-12 w-full rounded-card" />
      </div>
    );
  }

  if (status === "anon") return <AdminLoginPage />;

  return (
    <div className="min-h-dvh bg-surface lg:flex">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={session?.user.email ?? ""} onSignOut={() => void signOut()} />

        <main className="flex-1 px-margin-mobile py-5 md:px-gutter">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  const settings = useStoreSettings();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-outline-variant bg-surface-container-lowest lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-card bg-inverse-surface text-inverse-on-surface">
          <ShoppingBag size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-label-lg text-on-surface">SnackHub Admin</p>
          <p className="truncate text-label-xs text-on-surface-variant">Giao tận lớp</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        <p className="px-2 pb-1 pt-3 text-label-xs uppercase tracking-wide text-on-surface-variant">
          Quản lý
        </p>
        <SidebarLink to="/admin/don-hang" label="Đơn hàng" />
        <SidebarLink to="/admin/thuc-don" label="Thực đơn" />
        <SidebarLink to="/admin/thong-ke" label="Thống kê" />
        <SidebarLink to="/admin/toppings" label="Nhóm topping" />
      </nav>

      <div className="mt-auto p-3">
        <div className="rounded-card bg-surface-container-low p-3">
          <p className="flex items-center gap-1.5 text-label-sm text-on-surface">
            <Store size={14} strokeWidth={2.2} />
            {settings.data?.store_name ?? "SnackHub"}
          </p>
          {settings.data && (
            <p className="mt-0.5 text-label-xs text-on-surface-variant">
              Nhận đơn {settings.data.open_time.slice(0, 5)}–{settings.data.close_time.slice(0, 5)}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-[44px] items-center rounded-card px-3 text-label-md transition-colors ${
          isActive
            ? "bg-primary-container text-on-primary-container"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function TopBar({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const storeOpen = useStoreOpen();

  return (
    <header className="border-b border-outline-variant bg-surface-container-lowest">
      <div className="flex items-center gap-3 px-margin-mobile py-3 md:px-gutter">
        <span className="text-label-lg text-on-surface lg:hidden">SnackHub Admin</span>

        <div className="ml-auto flex items-center gap-2.5">
          {storeOpen.data !== null && <StorePill open={storeOpen.data === true} />}

          <span className="hidden max-w-[16ch] truncate text-label-sm text-on-surface-variant sm:inline">
            {email}
          </span>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <LogOut size={16} strokeWidth={2.2} />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function StorePill({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label-sm ${
        open
          ? "bg-secondary-container text-on-secondary-container"
          : "bg-surface-container text-on-surface-variant"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${open ? "bg-secondary" : "bg-outline"}`}
        aria-hidden="true"
      />
      {open ? "Đang nhận đơn" : "Ngoài giờ bán"}
    </span>
  );
}
