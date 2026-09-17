// POST /functions/v1/apply-discount
//
// Chỉ XEM TRƯỚC số tiền được giảm — không tiêu lượt mã.
// Lượt chỉ bị trừ khi đơn thực sự được tạo (create-order gọi redeem_discount_code).
// Rate limit chặt để chống brute-force dò mã.

import { adminClient, withinRateLimit } from "../_shared/supabase.ts";
import { applyDiscountSchema } from "../_shared/schemas.ts";
import { clientKey, fail, isOriginAllowed, json, preflight } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) return fail("FORBIDDEN_ORIGIN", "Nguồn không hợp lệ.", 403, origin);
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Method không hợp lệ.", 405, origin);

  const db = adminClient();

  try {
    // 10 lần thử / 60 giây / IP — đủ cho người dùng thật, chặn dò mã tự động.
    const key = await clientKey(req);
    if (!(await withinRateLimit(db, key, "apply_discount", 10, 60))) {
      return fail("RATE_LIMITED", "Bạn thử mã quá nhiều lần. Vui lòng đợi một chút.", 429, origin);
    }

    const parsed = applyDiscountSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("INVALID_INPUT", "Dữ liệu không hợp lệ.", 400, origin);

    const { data, error } = await db
      .rpc("preview_discount_code", { p_code: parsed.data.code, p_subtotal: parsed.data.subtotal })
      .maybeSingle();

    if (error || !data) {
      // Thông điệp giống nhau cho mọi nguyên nhân (sai mã / hết hạn / hết lượt /
      // chưa đủ tối thiểu) để không rò rỉ mã nào có thật.
      return fail("DISCOUNT_INVALID", "Mã giảm giá không hợp lệ hoặc không áp dụng được cho đơn này.", 400, origin);
    }

    return json(
      {
        code: data.discount_code,
        discount_amount: Number(data.discount_amount),
        subtotal_after: Math.max(0, parsed.data.subtotal - Number(data.discount_amount)),
      },
      200,
      origin,
    );
  } catch (e) {
    console.error("apply_discount_failed", e);
    return fail("INTERNAL_ERROR", "Có lỗi xảy ra, vui lòng thử lại.", 500, origin);
  }
});
