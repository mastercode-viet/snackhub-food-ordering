// POST /functions/v1/payos-webhook   (verify_jwt = false)
//
// Ba lớp bảo vệ, theo đúng thứ tự:
//   1. Verify HMAC-SHA256 — chưa xác thực chữ ký thì KHÔNG đọc gì trong payload.
//   2. Chốt idempotent ở DB: event_hash UNIQUE, PayOS gửi lại lần 2 sẽ trượt insert.
//   3. Kiểm tra trạng thái đơn trước khi cập nhật — đơn đã 'paid' thì bỏ qua.
//
// Luôn trả 200 cho các trường hợp "đã xử lý rồi" để PayOS ngừng retry.

import { adminClient } from "../_shared/supabase.ts";
import { eventHash, verifyWebhook } from "../_shared/payos.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ code: "01", desc: "method not allowed" }), { status: 405 });
  }

  const raw = await req.text();

  // ── 1. Verify chữ ký ─────────────────────────────────────────────────────
  const data = await verifyWebhook(raw);
  if (!data) {
    console.warn("payos_webhook_bad_signature");
    return new Response(JSON.stringify({ code: "01", desc: "invalid signature" }), { status: 401 });
  }

  const db = adminClient();
  const hash = await eventHash(raw);
  const payosOrderCode = Number(data.orderCode);

  try {
    // ── 2. Chốt idempotent ─────────────────────────────────────────────────
    const { error: insertErr } = await db.from("payos_webhook_events").insert({
      payos_order_code: Number.isFinite(payosOrderCode) ? payosOrderCode : null,
      reference: typeof data.reference === "string" ? data.reference : null,
      event_hash: hash,
      payload: JSON.parse(raw),
    });

    if (insertErr) {
      // 23505 = unique_violation -> đúng event này đã nhận trước đó.
      if (insertErr.code === "23505") {
        return ok("already processed");
      }
      throw insertErr;
    }

    // PayOS gửi 1 event kiểm tra khi đăng ký URL, orderCode không có thật.
    if (!Number.isFinite(payosOrderCode)) {
      await markProcessed(db, hash, null, null);
      return ok("test event acknowledged");
    }

    // ── 3. Kiểm tra trạng thái đơn trước khi cập nhật ───────────────────────
    const { data: order, error: orderErr } = await db
      .from("orders")
      .select("id, status, payment_status, discount_code_id")
      .eq("payos_order_code", payosOrderCode)
      .maybeSingle();
    if (orderErr) throw orderErr;

    if (!order) {
      await markProcessed(db, hash, null, "order not found");
      return ok("order not found");
    }

    if (order.payment_status === "paid") {
      await markProcessed(db, hash, order.id, null);
      return ok("already paid");
    }

    const paid = data.code === "00";

    if (paid) {
      // Điều kiện payment_status='pending' làm cho update này an toàn khi có
      // hai webhook chạy song song: chỉ một request khớp và ghi được.
      const { data: updated, error: upErr } = await db
        .from("orders")
        .update({ payment_status: "paid" }) // paid_at do trigger DB tự đóng dấu
        .eq("id", order.id)
        .eq("payment_status", "pending")
        .select("id")
        .maybeSingle();
      if (upErr) throw upErr;
      if (!updated) {
        await markProcessed(db, hash, order.id, null);
        return ok("already handled concurrently");
      }
    } else {
      // Thanh toán thất bại / khách bấm hủy trên trang PayOS.
      if (order.status === "pending_confirmation") {
        await db
          .from("orders")
          .update({
            payment_status: "failed",
            status: "cancelled",
            cancelled_by: "system",
            cancel_reason: `PayOS: ${data.desc ?? "thanh toán không thành công"}`,
          })
          .eq("id", order.id)
          .eq("payment_status", "pending");

        if (order.discount_code_id) {
          await db.rpc("release_discount_code", { p_discount_code_id: order.discount_code_id });
        }
      }
    }

    await markProcessed(db, hash, order.id, null);
    return ok("ok");
  } catch (e) {
    console.error("payos_webhook_failed", e);
    await db
      .from("payos_webhook_events")
      .update({ error_message: String(e) })
      .eq("event_hash", hash);
    // Trả 500 để PayOS retry — lần retry sau sẽ trượt ở chốt idempotent nếu
    // phần ghi đơn đã thành công, nên không có nguy cơ xử lý trùng.
    return new Response(JSON.stringify({ code: "99", desc: "internal error" }), { status: 500 });
  }
});

function ok(desc: string): Response {
  return new Response(JSON.stringify({ code: "00", desc }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function markProcessed(
  db: ReturnType<typeof adminClient>,
  hash: string,
  orderId: string | null,
  errorMessage: string | null,
) {
  await db
    .from("payos_webhook_events")
    .update({ processed: true, processed_at: new Date().toISOString(), order_id: orderId, error_message: errorMessage })
    .eq("event_hash", hash);
}
