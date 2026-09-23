import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarClock, ChevronRight, Clock, History } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatTimeOfDay, toIsoDate } from "@/lib/format";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import type { AdminOutletContext } from "@/routes/AdminLayout";
import {
  fetchShiftAssignmentsForStaff,
  fetchStaffMonthlyHours,
  type ShiftAssignmentWithShift,
} from "@/lib/staffQueries";

function currentMonthInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" (giá trị input type=month) -> Date ngày 1 tháng đó. */
function parseMonthInput(value: string): Date {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

function monthLabel(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** "2026-09-20" -> "Chủ Nhật, 20/09" */
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = d.toLocaleDateString("vi-VN", { weekday: "long" });
  const rest = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${rest}`;
}

/**
 * Trang cá nhân cho MỌI tài khoản có hồ sơ staff_profiles (kể cả superadmin)
 * xem ca được gán + giờ công của CHÍNH MÌNH — không có ở đâu khác trước đây,
 * nhân viên (role "staff") chỉ có nút Check-in/Check-out mà không biết lịch
 * làm của mình.
 */
export default function AdminMyShiftsPage() {
  const { isStaff, staffId } = useOutletContext<AdminOutletContext>();
  const [monthInput, setMonthInput] = useState(currentMonthInputValue());
  const month = useMemo(() => parseMonthInput(monthInput), [monthInput]);

  const state = useAsync(
    async () => {
      if (!staffId) return { assignments: [] as ShiftAssignmentWithShift[], hours: null };
      const today = new Date();
      const [assignments, hoursRows] = await Promise.all([
        fetchShiftAssignmentsForStaff(staffId, toIsoDate(addDays(today, -14)), toIsoDate(addDays(today, 30))),
        fetchStaffMonthlyHours(month),
      ]);
      return { assignments, hours: hoursRows.find((h) => h.staff_id === staffId) ?? null };
    },
    [staffId, month.getTime()],
  );

  if (!isStaff || !staffId) {
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

  const today = toIsoDate(new Date());
  const upcoming = (state.data?.assignments ?? []).filter((a) => a.work_date >= today);
  const past = [...(state.data?.assignments ?? [])].filter((a) => a.work_date < today).reverse();

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Lịch của tôi</span>
      </nav>

      <header className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <h1 className="text-headline-sm text-on-surface">Lịch của tôi</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Ca làm được superadmin gán cho bạn và tổng giờ công theo tháng.
        </p>
      </header>

      {state.loading ? (
        <Skeleton className="h-96 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <>
          <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-label-lg text-on-surface">Giờ công tháng {monthLabel(month)}</h2>
              <label className="flex flex-col gap-1">
                <span className="text-label-xs text-on-surface-variant">Xem tháng</span>
                <input
                  type="month"
                  value={monthInput}
                  onChange={(e) => setMonthInput(e.target.value)}
                  className="min-h-[40px] rounded-card border border-outline-variant bg-surface-container-lowest px-2.5 text-label-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
                />
              </label>
            </div>

            {state.data?.hours ? (
              <div className="flex gap-6">
                <div>
                  <p className="text-label-xs text-on-surface-variant">Số ca đã làm</p>
                  <p className="text-headline-sm font-bold text-on-surface">{state.data.hours.shift_count}</p>
                </div>
                <div>
                  <p className="text-label-xs text-on-surface-variant">Tổng giờ công</p>
                  <p className="text-headline-sm font-bold text-on-surface">{state.data.hours.total_hours}h</p>
                </div>
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">Chưa có ca nào đã chấm công trong tháng này.</p>
            )}
          </section>

          <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
            <h2 className="flex items-center gap-1.5 text-label-lg text-on-surface">
              <CalendarClock size={17} strokeWidth={2.2} />
              Ca sắp tới
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Chưa được gán ca nào sắp tới.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {upcoming.map((a) => (
                  <ShiftAssignmentRow key={a.id} assignment={a} />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
            <h2 className="flex items-center gap-1.5 text-label-lg text-on-surface">
              <History size={17} strokeWidth={2.2} />
              Ca gần đây
            </h2>
            {past.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Chưa có lịch sử ca trong 14 ngày qua.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {past.map((a) => (
                  <ShiftAssignmentRow key={a.id} assignment={a} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ShiftAssignmentRow({ assignment }: { assignment: ShiftAssignmentWithShift }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-container text-on-surface-variant">
        <Clock size={16} strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-md font-semibold text-on-surface">{dayLabel(assignment.work_date)}</p>
        <p className="text-label-sm text-on-surface-variant">{assignment.shift.name}</p>
      </div>
      <span className="font-mono text-label-sm text-on-surface-variant">
        {formatTimeOfDay(assignment.shift.start_time)}–{formatTimeOfDay(assignment.shift.end_time)}
      </span>
    </li>
  );
}
