import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  ChevronRight,
  Copy,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAsync, type AsyncState } from "@/hooks/useAsync";
import { formatMinutes, formatVnd } from "@/lib/format";
import { toast } from "@/store/toast";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { FormField, inputClass, LabeledSwitch, MoneyInput } from "@/components/admin/AdminForm";
import TimeLogRow from "@/components/admin/TimeLogRow";
import type { AdminOutletContext } from "@/routes/AdminLayout";
import {
  confirmStaffPayroll,
  createStaffAccount,
  fetchAllOpenTimeLogs,
  fetchPayrollForMonth,
  fetchPayrollForStaff,
  fetchStaffAttendanceStats,
  fetchStaffMonthlyHours,
  fetchStaffProfiles,
  fetchTimeLogsForStaff,
  setStaffActive,
  updateStaffProfile,
  type OpenTimeLog,
  type PayrollRecord,
  type StaffAttendanceStats,
  type StaffMonthlyHours,
  type StaffProfile,
} from "@/lib/staffQueries";

const ROLE_LABEL: Record<StaffProfile["role"], string> = {
  superadmin: "Superadmin",
  staff: "Nhân viên",
};

/** Mật khẩu tạm ngẫu nhiên, bỏ ký tự dễ nhầm (0/O, 1/l/I) — admin đọc cho nhân viên qua điện thoại. */
function randomPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}

