import { useOutletContext } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import type { AdminOutletContext } from "@/routes/AdminLayout";
import CheckInOutWidget from "@/components/admin/CheckInOutWidget";
import AttendanceHistoryTable from "@/components/admin/AttendanceHistoryTable";

/**
 * Tab chấm công. Nhân viên (có staff_profiles) thấy nút check-in (GPS + ảnh);
 * superadmin thấy thêm lịch sử điểm danh của mọi người. Quyền đọc thật do RLS
 * time_logs / Storage quyết định, ở đây chỉ ẩn/hiện.
 */
export default function AdminCheckInPage() {
  const { isAdmin, isStaff, staffId } = useOutletContext<AdminOutletContext>();
  const canCheckIn = isStaff && !!staffId;

  if (!canCheckIn && !isAdmin) {
    return (
      <div className="flex flex-col gap-space-lg">
        <EmptyState
          icon="🔒"
          title="Trang này dành cho tài khoản nhân viên"
          description="Tài khoản của bạn chưa có hồ sơ nhân sự."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Chấm công</span>
      </nav>

      <header className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <h1 className="text-headline-sm text-on-surface">Chấm công</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Check-in khi bắt đầu ca (cần bật định vị và chụp ảnh selfie), Check-out khi kết thúc — hệ thống tự tính giờ công.
        </p>
      </header>

      {canCheckIn && <CheckInOutWidget staffId={staffId} />}
      {isAdmin && <AttendanceHistoryTable />}
    </div>
  );
}
