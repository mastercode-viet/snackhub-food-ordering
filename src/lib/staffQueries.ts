import { supabase } from "@/lib/supabase";
import { toIsoDate } from "@/lib/format";
import type { Tables } from "@/types/database";

/**
 * Truy vấn cho khu vực Nhân sự / Chấm công / Lương.
 *
 * Hai nhóm quyền tách theo RLS, không theo UI:
 *   - Chấm công (time_logs): mọi staff_profiles thao tác trên CHÍNH MÌNH
 *     (staff_id = auth.uid()), is_staff().
 *   - staff_profiles / payroll_history: chỉ superadmin, is_admin().
 */

export type StaffProfile = Tables<"staff_profiles">;
export type TimeLog = Tables<"time_logs">;
export type PayrollRecord = Tables<"payroll_history">;
export type Shift = Tables<"shifts">;
export type ShiftAssignment = Tables<"shift_assignments">;
export type ShiftAssignmentWithShift = ShiftAssignment & { shift: Shift };

/** Ngoài khoảng này (phút) so với giờ bắt đầu/kết thúc ca được gán thì tính là trễ/về sớm — dùng chung giữa cảnh báo lúc chấm công (CheckInOutWidget) và thống kê phía superadmin, chỉ định nghĩa đúng 1 chỗ. */
export const SHIFT_GRACE_MINUTES = 15;

function isoMonthStart(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
}

// ── Chấm công (Widget Check-in/Check-out) ─────────────────────────────────

/**
 * Ca đang mở của MỘT staff cụ thể. Phải lọc `staff_id` tường minh thay vì
 * chỉ dựa vào RLS: với superadmin, policy time_logs_admin_all (is_admin())
 * cho thấy ca mở của MỌI nhân viên chứ không riêng của họ, nên không lọc
 * tường minh sẽ có lúc trả nhầm ca của người khác.
 */