/** "2026-09-01" (Date bất kỳ trong tháng) -> "09/2026", dùng cho tiêu đề + nút xác nhận lương. */
function monthLabel(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function currentMonthInputValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" (giá trị input type=month) -> Date ngày 1 tháng đó. */
function parseMonthInput(value: string): Date {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

export default function AdminStaffPage() {
  const { isAdmin } = useOutletContext<AdminOutletContext>();
  const [monthInput, setMonthInput] = useState(currentMonthInputValue());
  const month = useMemo(() => parseMonthInput(monthInput), [monthInput]);

  // isAdmin quyết định sớm để khỏi bắn 3 query is_admin()-gated (RLS chặn,
  // nhưng không cần tốn round-trip) cho tài khoản staff lỡ gõ thẳng URL.
  const state = useAsync(
    async () =>
      isAdmin
        ? {
            staff: await fetchStaffProfiles(),
            hours: await fetchStaffMonthlyHours(month),
            payroll: await fetchPayrollForMonth(month),
            attendance: await fetchStaffAttendanceStats(month),
          }
        : { staff: [], hours: [], payroll: [], attendance: [] },
    [month.getTime(), isAdmin],
  );

  const openShifts = useAsync(async () => (isAdmin ? fetchAllOpenTimeLogs() : []), [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-space-lg">
        <EmptyState
          icon="🔒"
          title="Chỉ Superadmin mới xem được trang này"
          description="Tài khoản nhân viên không có quyền quản lý hồ sơ nhân sự và lương."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Nhân sự</span>
      </nav>

      <header className="flex flex-wrap items-center justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div>
          <h1 className="text-headline-sm text-on-surface">Nhân sự &amp; Chấm công</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Hồ sơ nhân viên, tổng hợp giờ công và xác nhận thanh toán lương theo tháng.
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-label-sm text-on-surface-variant">Tháng xem</span>
          <input
            type="month"
            value={monthInput}
            onChange={(e) => setMonthInput(e.target.value)}
            className="min-h-[44px] rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          />
        </label>
      </header>

      {state.loading ? (
        <Skeleton className="h-96 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <>
          <OpenShiftsSection state={openShifts} />

          <StaffSection staff={state.data!.staff} onReload={state.reload} />

          <MonthlyHoursTable
            staff={state.data!.staff}
            hours={state.data!.hours}
            payroll={state.data!.payroll}
            attendance={state.data!.attendance}
            month={month}
            onConfirmed={state.reload}
          />
        </>
      )}
    </div>
  );
}

// ── "Đang làm việc" — mọi ca chưa check-out, sửa/ép check-out ngay tại đây ─

function OpenShiftsSection({ state }: { state: AsyncState<OpenTimeLog[]> }) {
  const logs = state.data ?? [];
  if (!state.loading && !state.error && logs.length === 0) return null;

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-label-lg text-on-surface">
        Đang làm việc
        {logs.length > 0 && (
          <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-label-xs text-on-secondary-container">
            {logs.length}
          </span>
        )}
      </h2>

      {state.loading ? (
        <Skeleton className="h-12 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant">
          {logs.map((log) => (
            <TimeLogRow key={log.id} log={log} staffName={log.staff.full_name} onChanged={state.reload} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Danh sách nhân viên + panel chi tiết ──────────────────────────────────

function StaffSection({ staff, onReload }: { staff: StaffProfile[]; onReload: () => void }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = staff.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
      <section className="flex min-w-0 flex-1 flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-label-lg text-on-surface">Danh sách nhân viên</h2>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setShowCreateForm((v) => !v);
            }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-card bg-inverse-surface px-3 text-label-sm font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99]"
          >
            {showCreateForm ? <X size={15} strokeWidth={2.4} /> : <Plus size={15} strokeWidth={2.4} />}
            {showCreateForm ? "Đóng" : "Thêm nhân viên"}
          </button>
        </div>

        {staff.length === 0 ? (
          <EmptyState
            icon="🧑‍🍳"
            title="Chưa có hồ sơ nhân viên nào"
            description="Bấm “Thêm nhân viên” để tạo tài khoản đầu tiên."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant">
            {staff.map((row) => (
              <li key={row.id} className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setSelectedId(row.id);
                  }}
                  aria-current={row.id === selectedId}
                  className={`flex w-full min-h-[48px] flex-wrap items-center gap-x-3 gap-y-1 rounded-card px-3 py-3 text-left transition-colors ${
                    row.id === selectedId
                      ? "bg-surface-container ring-2 ring-primary/40"
                      : "hover:bg-surface-container-low"
                  } ${row.is_active ? "" : "opacity-60"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md font-semibold text-on-surface">{row.full_name}</p>
                    <span className="flex items-center gap-1 truncate text-label-xs text-on-surface-variant">
                      <Mail size={11} strokeWidth={2.2} className="shrink-0" />
                      <span className="truncate">{row.email}</span>
                    </span>
                  </div>

                  {!row.is_active && <Lock size={15} strokeWidth={2.2} className="shrink-0 text-on-surface-variant" />}

                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-label-xs ${
                      row.role === "superadmin"
                        ? "bg-primary-fixed text-on-surface"
                        : "bg-secondary-fixed text-on-surface"
                    }`}
                  >
                    {row.role === "superadmin" && <ShieldCheck size={11} strokeWidth={2.4} />}
                    {ROLE_LABEL[row.role]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="w-full shrink-0 xl:w-[420px]">
        {showCreateForm ? (
          <div className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
            <CreateStaffForm
              onClose={() => setShowCreateForm(false)}
              onCreated={() => {
                setShowCreateForm(false);
                onReload();
              }}
            />
          </div>
        ) : selected ? (
          <StaffDetailPanel
            key={selected.id}
            staff={selected}
            onClose={() => setSelectedId(null)}
            onReload={onReload}
          />
        ) : (
          <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
            Chọn một nhân viên để xem hồ sơ, lịch sử chấm công và lương, hoặc bấm “Thêm nhân viên”.
          </div>
        )}
      </aside>
    </div>
  );
}

// ── Panel chi tiết: hồ sơ sửa được + lịch sử chấm công + lịch sử lương ────

function StaffDetailPanel({
  staff,
  onClose,
  onReload,
}: {
  staff: StaffProfile;
  onClose: () => void;
  onReload: () => void;
}) {
  const history = useAsync(
    async () => ({
      timeLogs: await fetchTimeLogsForStaff(staff.id),
      payroll: await fetchPayrollForStaff(staff.id),
    }),
    [staff.id],
  );

  const [fullName, setFullName] = useState(staff.full_name);
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [bankAccount, setBankAccount] = useState(staff.bank_account ?? "");
  const [role, setRole] = useState<StaffProfile["role"]>(staff.role);
  const [hourlyRate, setHourlyRate] = useState(staff.hourly_rate);
  const [saving, setSaving] = useState(false);

  const dirty =
    fullName.trim() !== staff.full_name ||
    phone.trim() !== (staff.phone ?? "") ||
    bankAccount.trim() !== (staff.bank_account ?? "") ||
    role !== staff.role ||
    hourlyRate !== staff.hourly_rate;

  async function save() {
    if (!fullName.trim()) {
      toast.error("Họ tên không được để trống.");
      return;
    }
    setSaving(true);
    try {
      await updateStaffProfile(staff.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bank_account: bankAccount.trim() || null,
        role,
        hourly_rate: hourlyRate,
      });
      toast.success("Đã lưu hồ sơ.");
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    try {
      await setStaffActive(staff.id, !staff.is_active);
      toast.success(staff.is_active ? `Đã khoá quyền truy cập của ${staff.full_name}.` : `Đã mở lại quyền cho ${staff.full_name}.`);
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được, thử lại nhé.");
    }
  }

  return (
    <div className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-headline-sm text-on-surface">{staff.full_name}</h2>
          <p className="flex items-center gap-1 text-label-sm text-on-surface-variant">
            <Mail size={13} strokeWidth={2.2} className="shrink-0" />
            <span className="truncate">{staff.email}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Tên đăng nhập không sửa được ở đây — đổi phải qua auth.admin.updateUserById()
          để khớp với auth.users.email, chưa có màn/RPC cho việc đó. */}

      <LabeledSwitch
        on={staff.is_active}
        onChange={() => void toggleActive()}
        onLabel="Đang hoạt động"
        offLabel="Đã khoá"
        tone="danger"
      />

      <div className="flex flex-col gap-3 border-t border-outline-variant pt-space-md">
        <FormField label="Họ tên">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </FormField>

        <FormField label="Số điện thoại">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </FormField>

        <FormField label="Số tài khoản ngân hàng">
          <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={inputClass} />
        </FormField>

        <FormField label="Vai trò">
          <select value={role} onChange={(e) => setRole(e.target.value as StaffProfile["role"])} className={inputClass}>
            <option value="staff">Nhân viên</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </FormField>

        <FormField label="Lương/giờ" hint="Chỉ dùng để gợi ý số tiền khi xác nhận lương tháng">
          <MoneyInput value={hourlyRate} onChange={setHourlyRate} placeholder="0" />
        </FormField>

        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>

      {history.loading ? (
        <Skeleton className="h-32 w-full rounded-card" />
      ) : history.error ? (
        <ErrorState onRetry={history.reload} />
      ) : (
        <>
          <div className="flex flex-col gap-2 border-t border-outline-variant pt-space-md">
            <h3 className="text-label-md font-semibold text-on-surface">Lịch sử chấm công</h3>
            {history.data!.timeLogs.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Chưa có ca chấm công nào.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {history.data!.timeLogs.map((log) => (
                  <TimeLogRow key={log.id} log={log} onChanged={history.reload} />
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-outline-variant pt-space-md">
            <h3 className="text-label-md font-semibold text-on-surface">Lịch sử thanh toán lương</h3>
            {history.data!.payroll.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">Chưa xác nhận thanh toán tháng nào.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {history.data!.payroll.map((p: PayrollRecord) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-body-sm">
                    <span className="text-on-surface-variant">
                      Tháng {monthLabel(new Date(`${p.pay_month}T00:00:00`))}
                    </span>
                    <span className="font-semibold text-secondary">{formatVnd(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Form tạo tài khoản nhân viên ───────────────────────────────────────────

function CreateStaffForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [role, setRole] = useState<StaffProfile["role"]>("staff");
  const [hourlyRate, setHourlyRate] = useState(0);
  const [busy, setBusy] = useState(false);

  function copyPassword() {
    void navigator.clipboard.writeText(password).then(
      () => toast.success("Đã copy mật khẩu."),
      () => toast.error("Không copy được, tự chọn rồi copy nhé."),
    );
  }

  async function submit() {
    if (!email.trim() || !fullName.trim() || password.length < 8) {
      toast.error("Điền đủ Email, Họ tên và mật khẩu tối thiểu 8 ký tự.");
      return;
    }
    setBusy(true);
    try {
      await createStaffAccount({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        bank_account: bankAccount.trim() || undefined,
        role,
        hourly_rate: hourlyRate || undefined,
      });
      toast.success(`Đã tạo tài khoản cho ${fullName.trim()}. Gửi email + mật khẩu này cho nhân viên nhé — chỉ hiện một lần.`);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tạo được tài khoản, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-outline-variant p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Email đăng nhập">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nhanvien@snackhub.vn"
            className={inputClass}
          />
        </FormField>

        <FormField label="Mật khẩu tạm" hint="Chỉ hiện một lần — copy gửi ngay cho nhân viên">
          <div className="flex gap-1.5">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            <button
              type="button"
              onClick={copyPassword}
              className="flex min-h-[44px] shrink-0 items-center justify-center rounded-card border border-outline-variant px-2.5 text-on-surface-variant hover:bg-surface-container-low"
              title="Copy mật khẩu"
            >
              <Copy size={16} strokeWidth={2.2} />
            </button>
          </div>
        </FormField>

        <FormField label="Họ tên">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
        </FormField>

        <FormField label="Số điện thoại" hint="Không bắt buộc">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912345678"
            className={inputClass}
          />
        </FormField>

        <FormField label="Số tài khoản ngân hàng" hint="Không bắt buộc">
          <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={inputClass} />
        </FormField>

        <FormField label="Vai trò">
          <select value={role} onChange={(e) => setRole(e.target.value as StaffProfile["role"])} className={inputClass}>
            <option value="staff">Nhân viên</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </FormField>

        <FormField label="Lương/giờ" hint="Không bắt buộc — chỉ dùng để gợi ý lương tháng">
          <MoneyInput value={hourlyRate} onChange={setHourlyRate} placeholder="0" />
        </FormField>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="min-h-[44px] flex-1 rounded-card bg-inverse-surface px-4 text-label-lg font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? "Đang tạo…" : "Tạo tài khoản"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-card border border-outline-variant px-4 text-label-md text-on-surface hover:bg-surface-container"
        >
          Huỷ
        </button>
      </div>
    </div>
  );
}

// ── Bảng tổng hợp giờ làm + xác nhận thanh toán lương ─────────────────────

function MonthlyHoursTable({
  staff,
  hours,
  payroll,
  attendance,
  month,
  onConfirmed,
}: {
  staff: StaffProfile[];
  hours: StaffMonthlyHours[];
  payroll: PayrollRecord[];
  attendance: StaffAttendanceStats[];
  month: Date;
  onConfirmed: () => void;
}) {
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const paidByStaffId = useMemo(() => new Map(payroll.map((p) => [p.staff_id, p])), [payroll]);
  const attendanceByStaffId = useMemo(() => new Map(attendance.map((a) => [a.staff_id, a])), [attendance]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function confirm(staffId: string, name: string, fallbackAmount: number) {
    const amount = amounts[staffId] ?? fallbackAmount;
    if (amount <= 0) {
      toast.error("Nhập số tiền lương trước khi xác nhận.");
      return;
    }
    setConfirmingId(staffId);
    try {
      await confirmStaffPayroll({ staffId, month, amount });
      toast.success(`Đã xác nhận thanh toán lương tháng ${monthLabel(month)} cho ${name}.`);
      onConfirmed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xác nhận được, thử lại nhé.");
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="text-label-lg text-on-surface">Tổng hợp giờ làm tháng {monthLabel(month)}</h2>

      {hours.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Chưa có nhân viên nào để tổng hợp.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left text-label-xs uppercase tracking-wide text-on-surface-variant">
                <th className="py-2 pr-3">Nhân viên</th>
                <th className="py-2 pr-3">Số ca</th>
                <th className="py-2 pr-3">Tổng giờ công</th>
                <th className="py-2 pr-3">Trễ ca</th>
                <th className="py-2 pr-3">Vắng ca</th>
                <th className="py-2 pr-3">Lương tháng {monthLabel(month)}</th>
                <th className="py-2 pr-3">Xác nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {hours.map((row) => {
                const paid = paidByStaffId.get(row.staff_id);
                const staffRow = staffById.get(row.staff_id);
                const isActive = staffRow?.is_active ?? true;
                const att = attendanceByStaffId.get(row.staff_id);
                const suggestedAmount = Math.round((staffRow?.hourly_rate ?? 0) * row.total_hours);

                return (
                  <tr key={row.staff_id}>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-on-surface">{row.full_name}</p>
                      <span className="text-label-xs text-on-surface-variant">{ROLE_LABEL[row.role]}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-on-surface">{row.shift_count}</td>
                    <td className="py-2.5 pr-3 font-mono text-on-surface">
                      {formatMinutes(row.total_minutes)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-label-xs font-semibold ${
                          att && att.late_count > 0
                            ? "bg-error-container text-on-error-container"
                            : "bg-secondary-container text-on-secondary-container"
                        }`}
                      >
                        {att?.late_count ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-label-xs font-semibold ${
                          att && att.absent_count > 0
                            ? "bg-error-container text-on-error-container"
                            : "bg-secondary-container text-on-secondary-container"
                        }`}
                      >
                        {att?.absent_count ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {paid ? (
                        <span className="font-semibold text-secondary">{formatVnd(paid.amount)}</span>
                      ) : (
                        <MoneyInput
                          value={amounts[row.staff_id] ?? suggestedAmount}
                          onChange={(v) => setAmounts((prev) => ({ ...prev, [row.staff_id]: v }))}
                          placeholder="0"
                          inputClassName="min-h-[40px] w-36"
                        />
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {paid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2.5 py-1 text-label-xs font-semibold text-on-secondary-container">
                          Đã thanh toán
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!isActive || confirmingId === row.staff_id}
                          onClick={() => void confirm(row.staff_id, row.full_name, suggestedAmount)}
                          className="min-h-[40px] shrink-0 rounded-card bg-inverse-surface px-3 text-label-sm font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
                          title={!isActive ? "Nhân viên đã bị khoá" : undefined}
                        >
                          Xác nhận thanh toán lương tháng {monthLabel(month)}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
