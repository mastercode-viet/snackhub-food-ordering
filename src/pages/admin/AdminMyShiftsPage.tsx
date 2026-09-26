import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowLeftRight, CalendarClock, ChevronRight, Clock, History, Inbox, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatTime, formatTimeOfDay, toIsoDate } from "@/lib/format";
import { toast } from "@/store/toast";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import type { AdminOutletContext } from "@/routes/AdminLayout";
import {
  cancelShiftSwapRequest,
  createShiftSwapRequest,
  fetchMyShiftSwapRequests,
  fetchShiftAssignmentsForStaff,
  fetchStaffDirectory,
  fetchStaffMonthlyHours,
  type ShiftAssignmentWithShift,
  type ShiftSwapRequest,
  type StaffDirectoryEntry,
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
 * xem ca được gán + giờ công của CHÍNH MÌNH, và tự gửi yêu cầu đổi ca / xin
 * nghỉ cho các ca sắp tới — superadmin duyệt ở trang Ca làm.
 */
export default function AdminMyShiftsPage() {
  const { isStaff, staffId } = useOutletContext<AdminOutletContext>();
  const [monthInput, setMonthInput] = useState(currentMonthInputValue());
  const month = useMemo(() => parseMonthInput(monthInput), [monthInput]);

  const state = useAsync(
    async () => {
      if (!staffId) {
        return {
          assignments: [] as ShiftAssignmentWithShift[],
          hours: null,
          requests: [] as ShiftSwapRequest[],
          directory: [] as StaffDirectoryEntry[],
        };
      }
      const today = new Date();
      const [assignments, hoursRows, requests, directory] = await Promise.all([
        fetchShiftAssignmentsForStaff(staffId, toIsoDate(addDays(today, -14)), toIsoDate(addDays(today, 30))),
        fetchStaffMonthlyHours(month),
        fetchMyShiftSwapRequests(staffId),
        fetchStaffDirectory(),
      ]);
      return {
        assignments,
        hours: hoursRows.find((h) => h.staff_id === staffId) ?? null,
        requests,
        directory,
      };
    },
    [staffId, month.getTime()],
  );

  const pendingByAssignmentId = useMemo(() => {
    const map = new Map<string, ShiftSwapRequest>();
    for (const r of state.data?.requests ?? []) {
      if (r.status === "pending" && r.requester_assignment_id) map.set(r.requester_assignment_id, r);
    }
    return map;
  }, [state.data]);

  const nameById = useMemo(
    () => new Map((state.data?.directory ?? []).map((d) => [d.id, d.full_name])),
    [state.data],
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
  const colleagues = (state.data?.directory ?? []).filter((d) => d.id !== staffId);

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
          Ca làm được superadmin gán cho bạn và tổng giờ công theo tháng. Bận đột xuất? Gửi yêu cầu
          xin nghỉ hoặc đổi ca với đồng nghiệp ngay ở ca sắp tới.
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
                  <UpcomingShiftRow
                    key={a.id}
                    assignment={a}
                    pendingRequest={pendingByAssignmentId.get(a.id)}
                    colleagues={colleagues}
                    onChanged={state.reload}
                  />
                ))}
              </ul>
            )}
          </section>

          <MyRequestsSection
            requests={state.data?.requests ?? []}
            staffId={staffId}
            nameById={nameById}
            onChanged={state.reload}
          />

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
                  <li key={a.id}>
                    <ShiftAssignmentLine assignment={a} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function ShiftAssignmentLine({ assignment }: { assignment: ShiftAssignmentWithShift }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
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
    </div>
  );
}

// ── 1 ca sắp tới + form gửi yêu cầu xin nghỉ / đổi ca ngay tại dòng ─────────

