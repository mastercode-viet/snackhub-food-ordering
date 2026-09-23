import { useState } from "react";
import { Clock, LogOut, Pencil, Trash2 } from "lucide-react";
import { inputClass } from "@/components/admin/AdminForm";
import { formatMinutes, formatTime, fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/format";
import { toast } from "@/store/toast";
import { adminForceCheckout, adminUpdateTimeLog, deleteTimeLog, type TimeLog } from "@/lib/staffQueries";

/**
 * 1 dòng chấm công + hành động sửa/xoá/ép check-out cho Admin — dùng chung
 * cho bảng "Đang làm việc" (mọi nhân viên, cần `staffName`) và "Lịch sử chấm
 * công" trong panel chi tiết 1 nhân viên (đã biết là ai, không cần tên).
 */
export default function TimeLogRow({
  log,
  staffName,
  onChanged,
}: {
  log: TimeLog;
  staffName?: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [checkIn, setCheckIn] = useState(() => toDatetimeLocalValue(log.check_in_at));
  const [checkOut, setCheckOut] = useState(() => (log.check_out_at ? toDatetimeLocalValue(log.check_out_at) : ""));
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    try {
      await action();
      toast.success(okMessage);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (checkOut && checkOut <= checkIn) {
      toast.error("Giờ ra phải sau giờ vào.");
      return;
    }
    await run(
      () =>
        adminUpdateTimeLog(log.id, {
          check_in_at: fromDatetimeLocalValue(checkIn),
          check_out_at: checkOut ? fromDatetimeLocalValue(checkOut) : null,
        }),
      "Đã sửa giờ chấm công.",
    );
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-card border border-outline-variant p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-label-xs text-on-surface-variant">Giờ vào</span>
            <input
              type="datetime-local"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label-xs text-on-surface-variant">Giờ ra (để trống = đang mở)</span>
            <input
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="min-h-[40px] flex-1 rounded-card bg-inverse-surface px-3 text-label-md font-semibold text-inverse-on-surface shadow-cta disabled:opacity-50"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="min-h-[40px] rounded-card border border-outline-variant px-3 text-label-md text-on-surface hover:bg-surface-container"
          >
            Huỷ
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-body-sm">
      <span className="flex items-center gap-1.5 text-on-surface-variant">
        {staffName && <strong className="text-on-surface">{staffName}</strong>}
        <Clock size={13} strokeWidth={2.2} />
        {formatTime(log.check_in_at)}
        {log.check_out_at ? ` → ${formatTime(log.check_out_at)}` : " · đang mở"}
      </span>

      <span className="flex items-center gap-1">
        {log.total_minutes_worked !== null && (
          <span className="font-mono font-semibold text-on-surface">{formatMinutes(log.total_minutes_worked)}</span>
        )}

        {!log.check_out_at && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirm("Ép check-out ngay bây giờ?")) return;
              void run(() => adminForceCheckout(log.id), "Đã ép check-out.");
            }}
            aria-label="Ép check-out"
            title="Ép check-out"
            className="inline-flex size-9 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container disabled:opacity-50"
          >
            <LogOut size={15} strokeWidth={2.2} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Sửa giờ"
          title="Sửa giờ"
          className="inline-flex size-9 items-center justify-center rounded-card text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Pencil size={15} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirm("Xoá dòng chấm công này?")) return;
            void run(() => deleteTimeLog(log.id), "Đã xoá dòng chấm công.");
          }}
          aria-label="Xoá"
          title="Xoá"
          className="inline-flex size-9 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container disabled:opacity-50"
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </span>
    </li>
  );
}
