import { AnimatePresence, motion } from "motion/react";
import { NavLink } from "react-router-dom";
import { ShoppingBag, Store, X } from "lucide-react";
import { useStoreSettings } from "@/hooks/useMenu";
import { useAdminSidebar } from "@/hooks/useAdminSidebar";

/**
 * Desktop (>= lg): cố định, luôn hiện, nằm trong luồng flex của AdminLayout.
 * Mobile (< lg): Drawer trượt từ trái + overlay mờ phía sau, đóng khi bấm ra
 * ngoài overlay hoặc bấm 1 mục điều hướng. Không dùng border — tách khỏi nền
 * bằng shadow-sheet (CLAUDE.md mục 3: card/sheet tách nền bằng bóng, không viền).
 */
export default function AdminSidebar({
  isAdmin,
  isStaff,
  pendingOrderCount,
}: {
  isAdmin: boolean;
  isStaff: boolean;
  pendingOrderCount: number;
}) {
  const { isOpen, close } = useAdminSidebar();

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col bg-surface-container-lowest shadow-sheet lg:flex">
        <SidebarContent isAdmin={isAdmin} isStaff={isStaff} pendingOrderCount={pendingOrderCount} />
      </aside>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              aria-hidden="true"
              className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-label="Menu quản lý"
              className="absolute inset-y-0 left-0 z-[71] flex w-72 max-w-[80vw] flex-col bg-surface-container-lowest shadow-sheet"
            >
              <div className="flex items-center justify-end px-3 pt-3">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Đóng menu"
                  className="grid size-11 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  <X size={18} strokeWidth={2.2} />
                </button>
              </div>
              <SidebarContent isAdmin={isAdmin} isStaff={isStaff} pendingOrderCount={pendingOrderCount} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Nội dung sidebar dùng chung cho cả bản cố định (desktop) và Drawer (mobile) — tránh chép lại danh sách mục điều hướng 2 lần. */
function SidebarContent({
  isAdmin,
  isStaff,
  pendingOrderCount,
}: {
  isAdmin: boolean;
  isStaff: boolean;
  pendingOrderCount: number;
}) {
  const settings = useStoreSettings();

  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-card bg-inverse-surface text-inverse-on-surface">
          <ShoppingBag size={18} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-label-lg text-on-surface">Sagori Admin</p>
          <p className="truncate text-label-xs text-on-surface-variant">Giao tận lớp</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        <p className="px-2 pb-1 pt-3 text-label-xs uppercase tracking-wide text-on-surface-variant">
          Quản lý
        </p>
        <SidebarLink to="/admin/don-hang" label="Đơn hàng" badge={pendingOrderCount} />
        <SidebarLink to="/admin/thuc-don" label="Thực đơn" />
        <SidebarLink to="/admin/combos" label="Combo" />
        <SidebarLink to="/admin/khuyen-mai" label="Khuyến mãi" />
        <SidebarLink to="/admin/thong-ke" label="Thống kê" />
        <SidebarLink to="/admin/toppings" label="Nhóm topping" />
        <SidebarLink to="/admin/banner" label="Banner" />
        {isAdmin && <SidebarLink to="/admin/nhan-su" label="Nhân sự" />}
        {isAdmin && <SidebarLink to="/admin/ca-lam" label="Ca làm" />}
        {(isStaff || isAdmin) && <SidebarLink to="/admin/cham-cong" label="Chấm công" />}
        {isStaff && <SidebarLink to="/admin/lich-cua-toi" label="Lịch của tôi" />}
        <SidebarLink to="/admin/cai-dat" label="Cài đặt quán" />
      </nav>

      <div className="mt-auto p-3">
        <div className="rounded-card bg-surface-container-low p-3">
          <p className="flex items-center gap-1.5 text-label-sm text-on-surface">
            <Store size={14} strokeWidth={2.2} />
            {settings.data?.store_name ?? "Sagori"}
          </p>
          {settings.data && (
            <p className="mt-0.5 text-label-xs text-on-surface-variant">
              Nhận đơn {settings.data.open_time.slice(0, 5)}–{settings.data.close_time.slice(0, 5)}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function SidebarLink({ to, label, badge }: { to: string; label: string; badge?: number }) {
  const { close } = useAdminSidebar();

  return (
    <NavLink
      to={to}
      onClick={close}
      className={({ isActive }) =>
        `flex min-h-[44px] items-center justify-between gap-2 rounded-card px-3 text-label-md transition-colors ${isActive
          ? "bg-primary-container text-on-primary-container"
          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        }`
      }
    >
      <span>{label}</span>
      {!!badge && badge > 0 && (
        <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 py-0.5 text-label-xs font-bold leading-none text-on-error">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}
