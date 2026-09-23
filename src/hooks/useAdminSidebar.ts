import { createContext, useContext } from "react";

/** Tách riêng khỏi AdminLayout.tsx để AdminSidebar/AdminHeader import được mà không tạo vòng lặp import lẫn nhau. */
export type AdminSidebarState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const AdminSidebarContext = createContext<AdminSidebarState | null>(null);

/** Trạng thái đóng/mở Sidebar dạng Drawer trên mobile (< lg) — dùng chung giữa AdminSidebar và AdminHeader thay vì truyền prop qua nhiều lớp. */
export function useAdminSidebar(): AdminSidebarState {
  const ctx = useContext(AdminSidebarContext);
  if (!ctx) throw new Error("useAdminSidebar phải gọi bên trong <AdminLayout>.");
  return ctx;
}
