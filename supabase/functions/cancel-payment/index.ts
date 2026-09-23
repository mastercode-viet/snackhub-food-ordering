// POST /functions/v1/cancel-payment
//
// Khách rời trang QR (bấm back / đóng tab / đổi phương thức thanh toán).
// Huỷ link PayOS để mã QR cũ không thu được tiền nữa, huỷ đơn, trả lại lượt
// mã giảm giá.
//
// Idempotent: gọi nhiều lần trên cùng một đơn chỉ có lần đầu ăn.

import { adminClient, withinRateLimit } from "../_shared/supabase.ts";
import { cancelPaymentSchema } from "../_shared/schemas.ts";
import { clientKey, fail, isOriginAllowed, json, preflight } from "../_shared/http.ts";
import { cancelPaymentLink } from "../_shared/payos.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) return fail("FORBIDDEN_ORIGIN", "Nguồn không hợp lệ.", 403, origin);
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Method không hợp lệ.", 405, origin);

  const db = adminClient();

  try {
    const key = await clientKey(req);
    if (!(await withinRateLimit(db, key, "cancel_payment", 20, 60))) {
      return fail("RATE_LIMITED", "Bạn thao tác quá nhanh, thử lại sau ít phút.", 429, origin);
    }

    const parsed = cancelPaymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("INVALID_INPUT", "Mã đơn không hợp lệ.", 400, origin);

    const orderCode = parsed.data.order_code.toUpperCase();

    const { data: order, error } = await db
      .from("orders")
      .select("id, status, payment_status, discount_code_id, payos_payment_link_id")
      .eq("order_code", orderCode)
      .maybeSingle();
    if (error) throw error;
    if (!order) return fail("ORDER_NOT_FOUND", "Không tìm thấy đơn.", 404, origin);

    // Webhook đã ghi nhận tiền -> tuyệt đối không đụng vào đơn.
    if (order.payment_status === "paid") {
      return json({ cancelled: false, reason: "PAID" }, 200, origin);
    }
    if (order.status !== "pending_confirmation" || order.payment_status !== "pending") {
      return json({ cancelled: false, reason: "NOT_PENDING" }, 200, origin);
    }

    if (order.payos_payment_link_id) {
      try {
        await cancelPaymentLink(order.payos_payment_link_id, "Khách rời trang thanh toán");
      } catch (e) {
        // Link có thể đã tự hết hạn bên PayOS — vẫn đóng đơn phía mình.
        console.warn("payos_cancel_link_failed", e);
      }
    }

    // Điều kiện payment_status='pending' là chốt đua với webhook: nếu khách
    // vừa chuyển tiền xong đúng lúc bấm back, webhook thắng và update này trượt.
    //
    // Chiều ngược lại (update này thắng trước, webhook 'paid' tới SAU khi đơn
    // đã bị huỷ ở đây) KHÔNG được xử lý ở function này — cố "vá" thêm một lớp
    // khoá ở đây sẽ chỉ tạo ra một chốt đua thứ hai chồng lên chốt đua đầu.
    // payos-webhook/index.ts mới là nơi xử lý: update ghi 'paid' của nó dùng
    // .neq('payment_status','paid') (không phải .eq('pending')) nên vẫn ăn được
    // dù dòng dưới đây đã chạy trước, và nó tự mở lại status về
    // 'pending_confirmation' khi reconcile. Đừng sửa lại chỗ này khi gặp báo cáo
    // "đơn đã trả tiền mà vẫn hiện huỷ" — sửa ở webhook.
    const { data: cancelled, error: upErr } = await db
      .from("orders")
      .update({
        status: "cancelled",
        payment_status: "failed",
        cancelled_by: "customer",
        cancel_reason: "Khách rời trang thanh toán",
      })
      .eq("id", order.id)
      .eq("payment_status", "pending")
      .select("id")
      .maybeSingle();
    if (upErr) throw upErr;

    if (!cancelled) return json({ cancelled: false, reason: "RACED" }, 200, origin);

    if (order.discount_code_id) {
      await db.rpc("release_discount_code", { p_discount_code_id: order.discount_code_id });
    }

    return json({ cancelled: true }, 200, origin);
  } catch (e) {
    console.error("cancel_payment_failed", e);
    return fail("INTERNAL_ERROR", "Có lỗi xảy ra, vui lòng thử lại.", 500, origin);
  }
});
