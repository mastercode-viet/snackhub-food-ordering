// POST /functions/v1/create-order
//
// Nguyên tắc: frontend chỉ gửi product_id + option_ids + quantity.
// TOÀN BỘ giá được tra lại từ DB và tính ở server — client không bao giờ
// quyết định được số tiền phải trả.

import { adminClient, storeIsOpen, withinRateLimit } from "../_shared/supabase.ts";
import { createOrderSchema, type CartItemInput } from "../_shared/schemas.ts";
import { clientKey, fail, isOriginAllowed, json, preflight } from "../_shared/http.ts";
import { createPaymentLink, newPayosOrderCode } from "../_shared/payos.ts";

/**
 * Một dòng order_items sau khi tra giá ở server. Dùng CHUNG hình dạng cho cả
 * dòng sản phẩm lẫn dòng combo (thay vì union) vì cả hai đều insert thẳng
 * vào cùng một bảng — combo chỉ để `product_id = null` và điền
 * `combo_id`/`combo_items_snapshot`, sản phẩm thì ngược lại.
 */
interface BuiltItem {
  product_id: string | null;
  combo_id: string | null;
  product_name: string;
  product_image_url: string | null;
  base_price: number;
  options: Array<{
    group_id: string;
    group_name: string;
    option_id: string;
    option_name: string;
    price_delta: number;
  }>;
  options_price: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  item_note: string | null;
  combo_items_snapshot: Array<{ product_id: string; product_name: string; quantity: number }>;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) return fail("FORBIDDEN_ORIGIN", "Nguồn không hợp lệ.", 403, origin);
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Method không hợp lệ.", 405, origin);

  const db = adminClient();

  try {
    // ── 1. Rate limit: tối đa 5 đơn / 60 giây / IP (chống spam đơn ảo) ──────
    const key = await clientKey(req);
    if (!(await withinRateLimit(db, key, "create_order", 5, 60))) {
      return fail("RATE_LIMITED", "Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.", 429, origin);
    }

    // ── 2. Validate input bằng Zod ─────────────────────────────────────────
    const parsed = createOrderSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return json(
        { error: "INVALID_INPUT", message: "Thông tin đơn hàng không hợp lệ.", issues: parsed.error.flatten() },
        400,
        origin,
      );
    }
    const input = parsed.data;

    // ── 3. Giờ hoạt động — kiểm tra lại ở server ────────────────────────────
    if (!(await storeIsOpen(db))) {
      return fail("STORE_CLOSED", "Quán chỉ nhận đơn từ 6:00 đến 18:00. Hẹn bạn quay lại nhé!", 409, origin);
    }

    // ── 4. Dựng giỏ hàng từ dữ liệu DB ─────────────────────────────────────
    const built = await buildItems(db, input.items);
    if ("error" in built) return fail(built.error, built.message, 400, origin);
    const items = built.items;

    const subtotal = items.reduce((s, i) => s + i.line_total, 0);

    const { data: settings, error: settingsErr } = await db
      .from("store_settings")
      .select("shipping_fee, min_order_amount")
      .eq("id", 1)
      .single();
    if (settingsErr) throw settingsErr;

    if (subtotal < Number(settings.min_order_amount)) {
      return fail(
        "BELOW_MIN_ORDER",
        `Đơn tối thiểu ${Number(settings.min_order_amount).toLocaleString("vi-VN")}đ.`,
        400,
        origin,
      );
    }

    // ── 5. Mã giảm giá: tiêu lượt bằng atomic update trong DB ───────────────
    let discountAmount = 0;
    let discountCodeId: string | null = null;
    let discountCode: string | null = null;

    if (input.discount_code) {
      const { data, error } = await db
        .rpc("redeem_discount_code", { p_code: input.discount_code, p_subtotal: subtotal })
        .maybeSingle();
      if (error) {
        // P0001 = DISCOUNT_INVALID: hết lượt, hết hạn, hoặc chưa đủ điều kiện
        return fail("DISCOUNT_INVALID", "Mã giảm giá không hợp lệ hoặc đã hết lượt sử dụng.", 400, origin);
      }
      discountAmount = Number(data!.discount_amount);
      discountCodeId = data!.discount_code_id;
      discountCode = data!.discount_code;
    }

    const shippingFee = Number(settings.shipping_fee);
    const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

    // ── 6. Ghi đơn. order_code do trigger DB sinh ngẫu nhiên. ───────────────
    const payosOrderCode = input.payment_method === "payos" ? newPayosOrderCode() : null;

    const { data: order, error: orderErr } = await db
      .from("orders")
      .insert({
        payment_method: input.payment_method,
        payment_status: input.payment_method === "payos" ? "pending" : "unpaid",
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        building: input.building,
        floor: input.floor ?? null,
        room: input.room ?? null,
        class_name: input.class_name ?? null,
        delivery_note: input.delivery_note ?? null,
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        discount_code_id: discountCodeId,
        discount_code: discountCode,
        payos_order_code: payosOrderCode,
      })
      .select("id, order_code, total_amount, status, payment_status")
      .single();

    if (orderErr) {
      if (discountCodeId) await db.rpc("release_discount_code", { p_discount_code_id: discountCodeId });
      throw orderErr;
    }

    const { error: itemsErr } = await db
      .from("order_items")
      .insert(items.map((i) => ({ ...i, order_id: order.id })));

    if (itemsErr) {
      await rollback(db, order.id, discountCodeId);
      throw itemsErr;
    }

    // ── 7. PayOS: tạo link thanh toán ──────────────────────────────────────
    if (input.payment_method === "payos") {
      try {
        const link = await createPaymentLink({
          orderCode: payosOrderCode!,
          amount: Math.round(totalAmount),
          description: order.order_code, // 13 ký tự, dưới giới hạn 25 của PayOS
          returnUrl: `${Deno.env.get("PUBLIC_SITE_URL")}/don-hang/${order.order_code}`,
          cancelUrl: `${Deno.env.get("PUBLIC_SITE_URL")}/don-hang/${order.order_code}?huy=1`,
          buyerName: input.customer_name,
          buyerPhone: input.customer_phone,
          // pg_cron cũng tự hủy đơn treo sau 15 phút — đây là lớp chặn thứ hai.
          expiredAt: Math.floor(Date.now() / 1000) + 15 * 60,
        });

        await db
          .from("orders")
          .update({ payos_payment_link_id: link.paymentLinkId, payos_checkout_url: link.checkoutUrl })
          .eq("id", order.id);

        return json(
          {
            order_code: order.order_code,
            total_amount: totalAmount,
            payment_method: "payos",
            checkout_url: link.checkoutUrl,
            qr_code: link.qrCode,
          },
          201,
          origin,
        );
      } catch (e) {
        // Không tạo được link -> huỷ đơn để khách không thấy đơn treo vô nghĩa.
        await rollback(db, order.id, discountCodeId);
        console.error("payos_create_link_failed", e);
        return fail("PAYOS_UNAVAILABLE", "Không tạo được mã thanh toán. Vui lòng thử lại hoặc chọn COD.", 502, origin);
      }
    }

    return json(
      { order_code: order.order_code, total_amount: totalAmount, payment_method: "cod" },
      201,
      origin,
    );
  } catch (e) {
    console.error("create_order_failed", e);
    return fail("INTERNAL_ERROR", "Có lỗi xảy ra, vui lòng thử lại.", 500, origin);
  }
});

