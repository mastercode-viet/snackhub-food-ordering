import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { formatTimeOfDay, toIsoDate } from "@/lib/format";
import {
  fetchOpenTimeLog,
  fetchShiftAssignmentForStaffOnDate,
  type ShiftAssignmentWithShift,
} from "@/lib/staffQueries";

/** Báo trước bao nhiêu phút so với giờ vào ca. */
const LEAD_MINUTES = 60;

/** "HH:MM[:SS]" + ngày "YYYY-MM-DD" -> Date giờ máy. */
function at(workDate: string, time: string): Date {
  return new Date(`${workDate}T${time.slice(0, 5)}:00`);
}

function dismissKey(id: string): string {
  return `snackhub.shiftPrompt.${id}`;
}

/**
 * Popup nhắc nhân viên khi ca được superadmin gán SẮP tới (trong LEAD_MINUTES
 * trước giờ vào ca) hoặc đã bắt đầu mà chưa check-in. Mỗi ca chỉ hiện 1 lần
 * mỗi phiên trình duyệt; bấm "Check-in" đưa thẳng tới trang chấm công.
 */
export default function UpcomingShiftPrompt({ staffId }: { staffId: string }) {
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<ShiftAssignmentWithShift | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const now = new Date();
        const [a, open] = await Promise.all([
          fetchShiftAssignmentForStaffOnDate(staffId, toIsoDate(now)),
          fetchOpenTimeLog(staffId),
        ]);
        if (cancelled || !a || open) return;

        const start = at(a.work_date, a.shift.start_time);
        let end = at(a.work_date, a.shift.end_time);
        if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000); // ca qua nửa đêm
        const soon = now.getTime() >= start.getTime() - LEAD_MINUTES * 60_000 && now < end;
        if (!soon) return;

        try {
          if (sessionStorage.getItem(dismissKey(a.id))) return;
        } catch {
          /* sessionStorage bị chặn: cứ hiện popup */
        }
        setAssignment(a);
      } catch {
        /* Popup chỉ là nhắc nhở — lỗi mạng thì im lặng, không chặn người dùng. */
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  if (!assignment) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(dismissKey(assignment!.id), "1");
    } catch {
      /* ignore */
    }
    setAssignment(null);
  }

  function goCheckIn() {
    dismiss();
    navigate("/admin/cham-cong");
  }

  const { shift } = assignment;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4">
      <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-prompt-title"
        className="relative flex w-full max-w-sm flex-col gap-3 rounded-sheet bg-surface-container-lowest p-6 shadow-sheet"
      >
        <span className="grid size-12 place-items-center rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
          <CalendarClock size={22} strokeWidth={2.2} />
        </span>
        <h2 id="shift-prompt-title" className="text-headline-sm text-on-surface">
          Sắp đến ca làm của bạn
        </h2>
        <p className="text-body-md text-on-surface-variant">
          Hôm nay bạn có <span className="font-semibold text-on-surface">{shift.name}</span> (
          {formatTimeOfDay(shift.start_time)}–{formatTimeOfDay(shift.end_time)}). Hãy vào check-in khi
          bắt đầu làm nhé.
        </p>
        <div className="mt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={goCheckIn}
            className="min-h-[48px] rounded-card bg-inverse-surface px-4 text-label-lg text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99]"
          >
            Check-in
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-[44px] rounded-card px-4 text-label-md text-on-surface-variant hover:bg-surface-container"
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
}
