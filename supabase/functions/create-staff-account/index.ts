// POST /functions/v1/create-staff-account
//
// Chỉ Superadmin gọi được. Tạo tài khoản Supabase Auth cho nhân viên rồi ghi
// hồ sơ staff_profiles — 2 bước này PHẢI cùng thành công hoặc cùng thất bại,
// nếu không sẽ có tài khoản Auth mồ côi (đăng nhập được nhưng is_admin()/
// is_staff() luôn false vì không có dòng staff_profiles).
//
// SERVICE_ROLE_KEY (qua adminClient()) là bắt buộc: auth.admin.createUser()
// không tồn tại ở API công khai, đây là lý do action này không thể làm
// thẳng từ frontend như các bảng khác.

import { adminClient, callerIsAdmin } from "../_shared/supabase.ts";
import { createStaffAccountSchema } from "../_shared/schemas.ts";
import { fail, isOriginAllowed, json, preflight } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) return fail("FORBIDDEN_ORIGIN", "Nguồn không hợp lệ.", 403, origin);
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Method không hợp lệ.", 405, origin);

  // ── 1. Chỉ superadmin ────────────────────────────────────────────────────
  if (!(await callerIsAdmin(req))) {
    return fail("FORBIDDEN", "Chỉ Superadmin mới tạo được tài khoản nhân viên.", 403, origin);
  }

  const db = adminClient();

  try {
    // ── 2. Validate input ────────────────────────────────────────────────
    const parsed = createStaffAccountSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json(
        { error: "INVALID_INPUT", message: "Thông tin nhân viên không hợp lệ.", issues: parsed.error.flatten() },
        400,
        origin,
      );
    }
    const input = parsed.data;

    // ── 3. Tạo tài khoản Auth. email_confirm=true: admin tạo trực tiếp, ─────
    // nhân viên không tự đăng ký nên không cần luồng xác nhận email.
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });

    if (createErr || !created.user) {
      const duplicate = createErr?.message?.toLowerCase().includes("already");
      return fail(
        duplicate ? "EMAIL_TAKEN" : "AUTH_CREATE_FAILED",
        duplicate ? "Email này đã có tài khoản." : "Không tạo được tài khoản, thử lại nhé.",
        duplicate ? 409 : 500,
        origin,
      );
    }

    // ── 4. Ghi hồ sơ staff_profiles ─────────────────────────────────────────
    // email lưu lại làm bản sao hiển thị "tên đăng nhập" trong UI — nguồn sự
    // thật thật sự vẫn là auth.users.email (Supabase Auth dùng để login).
    const { error: profileErr } = await db.from("staff_profiles").insert({
      id: created.user.id,
      email: input.email,
      role: input.role,
      full_name: input.full_name,
      phone: input.phone ?? null,
      bank_account: input.bank_account ?? null,
      hourly_rate: input.hourly_rate ?? 0,
    });

    if (profileErr) {
      // Rollback: không để lại tài khoản Auth không có hồ sơ tương ứng.
      await db.auth.admin.deleteUser(created.user.id);
      throw profileErr;
    }

    return json(
      { id: created.user.id, email: input.email, full_name: input.full_name, role: input.role },
      201,
      origin,
    );
  } catch (e) {
    console.error("create_staff_account_failed", e);
    return fail("INTERNAL_ERROR", "Có lỗi xảy ra, vui lòng thử lại.", 500, origin);
  }
});
