import {
  fetchCombosByIds,
  fetchOptionsByIds,
  fetchProductsByIds,
  type OrderItemView,
} from "@/lib/queries";
import { discountedPrice } from "@/lib/format";
import type { NewCartItem } from "@/store/cart";

export type ReorderResult = {
  items: NewCartItem[];
  /** Tên các món không thêm lại được (đã gỡ khỏi menu hoặc đang hết hàng). */
  skipped: string[];
};

/**
 * Dựng lại giỏ hàng từ một đơn cũ.
 *
 * Đơn cũ lưu snapshot tên/giá tại thời điểm đặt, nhưng mua lại thì phải dùng
 * GIÁ HIỆN TẠI — nên ở đây chỉ lấy từ snapshot phần "khách đã chọn gì"
 * (product_id + option_id), còn tên và giá đều tra lại từ DB.
 *
 * Món đã bị gỡ, đang hết hàng, hoặc có lựa chọn không còn thì bỏ qua và báo
 * lại cho khách, thay vì thêm vào giỏ rồi để họ bị chặn ở bước đặt hàng.
 */
export async function buildReorder(orderItems: OrderItemView[]): Promise<ReorderResult> {
  const productLines = orderItems.filter((i) => !i.combo_id);
  const comboLines = orderItems.filter((i) => i.combo_id);

  const productIds = [
    ...new Set(productLines.map((i) => i.product_id).filter((id): id is string => Boolean(id))),
  ];
  const optionIds = [
    ...new Set(productLines.flatMap((i) => i.options.map((o) => o.option_id))),
  ];
  const comboIds = [...new Set(comboLines.map((i) => i.combo_id!))];

  const [products, options, combos] = await Promise.all([
    fetchProductsByIds(productIds),
    fetchOptionsByIds(optionIds),
    fetchCombosByIds(comboIds),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const optionById = new Map(options.map((o) => [o.id, o]));
  const comboById = new Map(combos.map((c) => [c.id, c]));

  const items: NewCartItem[] = [];
  const skipped: string[] = [];

  for (const line of orderItems) {
    // ── Combo: chỉ kiểm is_available của chính combo, y hệt mức độ kiểm tra
    // của sản phẩm lẻ (không xét sâu từng món con — đó là việc của
    // create-order lúc đặt hàng thật). ──────────────────────────────────
    if (line.combo_id) {
      const combo = comboById.get(line.combo_id);
      if (!combo || !combo.is_available) {
        skipped.push(line.product_name);
        continue;
      }

      items.push({
        kind: "combo",
        comboId: combo.id,
        slug: combo.slug,
        name: combo.name,
        imageUrl: combo.image_url,
        unitPrice: Number(combo.price),
        // Tên món con lấy từ SNAPSHOT cũ (đủ dùng để hiển thị tóm tắt trong
        // giỏ), không tra lại DB — khác với sản phẩm/option vì combo không
        // có gì để "đổi giá theo lựa chọn", chỉ có is_available là đáng kiểm.
        items: line.combo_items_snapshot.map((i) => ({
          productId: i.product_id,
          name: i.product_name,
          quantity: i.quantity,
        })),
        quantity: line.quantity,
        note: line.item_note,
      });
      continue;
    }

    const product = line.product_id ? productById.get(line.product_id) : undefined;

    if (!product || !product.is_available) {
      skipped.push(line.product_name);
      continue;
    }

    const chosen = line.options.map((o) => optionById.get(o.option_id));
    if (chosen.some((o) => !o || !o.is_available)) {
      skipped.push(line.product_name);
      continue;
    }

    const unitBase = discountedPrice(product.base_price, product.discount_percent);
    const cartOptions = chosen.map((o) => ({
      groupId: o!.group_id,
      groupName: line.options.find((x) => x.option_id === o!.id)?.group_name ?? "",
      optionId: o!.id,
      optionName: o!.name,
      priceDelta: Number(o!.price_delta),
    }));
    const optionsPrice = cartOptions.reduce((s, o) => s + o.priceDelta, 0);

    items.push({
      kind: "product",
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image_url,
      categoryId: product.category_id,
      categoryIcon: product.categories?.icon ?? null,
      basePrice: product.base_price,
      discountPercent: product.discount_percent,
      unitBase,
      options: cartOptions,
      optionsPrice,
      unitPrice: Math.max(0, unitBase + optionsPrice),
      quantity: line.quantity,
      note: line.item_note,
    });
  }

  return { items, skipped };
}