function UpcomingShiftRow({
  assignment,
  pendingRequest,
  colleagues,
  onChanged,
}: {
  assignment: ShiftAssignmentWithShift;
  pendingRequest: ShiftSwapRequest | undefined;
  colleagues: StaffDirectoryEntry[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"leave" | "swap" | null>(null);
  const [reason, setReason] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);

  function open(next: "leave" | "swap") {
    setMode((cur) => (cur === next ? null : next));
    setReason("");
    setTargetId("");
  }

  async function submit() {
    if (mode === "swap" && !targetId) {
      toast.error("Chọn đồng nghiệp muốn đổi ca.");
      return;
    }
    if (mode === "leave" && !reason.trim()) {
      toast.error("Ghi lý do xin nghỉ để superadmin sắp xếp người thay.");
      return;
    }
    setBusy(true);
    try {
      await createShiftSwapRequest({
        assignmentId: assignment.id,
        type: mode!,
        targetStaffId: mode === "swap" ? targetId : undefined,
        reason: reason.trim() || undefined,
      });
      toast.success(mode === "leave" ? "Đã gửi yêu cầu xin nghỉ." : "Đã gửi yêu cầu đổi ca.");
      setMode(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không gửi được yêu cầu, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 pb-2">
      <ShiftAssignmentLine assignment={assignment} />

      {pendingRequest ? (
        <p className="ml-12 text-label-sm text-on-surface-variant">
          Đã gửi yêu cầu {pendingRequest.request_type === "leave" ? "xin nghỉ" : "đổi ca"} — đang chờ superadmin
          duyệt.
        </p>
      ) : (
        <div className="ml-12 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => open("leave")}
            aria-pressed={mode === "leave"}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-card border px-3 text-label-sm font-semibold transition-colors ${
              mode === "leave"
                ? "border-error bg-error-container text-on-error-container"
                : "border-outline-variant text-error hover:bg-error-container"
            }`}
          >
            <X size={14} strokeWidth={2.4} />
            Xin nghỉ ca này
          </button>
          <button
            type="button"
            onClick={() => open("swap")}
            disabled={colleagues.length === 0}
            aria-pressed={mode === "swap"}
            title={colleagues.length === 0 ? "Chưa có đồng nghiệp nào để đổi ca" : undefined}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-card border px-3 text-label-sm font-semibold transition-colors disabled:opacity-50 ${
              mode === "swap"
                ? "border-on-surface bg-surface-container text-on-surface"
                : "border-outline-variant text-on-surface hover:bg-surface-container"
            }`}
          >
            <ArrowLeftRight size={14} strokeWidth={2.4} />
            Yêu cầu đổi ca
          </button>
        </div>
      )}

      {mode && !pendingRequest && (
        <div className="ml-12 flex flex-col gap-2 rounded-card border border-outline-variant p-3">
          {mode === "swap" && (
            <label className="flex flex-col gap-1">
              <span className="text-label-xs text-on-surface-variant">Đổi ca với</span>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="min-h-[40px] rounded-card border border-outline-variant bg-surface-container-lowest px-2.5 text-label-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
              >
                <option value="">— Chọn đồng nghiệp —</option>
                {colleagues.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
              <span className="text-label-xs text-on-surface-variant">
                Superadmin sẽ chọn ca cụ thể của người đó để đổi khi duyệt.
              </span>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-label-xs text-on-surface-variant">
              Lý do {mode === "leave" ? "(bắt buộc)" : "(không bắt buộc)"}
            </span>
            <textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === "leave" ? "Vd: Trùng lịch thi, ốm…" : "Vd: Đã thống nhất với bạn ấy từ trước"}
              className="rounded-card border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-sm text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="min-h-[40px] flex-1 rounded-card bg-inverse-surface px-3 text-label-md font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? "Đang gửi…" : "Gửi yêu cầu"}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="min-h-[40px] rounded-card border border-outline-variant px-3 text-label-md text-on-surface hover:bg-surface-container"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── Yêu cầu đã gửi + yêu cầu người khác gửi tới mình ──────────────────────

const STATUS_LABEL: Record<ShiftSwapRequest["status"], string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
  cancelled: "Đã huỷ",
};

const STATUS_CLASS: Record<ShiftSwapRequest["status"], string> = {
  pending: "bg-surface-container text-on-surface-variant",
  approved: "bg-secondary-container text-on-secondary-container",
  rejected: "bg-error-container text-on-error-container",
  cancelled: "bg-surface-container text-on-surface-variant",
};

function MyRequestsSection({
  requests,
  staffId,
  nameById,
  onChanged,
}: {
  requests: ShiftSwapRequest[];
  staffId: string;
  nameById: Map<string, string>;
  onChanged: () => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function cancel(id: string) {
    if (!confirm("Huỷ yêu cầu này?")) return;
    setCancellingId(id);
    try {
      await cancelShiftSwapRequest(id);
      toast.success("Đã huỷ yêu cầu.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không huỷ được, thử lại nhé.");
    } finally {
      setCancellingId(null);
    }
  }

  if (requests.length === 0) return null;

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="flex items-center gap-1.5 text-label-lg text-on-surface">
        <Inbox size={17} strokeWidth={2.2} />
        Yêu cầu đổi ca / xin nghỉ
      </h2>

      <ul className="flex flex-col divide-y divide-outline-variant">
        {requests.map((r) => {
          const mine = r.requester_staff_id === staffId;
          const other = mine ? r.target_staff_id : r.requester_staff_id;
          const otherName = other ? (nameById.get(other) ?? "đồng nghiệp") : null;

          return (
            <li key={r.id} className="flex flex-col gap-1 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-body-sm font-semibold text-on-surface">
                  {r.request_type === "leave"
                    ? "Xin nghỉ"
                    : mine
                      ? `Đổi ca với ${otherName}`
                      : `${otherName} muốn đổi ca với bạn`}
                  <span className="font-normal text-on-surface-variant">
                    {" "}
                    · {dayLabel(r.work_date)} · {r.shift_name} ({formatTimeOfDay(r.shift_start)}–
                    {formatTimeOfDay(r.shift_end)})
                  </span>
                </p>
                <span className={`rounded-full px-2 py-0.5 text-label-xs font-semibold ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              {r.status === "approved" && r.request_type === "swap" && r.target_work_date && (
                <p className="text-label-sm text-on-surface-variant">
                  Đổi lấy: {dayLabel(r.target_work_date)} · {r.target_shift_name}
                </p>
              )}
              {r.reason && <p className="text-label-sm italic text-on-surface-variant">“{r.reason}”</p>}
              {r.resolution_note && (
                <p className="text-label-sm text-on-surface-variant">Ghi chú duyệt: {r.resolution_note}</p>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-label-xs text-on-surface-variant">Gửi lúc {formatTime(r.created_at)}</span>
                {mine && r.status === "pending" && (
                  <button
                    type="button"
                    disabled={cancellingId === r.id}
                    onClick={() => void cancel(r.id)}
                    className="min-h-[32px] rounded-card border border-outline-variant px-2.5 text-label-xs font-semibold text-error transition-colors hover:bg-error-container disabled:opacity-50"
                  >
                    Huỷ yêu cầu
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