async function rollback(db: ReturnType<typeof adminClient>, orderId: string, discountCodeId: string | null) {
  await db.from("orders").delete().eq("id", orderId);
  if (discountCodeId) await db.rpc("release_discount_code", { p_discount_code_id: discountCodeId });
}

/**
 * Tra lại sản phẩm/option/combo từ DB rồi tính giá. Trả về snapshot đầy đủ
 * để ghi vào order_items (không JOIN sống khi hiển thị lại đơn).
 */
async function buildItems(
  db: ReturnType<typeof adminClient>,
  cart: CartItemInput[],
): Promise<{ items: BuiltItem[] } | { error: string; message: string }> {
  const productLines = cart.filter((i) => i.kind === "product");
  const comboLines = cart.filter((i) => i.kind === "combo");

  // ── Sản phẩm lẻ: y hệt logic cũ ─────────────────────────────────────────
  const productIds = [...new Set(productLines.map((i) => i.product_id))];
  const optionIds = [...new Set(productLines.flatMap((i) => i.option_ids))];

  const { data: products, error: pErr } = await db
    .from("products")
    .select("id, name, image_url, base_price, discount_percent, is_available")
    .in("id", productIds);
  if (pErr) throw pErr;

  const productById = new Map(products!.map((p) => [p.id, p]));
  for (const id of productIds) {
    const p = productById.get(id);
    if (!p) return { error: "PRODUCT_NOT_FOUND", message: "Có món trong giỏ không còn tồn tại." };
    if (!p.is_available) return { error: "PRODUCT_UNAVAILABLE", message: `"${p.name}" đang tạm hết hàng.` };
  }

  // Toàn bộ nhóm option của các món trong giỏ — cần để kiểm tra nhóm bắt buộc.
  const { data: groups, error: gErr } = await db
    .from("product_option_groups")
    .select("id, product_id, name, is_required, min_select, max_select")
    .in("product_id", productIds);
  if (gErr) throw gErr;
  const groupById = new Map(groups!.map((g) => [g.id, g]));

  const optionById = new Map<string, { id: string; group_id: string; name: string; price_delta: number; is_available: boolean }>();
  if (optionIds.length > 0) {
    const { data: options, error: oErr } = await db
      .from("product_options")
      .select("id, group_id, name, price_delta, is_available")
      .in("id", optionIds);
    if (oErr) throw oErr;
    for (const o of options!) optionById.set(o.id, o);
  }

  // ── Combo: tra combo + món con, validate còn bán được ───────────────────
  const comboIds = [...new Set(comboLines.map((i) => i.combo_id))];
  const comboById = new Map<string, { id: string; name: string; image_url: string | null; price: number; is_available: boolean }>();
  const comboItemsByComboId = new Map<
    string,
    Array<{ product_id: string; name: string; quantity: number; is_available: boolean }>
  >();

  if (comboIds.length > 0) {
    const { data: combos, error: cErr } = await db
      .from("combos")
      .select("id, name, image_url, price, is_available")
      .in("id", comboIds);
    if (cErr) throw cErr;
    for (const c of combos!) comboById.set(c.id, c);

    for (const id of comboIds) {
      const c = comboById.get(id);
      if (!c) return { error: "COMBO_NOT_FOUND", message: "Có combo trong giỏ không còn tồn tại." };
      if (!c.is_available) return { error: "COMBO_UNAVAILABLE", message: `Combo "${c.name}" đang tạm hết.` };
    }

    // Truy vấn phẳng + join bằng Map (giống hệt cách products/options ở trên
    // được tra) thay vì nested-select qua FK: adminClient() không truyền
    // generic Database nên supabase-js không biết chiều quan hệ, suy luận
    // sai `products` thành mảng dù thực chất mỗi combo_item chỉ có 1 sản
    // phẩm (many-to-one). Truy vấn phẳng tránh hẳn vùng xám kiểu dữ liệu đó.
    const { data: comboItemRows, error: ciErr } = await db
      .from("combo_items")
      .select("combo_id, product_id, quantity")
      .in("combo_id", comboIds);
    if (ciErr) throw ciErr;

    const comboProductIds = [...new Set(comboItemRows!.map((r) => r.product_id))];
    const comboProductById = new Map<string, { id: string; name: string; is_available: boolean }>();
    if (comboProductIds.length > 0) {
      const { data: comboProducts, error: cpErr } = await db
        .from("products")
        .select("id, name, is_available")
        .in("id", comboProductIds);
      if (cpErr) throw cpErr;
      for (const p of comboProducts!) comboProductById.set(p.id, p);
    }

    for (const row of comboItemRows!) {
      const product = comboProductById.get(row.product_id);
      if (!product) continue; // sản phẩm đã bị xoá — về lý thuyết không xảy ra vì FK restrict
      const list = comboItemsByComboId.get(row.combo_id) ?? [];
      list.push({
        product_id: product.id,
        name: product.name,
        quantity: row.quantity,
        is_available: product.is_available,
      });
      comboItemsByComboId.set(row.combo_id, list);
    }

    // Phòng vệ thêm: `combos.is_available` là công tắc chính, nhưng nếu quán
    // tắt is_available của 1 món con mà quên tắt combo, vẫn chặn ở đây —
    // không tin riêng một cờ duy nhất.
    for (const id of comboIds) {
      const rows = comboItemsByComboId.get(id) ?? [];
      const missing = rows.find((r) => !r.is_available);
      if (missing) {
        return {
          error: "COMBO_ITEM_UNAVAILABLE",
          message: `Combo "${comboById.get(id)!.name}" đang thiếu "${missing.name}", tạm không đặt được.`,
        };
      }
    }
  }

  // ── Dựng từng dòng theo ĐÚNG thứ tự giỏ hàng gốc ─────────────────────────
  const items: BuiltItem[] = [];

  for (const line of cart) {
    if (line.kind === "combo") {
      const combo = comboById.get(line.combo_id)!;
      const comboItems = comboItemsByComboId.get(combo.id) ?? [];
      const unitPrice = Number(combo.price);

      items.push({
        product_id: null,
        combo_id: combo.id,
        product_name: combo.name,
        product_image_url: combo.image_url,
        base_price: unitPrice,
        options: [],
        options_price: 0,
        unit_price: unitPrice,
        quantity: line.quantity,
        line_total: unitPrice * line.quantity,
        item_note: line.item_note ?? null,
        combo_items_snapshot: comboItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.name,
          quantity: i.quantity,
        })),
      });
      continue;
    }

    const product = productById.get(line.product_id)!;
    const chosen: BuiltItem["options"] = [];
    const countByGroup = new Map<string, number>();

    for (const optId of line.option_ids) {
      const opt = optionById.get(optId);
      if (!opt) return { error: "OPTION_NOT_FOUND", message: "Tùy chọn không còn tồn tại." };
      if (!opt.is_available) return { error: "OPTION_UNAVAILABLE", message: `Tùy chọn "${opt.name}" đang tạm hết.` };

      const group = groupById.get(opt.group_id);
      // Chặn ghép option của món khác vào món này.
      if (!group || group.product_id !== line.product_id) {
        return { error: "OPTION_MISMATCH", message: "Tùy chọn không thuộc món đã chọn." };
      }

      chosen.push({
        group_id: group.id,
        group_name: group.name,
        option_id: opt.id,
        option_name: opt.name,
        price_delta: Number(opt.price_delta),
      });
      countByGroup.set(group.id, (countByGroup.get(group.id) ?? 0) + 1);
    }

    // Nhóm bắt buộc phải chọn đủ, và không vượt max_select.
    for (const g of groups!.filter((g) => g.product_id === line.product_id)) {
      const n = countByGroup.get(g.id) ?? 0;
      if (g.is_required && n < Math.max(1, g.min_select)) {
        return { error: "OPTION_REQUIRED", message: `Vui lòng chọn "${g.name}" cho ${product.name}.` };
      }
      if (n > g.max_select) {
        return { error: "OPTION_TOO_MANY", message: `"${g.name}" chỉ được chọn tối đa ${g.max_select}.` };
      }
    }

    const discounted = Math.round(Number(product.base_price) * (1 - product.discount_percent / 100));
    const optionsPrice = chosen.reduce((s, o) => s + o.price_delta, 0);
    const unitPrice = Math.max(0, discounted + optionsPrice);

    items.push({
      product_id: product.id,
      combo_id: null,
      product_name: product.name,
      product_image_url: product.image_url,
      base_price: Number(product.base_price),
      options: chosen,
      options_price: optionsPrice,
      unit_price: unitPrice,
      quantity: line.quantity,
      line_total: unitPrice * line.quantity,
      item_note: line.item_note ?? null,
      combo_items_snapshot: [],
    });
  }

  return { items };
}
