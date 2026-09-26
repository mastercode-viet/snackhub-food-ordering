import { useState } from "react";
import { formatTimeOfDay, toIsoDate } from "@/lib/format";
import {
  deleteShiftAssignment,
  upsertShiftAssignment,
  type Shift,
  type ShiftAssignmentWithShift,
  type StaffProfile,
} from "@/lib/staffQueries";

type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** "2026-09-21" -> "T2 21/09" */
function dayHeaderLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const rest = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  return `${DOW_LABELS[d.getDay()]} ${rest}`;
}

/**
 * Lưới xếp ca: hàng = nhân viên đang hoạt động, cột = 7 ngày trong tuần
 * (weekStart..weekStart+6). Thay cho danh sách "1 ngày, mỗi nhân viên 1
 * dropdown" cũ — cùng thao tác upsert/xoá, chỉ đổi cách nhìn tổng quan cả
 * tuần. `assignmentByKey` khoá bằng `${staffId}|${workDate}` (không dùng
 * "-" vì UUID có chứa "-", tách chuỗi sẽ nhập nhằng).
 */
export default function ShiftScheduleGrid({
  weekStart,
  staff,
  shifts,
  assignmentByKey,
  onRun,
}: {
  weekStart: string;
  staff: StaffProfile[];
  shifts: Shift[];
  assignmentByKey: Map<string, ShiftAssignmentWithShift>;
  onRun: RunFn;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const activeStaff = staff.filter((s) => s.is_active);

  if (activeStaff.length === 0) {
    return <p className="text-body-sm text-on-surface-variant">Chưa có nhân viên đang hoạt động.</p>;
  }
  if (shifts.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Tạo ít nhất một ca làm ở trên trước khi gán lịch.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-body-sm">
        <thead>
          <tr className="border-b border-outline-variant text-left text-label-xs uppercase tracking-wide text-on-surface-variant">
            <th className="w-36 py-2 pr-3 font-normal">Nhân viên</th>
            {days.map((d) => (
              <th key={d} className="px-1.5 py-2 text-center font-normal normal-case">
                {dayHeaderLabel(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {activeStaff.map((s) => (
            <tr key={s.id}>
              <td className="max-w-[9rem] truncate py-2 pr-3 font-semibold text-on-surface">
                {s.full_name}
              </td>
              {days.map((d) => (
                <td key={d} className="px-1 py-1.5">
                  <ShiftCell
                    staffId={s.id}
                    staffName={s.full_name}
                    workDate={d}
                    shifts={shifts}
                    assignment={assignmentByKey.get(`${s.id}|${d}`)}
                    onRun={onRun}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShiftCell({
  staffId,
  staffName,
  workDate,
  shifts,
  assignment,
  onRun,
}: {
  staffId: string;
  staffName: string;
  workDate: string;
  shifts: Shift[];
  assignment: ShiftAssignmentWithShift | undefined;
  onRun: RunFn;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={assignment?.shift_id ?? ""}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const shiftId = e.target.value;
          if (!shiftId) {
            if (assignment) {
              void onRun(
                () => deleteShiftAssignment(assignment.id),
                `Đã gỡ ca của ${staffName} ngày ${workDate}.`,
              );
            }
          } else {
            const shift = shifts.find((sh) => sh.id === shiftId);
            void onRun(
              () => upsertShiftAssignment({ staffId, shiftId, workDate }),
              `Đã gán "${shift?.name}" cho ${staffName} ngày ${workDate}.`,
            );
          }
          setEditing(false);
        }}
        className="min-h-[36px] w-full rounded-card-sm border border-outline-variant bg-surface-container-lowest px-1 text-label-xs text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
      >
        <option value="">— Trống —</option>
        {shifts.map((sh) => (
          <option key={sh.id} value={sh.id}>
            {sh.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={
        assignment
          ? `${assignment.shift.name} (${formatTimeOfDay(assignment.shift.start_time)}–${formatTimeOfDay(assignment.shift.end_time)})`
          : "Chưa gán ca — bấm để gán"
      }
      className={`min-h-[36px] w-full truncate rounded-card-sm px-1.5 py-1 text-label-xs font-semibold transition-colors ${
        assignment
          ? "bg-surface-container text-on-surface hover:bg-surface-container-high"
          : "border border-dashed border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
      }`}
    >
      {assignment ? assignment.shift.name : "—"}
    </button>
  );
}
