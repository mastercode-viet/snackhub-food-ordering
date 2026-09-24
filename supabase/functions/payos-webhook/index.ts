// POST /functions/v1/payos-webhook   (verify_jwt = false)
//
// Năm lớp bảo vệ, theo đúng thứ tự:
//   1. Verify HMAC-SHA256 — chưa xác thực chữ ký thì KHÔNG đọc gì trong payload.
//   2. Chốt idempotent ở DB: event_hash UNIQUE, PayOS gửi lại lần 2 sẽ trượt insert.
//   3. Kiểm tra trạng thái đơn trước khi cập nhật — đơn đã 'paid' thì bỏ qua.
//   4. Đối chiếu số tiền nhận được với total_amount của đơn.
//   5. Update paid dùng .neq('payment_status','paid') thay vì .eq('pending') —
//      webhook LUÔN thắng dù cancel-payment (khách bấm back) đã lật đơn sang
//      'cancelled' trước đó.
//   6. Trả tiền = coi như đã xác nhận đơn: status nhảy thẳng sang 'preparing',
//      không cần Admin bấm "Xác nhận đơn" tay nữa.
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
      .select("id, order_code, status, payment_status, discount_code_id, total_amount")
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

    // Chữ ký chỉ chứng minh event ĐẾN TỪ PayOS, không chứng minh khách đã trả
    // đủ. Với VietQR khách có thể chuyển thiếu vào tài khoản ảo, nên phải đối
    // chiếu lại số tiền: thiếu thì không ghi 'paid', nhưng cũng KHÔNG tự huỷ
    // (tiền thật đã vào) — treo lại cho admin xử lý tay.
    const expectedAmount = Math.round(Number(order.total_amount));
    const receivedAmount = Number(data.amount);

    if (data.code === "00" && !(receivedAmount >= expectedAmount)) {
      await markProcessed(
        db,
        hash,
        order.id,
        `amount_mismatch: nhận ${data.amount}, cần ${expectedAmount}`,
      );
      console.warn("payos_webhook_amount_mismatch", { payosOrderCode, receivedAmount, expectedAmount });
      return ok("amount mismatch");
    }

    const paid = data.code === "00";

    if (paid) {
      // `.neq('payment_status','paid')` (thay vì chỉ khớp 'pending') là chốt đua
      // THẬT: cancel-payment (khách bấm back) hoặc chính webhook (nhánh thất bại
      // bên dưới) có thể đã lật payment_status sang 'failed' và status sang
      // 'cancelled' TRƯỚC KHI event 'paid' này tới nơi — tiền đã về tài khoản
      // quán thì webhook phải luôn thắng, không được để đơn kẹt ở trạng thái huỷ
      // trong khi tiền đã nhận.
      //
      // Trả tiền online = coi như đã xác nhận đơn, khỏi cần Admin bấm "Xác nhận
      // đơn" tay: nhảy thẳng pending_confirmation/cancelled -> preparing. Không
      // lùi một đơn đã đi xa hơn (delivering/completed) về preparing.
      const CONFIRMED_OR_LATER = new Set(["preparing", "delivering", "completed"]);
      const nextStatus = CONFIRMED_OR_LATER.has(order.status) ? order.status : "preparing";

      const { data: updated, error: upErr } = await db
        .from("orders")
        .update({
          payment_status: "paid", // paid_at do trigger DB tự đóng dấu
          status: nextStatus,
          cancelled_at: null,
          cancelled_by: null,
          cancel_reason: null,
        })
        .eq("id", order.id)
        .neq("payment_status", "paid")
        .select("id")
        .maybeSingle();
      if (upErr) throw upErr;
      if (!updated) {
        await markProcessed(db, hash, order.id, null);
        return ok("already handled concurrently");
      }

      await broadcastPaid(order.order_code, expectedAmount);
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

/**
 * Báo cho trang QR của khách biết tiền đã về, không đợi vòng poll.
 *
 * Dùng Broadcast chứ không phải Postgres Changes: bảng `orders` không có policy
 * nào cho `anon`, nên khách vãng lai không thể nhận thay đổi dòng qua RLS — mở
 * quyền SELECT cho anon thì lộ tên/SĐT/địa chỉ của mọi khách. Tên kênh mang
 * order_code, đúng mô hình "biết mã đơn mới xem được đơn" đang dùng ở chỗ khác.
 *
 * Lỗi ở đây KHÔNG được làm hỏng webhook — trang QR còn vòng poll dự phòng.
 */
async function broadcastPaid(orderCode: string, amount: number): Promise<void> {
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `order:${orderCode}`,
            event: "paid",
            payload: { order_code: orderCode, amount },
          },
        ],
      }),
    });
  } catch (e) {
    console.warn("payos_broadcast_failed", e);
  }
}

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
