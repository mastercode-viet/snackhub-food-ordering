import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarRange, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { FormField, inputClass } from "@/components/admin/AdminForm";
import { formatTimeOfDay, toIsoDate } from "@/lib/format";
import { toast } from "@/store/toast";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import type { AdminOutletContext } from "@/routes/AdminLayout";
import {
  bulkAssignShift,
  createShift,
  deleteShift,
  deleteShiftAssignment,
  fetchShiftAssignments,
  fetchShifts,
  fetchStaffProfiles,
  updateShift,
  upsertShiftAssignment,
  type Shift,
  type ShiftAssignmentWithShift,
  type StaffProfile,
} from "@/lib/staffQueries";

const WEEKDAYS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];

type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

/** "2026-09-20" -> "Chủ Nhật, 20/09/2026" */
function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const weekday = d.toLocaleDateString("vi-VN", { weekday: "long" });
  const rest = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${rest}`;
}

export default function AdminShiftsPage() {
  const { isAdmin } = useOutletContext<AdminOutletContext>();
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));

  const state = useAsync(
    async () =>
      isAdmin
        ? {
            shifts: await fetchShifts(),
            staff: await fetchStaffProfiles(),
            assignments: await fetchShiftAssignments(selectedDate, selectedDate),
          }
        : { shifts: [], staff: [], assignments: [] },
    [selectedDate, isAdmin],
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-space-lg">
        <EmptyState
          icon="🔒"
          title="Chỉ Superadmin mới xem được trang này"
          description="Tài khoản nhân viên không có quyền quản lý ca làm và lịch làm việc."
        />
      </div>
    );
  }

  const run: RunFn = async (action, okMessage) => {
    try {
      await action();
      toast.success(okMessage);
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    }
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Ca làm</span>
      </nav>

      <header className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <h1 className="text-headline-sm text-on-surface">Ca làm &amp; Lịch làm việc</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Tạo mẫu ca làm rồi gán cho từng nhân viên theo ngày cụ thể. Check-in/check-out của nhân
          viên sẽ tự cảnh báo nếu lệch giờ ca được gán, nhưng không bị chặn.
        </p>
      </header>

      {state.loading ? (
        <Skeleton className="h-96 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <>
          <ShiftListSection shifts={state.data!.shifts} onRun={run} />

          <ScheduleSection
            selectedDate={selectedDate}
            onChangeDate={setSelectedDate}
            shifts={state.data!.shifts}
            staff={state.data!.staff}
            assignments={state.data!.assignments}
            onRun={run}
            onReload={state.reload}
          />
        </>
      )}
    </div>
  );
}

// ── Danh sách ca làm (mẫu) — CRUD ──────────────────────────────────────────

function ShiftListSection({ shifts, onRun }: { shifts: Shift[]; onRun: RunFn }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-label-lg text-on-surface">Danh sách ca làm</h2>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setShowCreate((v) => !v);
          }}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-card bg-inverse-surface px-3 text-label-sm font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99]"
        >
          {showCreate ? <X size={15} strokeWidth={2.4} /> : <Plus size={15} strokeWidth={2.4} />}
          {showCreate ? "Đóng" : "Thêm ca làm"}
        </button>
      </div>

      {showCreate && (
        <ShiftForm
          onCancel={() => setShowCreate(false)}
          onSubmit={async (input) => {
            await onRun(() => createShift(input), `Đã tạo ca "${input.name}".`);
            setShowCreate(false);
          }}
        />
      )}

      {shifts.length === 0 ? (
        <EmptyState
          icon="🕒"
          title="Chưa có ca làm nào"
          description="Bấm “Thêm ca làm” để tạo mẫu ca đầu tiên (vd: Ca sáng 06:00-10:00)."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant">
          {shifts.map((shift) =>
            editingId === shift.id ? (
              <li key={shift.id} className="py-2">
                <ShiftForm
                  initial={shift}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (input) => {
                    await onRun(() => updateShift(shift.id, input), `Đã lưu ca "${input.name}".`);
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li key={shift.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-container text-on-surface-variant">
                  <Clock size={16} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-semibold text-on-surface">{shift.name}</p>
                  <p className="font-mono text-label-sm text-on-surface-variant">
                    {formatTimeOfDay(shift.start_time)} – {formatTimeOfDay(shift.end_time)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setEditingId(shift.id);
                  }}
                  aria-label={`Sửa ca ${shift.name}`}
                  className="inline-flex size-11 items-center justify-center rounded-card text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  <Pencil size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Xoá ca "${shift.name}"?`)) return;
                    void onRun(() => deleteShift(shift.id), "Đã xoá ca làm.");
                  }}
                  aria-label={`Xoá ca ${shift.name}`}
                  className="inline-flex size-11 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container"
                >
                  <Trash2 size={16} strokeWidth={2.2} />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function ShiftForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Shift;
  onSubmit: (input: { name: string; start_time: string; end_time: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startTime, setStartTime] = useState(initial ? formatTimeOfDay(initial.start_time) : "06:00");
  const [endTime, setEndTime] = useState(initial ? formatTimeOfDay(initial.end_time) : "10:00");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Nhập tên ca làm.");
      return;
    }
    if (!startTime || !endTime || startTime >= endTime) {
      toast.error("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), start_time: `${startTime}:00`, end_time: `${endTime}:00` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-outline-variant p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label="Tên ca">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ca sáng"
            className={inputClass}
          />
        </FormField>
        <FormField label="Giờ bắt đầu">
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
        </FormField>
        <FormField label="Giờ kết thúc">
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
        </FormField>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="min-h-[44px] flex-1 rounded-card bg-inverse-surface px-4 text-label-lg font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Tạo ca làm"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-card border border-outline-variant px-4 text-label-md text-on-surface hover:bg-surface-container"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

// ── Lịch gán ca theo ngày cụ thể ────────────────────────────────────────────

function ScheduleSection({
  selectedDate,
  onChangeDate,
  shifts,
  staff,
  assignments,
  onRun,
  onReload,
}: {
  selectedDate: string;
  onChangeDate: (d: string) => void;
  shifts: Shift[];
  staff: StaffProfile[];
  assignments: ShiftAssignmentWithShift[];
  onRun: RunFn;
  onReload: () => void;
}) {
  const activeStaff = useMemo(() => staff.filter((s) => s.is_active), [staff]);
  const assignmentByStaffId = useMemo(
    () => new Map(assignments.map((a) => [a.staff_id, a])),
    [assignments],
  );
  const [showBulk, setShowBulk] = useState(false);

  function shiftDate(deltaDays: number) {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    onChangeDate(toIsoDate(d));
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-label-lg text-on-surface">Lịch làm việc theo ngày</h2>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            aria-label="Ngày trước"
            className="grid size-9 place-items-center rounded-card border border-outline-variant text-on-surface-variant hover:bg-surface-container"
          >
            <ChevronLeft size={16} strokeWidth={2.2} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className="min-h-[40px] rounded-card border border-outline-variant bg-surface-container-lowest px-2.5 text-label-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          />
          <button
            type="button"
            onClick={() => shiftDate(1)}
            aria-label="Ngày sau"
            className="grid size-9 place-items-center rounded-card border border-outline-variant text-on-surface-variant hover:bg-surface-container"
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={() => setShowBulk((v) => !v)}
            className="ml-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            <Users size={15} strokeWidth={2.2} />
            {showBulk ? "Đóng" : "Gán hàng loạt"}
          </button>
        </div>
      </div>

      {showBulk && (
        <BulkAssignPanel
          staff={staff}
          shifts={shifts}
          onCancel={() => setShowBulk(false)}
          onDone={() => {
            setShowBulk(false);
            onReload();
          }}
        />
      )}

      <p className="text-label-sm text-on-surface-variant">{dateLabel(selectedDate)}</p>

      {activeStaff.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Chưa có nhân viên đang hoạt động.</p>
      ) : shifts.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Tạo ít nhất một ca làm ở trên trước khi gán lịch.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant">
          {activeStaff.map((s) => {
            const assignment = assignmentByStaffId.get(s.id);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-semibold text-on-surface">{s.full_name}</p>
                </div>
                <select
                  value={assignment?.shift_id ?? ""}
                  onChange={(e) => {
                    const shiftId = e.target.value;
                    if (!shiftId) {
                      if (!assignment) return;
                      void onRun(
                        () => deleteShiftAssignment(assignment.id),
                        `Đã gỡ ca của ${s.full_name} ngày ${selectedDate}.`,
                      );
                      return;
                    }
                    const shift = shifts.find((sh) => sh.id === shiftId);
                    void onRun(
                      () => upsertShiftAssignment({ staffId: s.id, shiftId, workDate: selectedDate }),
                      `Đã gán "${shift?.name}" cho ${s.full_name} ngày ${selectedDate}.`,
                    );
                  }}
                  className="min-h-[40px] rounded-card border border-outline-variant bg-surface-container-lowest px-2.5 text-label-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
                >
                  <option value="">— Chưa gán ca —</option>
                  {shifts.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.name} ({formatTimeOfDay(sh.start_time)}–{formatTimeOfDay(sh.end_time)})
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Gán 1 ca cho nhiều nhân viên trong 1 khoảng ngày, lọc theo thứ ─────────

function BulkAssignPanel({
  staff,
  shifts,
  onCancel,
  onDone,
}: {
  staff: StaffProfile[];
  shifts: Shift[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const activeStaff = useMemo(() => staff.filter((s) => s.is_active), [staff]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>(() => activeStaff.map((s) => s.id));
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? "");
  const today = toIsoDate(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [weekdays, setWeekdays] = useState<number[]>(WEEKDAYS.map((w) => w.value));
  const [busy, setBusy] = useState(false);

  function toggleStaff(id: string) {
    setSelectedStaffIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleWeekday(v: number) {
    setWeekdays((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  async function submit() {
    if (!shiftId) {
      toast.error("Chọn 1 ca làm.");
      return;
    }
    if (selectedStaffIds.length === 0) {
      toast.error("Chọn ít nhất 1 nhân viên.");
      return;
    }
    if (!fromDate || !toDate || fromDate > toDate) {
      toast.error("Khoảng ngày không hợp lệ.");
      return;
    }
    if (weekdays.length === 0) {
      toast.error("Chọn ít nhất 1 thứ trong tuần.");
      return;
    }
    setBusy(true);
    try {
      const count = await bulkAssignShift({ staffIds: selectedStaffIds, shiftId, fromDate, toDate, weekdays });
      toast.success(count > 0 ? `Đã gán ${count} lượt ca.` : "Không có ngày nào khớp bộ lọc.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không gán được, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-outline-variant p-4">
      <p className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
        <CalendarRange size={15} strokeWidth={2.2} />
        Ghi đè ca đã gán (nếu có) cho các nhân viên và ngày được chọn bên dưới.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Ca làm">
          <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={inputClass}>
            {shifts.map((sh) => (
              <option key={sh.id} value={sh.id}>
                {sh.name} ({formatTimeOfDay(sh.start_time)}–{formatTimeOfDay(sh.end_time)})
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Từ ngày">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Đến ngày">
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
          </FormField>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label-sm text-on-surface-variant">Chỉ áp dụng vào thứ</span>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w) => {
            const on = weekdays.includes(w.value);
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => toggleWeekday(w.value)}
                aria-pressed={on}
                className={`min-h-[36px] rounded-full px-3 text-label-sm font-semibold transition-colors ${
                  on
                    ? "bg-primary-container text-on-primary-container"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label-sm text-on-surface-variant">Nhân viên ({selectedStaffIds.length} đã chọn)</span>
        {activeStaff.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">Chưa có nhân viên đang hoạt động.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {activeStaff.map((s) => {
              const on = selectedStaffIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStaff(s.id)}
                  aria-pressed={on}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-card border px-3 text-left text-body-sm transition-colors ${
                    on
                      ? "border-secondary bg-secondary-container text-on-secondary-container"
                      : "border-outline-variant text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span className="min-w-0 truncate">{s.full_name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || shifts.length === 0}
          onClick={() => void submit()}
          className="min-h-[44px] flex-1 rounded-card bg-inverse-surface px-4 text-label-lg font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Đang gán…" : "Gán hàng loạt"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded-card border border-outline-variant px-4 text-label-md text-on-surface hover:bg-surface-container"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}
