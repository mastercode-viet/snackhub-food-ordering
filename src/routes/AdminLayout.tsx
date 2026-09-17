import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAdminSession } from "@/hooks/useAdminSession";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import { Skeleton } from "@/components/Skeleton";

/**
 * Vỏ khu vực Admin. Cố ý KHÔNG nằm trong AppLayout: không bottom nav của
 * khách, không giỏ hàng — đây là màn của nhân viên, không phải của người mua.
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
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-content items-center gap-3 px-margin-mobile py-3 md:px-gutter">
          <span className="text-label-lg text-on-surface">SnackHub Admin</span>

          <nav className="ml-2 flex-1">
            <NavLink
              to="/admin/toppings"
              className={({ isActive }) =>
                `inline-flex min-h-[44px] items-center rounded-card px-3 text-label-md transition-colors ${
                  isActive
                    ? "bg-surface-container text-on-surface"
                    : "text-on-surface-variant hover:text-on-surface"
                }`
              }
            >
              Topping
            </NavLink>
          </nav>

          <span className="hidden text-label-sm text-on-surface-variant sm:inline">
            {session?.user.email}
          </span>

          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <LogOut size={16} strokeWidth={2.2} />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content px-margin-mobile py-5 md:px-gutter">
        <Outlet />
      </main>
    </div>
  );
}
