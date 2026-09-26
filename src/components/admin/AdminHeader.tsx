import { LogOut, Menu } from "lucide-react";
import { useStoreOpen } from "@/hooks/useMenu";
import { useAdminSidebar } from "@/hooks/useAdminSidebar";

export default function AdminHeader({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const storeOpen = useStoreOpen();
  const { toggle } = useAdminSidebar();

  return (
    <header className="border-b border-outline-variant bg-surface-container-lowest">
      <div className="flex items-center gap-3 px-margin-mobile py-3 md:px-gutter">
        <button
          type="button"
          onClick={toggle}
          aria-label="Mở menu quản lý"
          className="grid size-11 shrink-0 place-items-center rounded-card text-on-surface transition-colors hover:bg-surface-container lg:hidden"
        >
          <Menu size={20} strokeWidth={2.2} />
        </button>

        <span className="text-label-lg text-on-surface lg:hidden">Sagori Admin</span>

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