export async function fetchOpenTimeLog(staffId: string): Promise<TimeLog | null> {
  const { data, error } = await supabase
    .from("time_logs")
    .select("*")
    .eq("staff_id", staffId)
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Ca được gán cho MỘT nhân viên vào MỘT ngày cụ thể ("2026-09-20") — dùng đối chiếu lúc check-in/check-out, không chặn thao tác nếu lệch giờ. */
export async function fetchShiftAssignmentForStaffOnDate(
  staffId: string,
  workDate: string,
): Promise<ShiftAssignmentWithShift | null> {
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("*, shift:shifts(*)")
    .eq("staff_id", staffId)
    .eq("work_date", workDate)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as ShiftAssignmentWithShift | null;
}

/** staffId phải là auth.uid() của người gọi — RLS (with_check) sẽ chặn nếu không khớp. */
export async function checkIn(staffId: string): Promise<TimeLog> {
  const { data, error } = await supabase
    .from("time_logs")
    .insert({ staff_id: staffId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function checkOut(timeLogId: string): Promise<TimeLog> {
  const { data, error } = await supabase
    .from("time_logs")
    .update({ check_out_at: new Date().toISOString() })
    .eq("id", timeLogId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Quản lý nhân sự (chỉ superadmin) ───────────────────────────────────────

export type NewStaffAccount = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  bank_account?: string;
  role: StaffProfile["role"];
  hourly_rate?: number;
};

/**
 * Tạo tài khoản Supabase Auth + hồ sơ staff_profiles cho nhân viên mới.
 * PHẢI qua Edge Function: auth.admin.createUser() cần SERVICE_ROLE_KEY,
 * tuyệt đối không có ở frontend. Edge Function tự kiểm tra caller có phải
 * superadmin không (is_admin()) trước khi tạo — RLS insert staff_profiles
 * cũng chặn is_admin() nên hai lớp khớp nhau.
 */
export async function createStaffAccount(input: NewStaffAccount): Promise<void> {
  const { error } = await supabase.functions.invoke("create-staff-account", { body: input });
  if (error) {
    // FunctionsHttpError: body lỗi nằm trong error.context (Response) do
    // supabase-js không tự parse JSON của response lỗi.
    const context = (error as { context?: Response }).context;
    const payload = await context?.json().catch(() => null);
    throw new Error(payload?.message ?? error.message ?? "Không tạo được tài khoản, thử lại nhé.");
  }
}

export async function fetchStaffProfiles(): Promise<StaffProfile[]> {
  const { data, error } = await supabase.from("staff_profiles").select("*").order("full_name");
  if (error) throw error;
  return data;
}

export async function setStaffActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("staff_profiles").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function updateStaffProfile(
  id: string,
  patch: Partial<Pick<StaffProfile, "full_name" | "phone" | "bank_account" | "role" | "hourly_rate">>,
): Promise<void> {
  const { error } = await supabase.from("staff_profiles").update(patch).eq("id", id);
  if (error) throw error;
}

/** Lịch sử chấm công gần đây của MỘT nhân viên — dùng cho panel chi tiết, không giới hạn theo tháng đang xem. */
export async function fetchTimeLogsForStaff(staffId: string, limit = 20): Promise<TimeLog[]> {
  const { data, error } = await supabase
    .from("time_logs")
    .select("*")
    .eq("staff_id", staffId)
    .order("check_in_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Toàn bộ lịch sử lương đã xác nhận của MỘT nhân viên (mọi tháng), mới nhất trước. */
export async function fetchPayrollForStaff(staffId: string): Promise<PayrollRecord[]> {
  const { data, error } = await supabase
    .from("payroll_history")
    .select("*")
    .eq("staff_id", staffId)
    .order("pay_month", { ascending: false });
  if (error) throw error;
  return data;
}

export type StaffMonthlyHours = {
  staff_id: string;
  full_name: string;
  role: "superadmin" | "staff";
  shift_count: number;
  total_minutes: number;
  total_hours: number;
};

/** month: bất kỳ ngày nào trong tháng cần xem — RPC tự chuẩn hoá về đầu tháng. */
export async function fetchStaffMonthlyHours(month: Date): Promise<StaffMonthlyHours[]> {
  const { data, error } = await supabase.rpc("get_staff_monthly_hours", {
    p_month: isoMonthStart(month),
  });
  if (error) throw error;
  return data as StaffMonthlyHours[];
}

/** Các dòng lương đã xác nhận trong tháng — dùng để khoá nút "Xác nhận" của nhân viên đã trả. */
export async function fetchPayrollForMonth(month: Date): Promise<PayrollRecord[]> {
  const { data, error } = await supabase
    .from("payroll_history")
    .select("*")
    .eq("pay_month", isoMonthStart(month));
  if (error) throw error;
  return data;
}

/** Ghi 1 dòng payroll_history; confirmed_by = auth.uid() do RPC tự gắn. */
export async function confirmStaffPayroll(input: {
  staffId: string;
  month: Date;
  amount: number;
}): Promise<void> {
  const { error } = await supabase.rpc("confirm_staff_payroll", {
    p_staff_id: input.staffId,
    p_pay_month: isoMonthStart(input.month),
    p_amount: input.amount,
  });
  if (error) throw error;
}

// ── Ca làm (mẫu) — CRUD, chỉ superadmin ────────────────────────────────────

export async function fetchShifts(): Promise<Shift[]> {
  const { data, error } = await supabase.from("shifts").select("*").order("start_time");
  if (error) throw error;
  return data;
}

export async function createShift(input: { name: string; start_time: string; end_time: string }): Promise<Shift> {
  const { data, error } = await supabase.from("shifts").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateShift(
  id: string,
  patch: Partial<Pick<Shift, "name" | "start_time" | "end_time">>,
): Promise<void> {
  const { error } = await supabase.from("shifts").update(patch).eq("id", id);
  if (error) throw error;
}

/** Postgres 23503 = FK vi phạm — ca này còn đang được gán trong lịch, chặn xoá để không mất dấu vết lịch sử. */
export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Ca này đang được gán trong lịch làm việc — gỡ hết lịch gán trước khi xoá.");
    }
    throw error;
  }
}

// ── Lịch gán ca theo ngày cụ thể — chỉ superadmin ──────────────────────────

/** Toàn bộ lịch gán ca trong khoảng ngày [from, to] (yyyy-mm-dd), kèm thông tin ca. */
export async function fetchShiftAssignments(fromDate: string, toDate: string): Promise<ShiftAssignmentWithShift[]> {
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("*, shift:shifts(*)")
    .gte("work_date", fromDate)
    .lte("work_date", toDate)
    .order("work_date");
  if (error) throw error;
  return data as unknown as ShiftAssignmentWithShift[];
}

/**
 * Lịch gán ca của MỘT nhân viên trong khoảng ngày [from, to] — dùng cho trang
 * "Lịch của tôi". Lọc tường minh theo staff_id (không chỉ dựa vào RLS) vì
 * superadmin gọi hàm chung fetchShiftAssignments sẽ thấy TẤT CẢ nhân viên —
 * trang cá nhân luôn phải đúng là "của tôi" dù người gọi có quyền gì.
 */
export async function fetchShiftAssignmentsForStaff(
  staffId: string,
  fromDate: string,
  toDate: string,
): Promise<ShiftAssignmentWithShift[]> {
  const { data, error } = await supabase
    .from("shift_assignments")
    .select("*, shift:shifts(*)")
    .eq("staff_id", staffId)
    .gte("work_date", fromDate)
    .lte("work_date", toDate)
    .order("work_date");
  if (error) throw error;
  return data as unknown as ShiftAssignmentWithShift[];
}

/** Gán hoặc ĐỔI ca cho 1 nhân viên vào 1 ngày — upsert theo unique(staff_id, work_date) nên "sửa lịch gán" chỉ là gọi lại đúng hàm này với shift khác. */
export async function upsertShiftAssignment(input: {
  staffId: string;
  shiftId: string;
  workDate: string;
}): Promise<void> {
  const { error } = await supabase
    .from("shift_assignments")
    .upsert(
      { staff_id: input.staffId, shift_id: input.shiftId, work_date: input.workDate },
      { onConflict: "staff_id,work_date" },
    );
  if (error) throw error;
}

export async function deleteShiftAssignment(id: string): Promise<void> {
  const { error } = await supabase.from("shift_assignments").delete().eq("id", id);
  if (error) throw error;
}

const BULK_ASSIGN_MAX_DAYS = 62;

/** 0=CN..6=T7 (khớp Date.getDay()) */
function datesInRange(fromDate: string, toDate: string, weekdays?: number[]): string[] {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const dates: string[] = [];
  for (const d = from; d <= to; d.setDate(d.getDate() + 1)) {
    if (!weekdays || weekdays.includes(d.getDay())) dates.push(toIsoDate(d));
  }
  return dates;
}

/**
 * Gán 1 ca cho NHIỀU nhân viên trong 1 khoảng ngày (lọc thêm theo thứ trong
 * tuần nếu có) — 1 lệnh upsert duy nhất thay vì gọi upsertShiftAssignment
 * từng ngày/từng người. GHI ĐÈ ca đã gán trước đó trong khoảng ngày này
 * (cùng cơ chế onConflict như upsertShiftAssignment).
 */
export async function bulkAssignShift(input: {
  staffIds: string[];
  shiftId: string;
  fromDate: string;
  toDate: string;
  weekdays?: number[];
}): Promise<number> {
  const dates = datesInRange(input.fromDate, input.toDate, input.weekdays);
  if (dates.length > BULK_ASSIGN_MAX_DAYS) {
    throw new Error(`Khoảng ngày quá dài (tối đa ${BULK_ASSIGN_MAX_DAYS} ngày mỗi lượt gán hàng loạt).`);
  }
  const rows = input.staffIds.flatMap((staffId) =>
    dates.map((workDate) => ({ staff_id: staffId, shift_id: input.shiftId, work_date: workDate })),
  );
  if (rows.length === 0) return 0;
  const { error } = await supabase.from("shift_assignments").upsert(rows, { onConflict: "staff_id,work_date" });
  if (error) throw error;
  return rows.length;
}

// ── "Đang làm việc" + sửa/xoá chấm công — chỉ superadmin ───────────────────

export type OpenTimeLog = TimeLog & { staff: Pick<StaffProfile, "id" | "full_name"> };

/** Mọi ca đang mở (chưa check-out) của TẤT CẢ nhân viên — dùng cho bảng "Đang làm việc" của Admin. */
export async function fetchAllOpenTimeLogs(): Promise<OpenTimeLog[]> {
  const { data, error } = await supabase
    .from("time_logs")
    .select("*, staff:staff_profiles(id, full_name)")
    .is("check_out_at", null)
    .order("check_in_at");
  if (error) throw error;
  return data as unknown as OpenTimeLog[];
}

/** Sửa giờ vào/ra của 1 dòng chấm công (fix nhập sai) — Postgres 23514 = vi phạm check constraint check_out_at > check_in_at. */
export async function adminUpdateTimeLog(
  id: string,
  patch: Partial<Pick<TimeLog, "check_in_at" | "check_out_at">>,
): Promise<TimeLog> {
  const { data, error } = await supabase.from("time_logs").update(patch).eq("id", id).select().single();
  if (error) {
    if (error.code === "23514") throw new Error("Giờ ra phải sau giờ vào.");
    throw error;
  }
  return data;
}

/** Ép check-out hộ nhân viên quên bấm — set check_out_at = now(). */
export async function adminForceCheckout(id: string): Promise<TimeLog> {
  return adminUpdateTimeLog(id, { check_out_at: new Date().toISOString() });
}

export async function deleteTimeLog(id: string): Promise<void> {
  const { error } = await supabase.from("time_logs").delete().eq("id", id);
  if (error) throw error;
}

export type StaffAttendanceStats = {
  staff_id: string;
  full_name: string;
  assigned_days: number;
  late_count: number;
  absent_count: number;
  early_leave_count: number;
};

/** So khớp ca được gán với chấm công thực tế trong tháng — trễ/về sớm (>15p so với giờ ca) / vắng (có ca, ngày đã qua, không chấm công). */
export async function fetchStaffAttendanceStats(month: Date): Promise<StaffAttendanceStats[]> {
  const { data, error } = await supabase.rpc("get_staff_attendance_stats", {
    p_month: isoMonthStart(month),
  });
  if (error) throw error;
  return data as StaffAttendanceStats[];
}

export type StaffAttendanceDetailRow = {
  work_date: string;
  shift_name: string;
  shift_start: string;
  shift_end: string;
  check_in_at: string | null;
  check_out_at: string | null;
  /** Dương = trễ/về muộn hơn giờ ca, âm = sớm hơn giờ ca, null = chưa chấm công mốc đó. */
  check_in_deviation_minutes: number | null;
  check_out_deviation_minutes: number | null;
};

/** Chi tiết từng ngày trong tháng cho MỘT nhân viên — dùng cho bảng chấm công trong StaffDetailPanel. RLS tự chặn staff thường gọi cho người khác. */
export async function fetchStaffAttendanceDetail(
  staffId: string,
  month: Date,
): Promise<StaffAttendanceDetailRow[]> {
  const { data, error } = await supabase.rpc("get_staff_attendance_detail", {
    p_staff_id: staffId,
    p_month: isoMonthStart(month),
  });
  if (error) throw error;
  return data as StaffAttendanceDetailRow[];
}
