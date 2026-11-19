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

       // Kiểm tra các lựa chọn tuỳ biến (nếu có) còn tồn tại và còn bán.
      const chosenOptionsByProduct = new Map<string, typeof line.options>();
      for (const o of line.options) {
        const pid = o.product_id;
        if (!pid) continue;
        const list = chosenOptionsByProduct.get(pid) ?? [];
        list.push(o);
        chosenOptionsByProduct.set(pid, list);
      }

      let invalid = false;
      const fixedSnapshots = line.combo_items_snapshot.filter((ci) => !ci.is_choice);
      const choiceSnapshots = line.combo_items_snapshot.filter((ci) => ci.is_choice);

      const components = fixedSnapshots.map((ci) => {
        const opts = chosenOptionsByProduct.get(ci.product_id) ?? [];
        const chosen = opts.map((o) => optionById.get(o.option_id));
        if (chosen.some((o) => !o || !o.is_available)) {
          invalid = true;
        }
        const cartOptions = chosen
          .filter((o): o is NonNullable<typeof o> => Boolean(o))
          .map((o) => ({
            groupId: o.group_id,
            groupName: line.options.find((x) => x.option_id === o.id)?.group_name ?? "",
            optionId: o.id,
            optionName: o.name,
            priceDelta: Number(o.price_delta),
            // Giữ đúng số lượng topping của đơn cũ, không ép về 1.
            quantity: Math.max(1, Number(line.options.find((x) => x.option_id === o.id)?.quantity ?? 1)),
            source: o.source,
          }));
        const optionsPrice = cartOptions.reduce((s, o) => s + o.priceDelta, 0) * ci.quantity;
        return {
          productId: ci.product_id,
          productName: ci.product_name,
          componentQuantity: ci.quantity,
          options: cartOptions,
          optionsPrice,
        };
      });

      const choices = choiceSnapshots
        .filter((ci) => Boolean(ci.group_id))
        .map((ci) => {
          const opts = chosenOptionsByProduct.get(ci.product_id) ?? [];
          const chosen = opts.map((o) => optionById.get(o.option_id));
          if (chosen.some((o) => !o || !o.is_available)) {
            invalid = true;
          }
          const cartOptions = chosen
            .filter((o): o is NonNullable<typeof o> => Boolean(o))
            .map((o) => ({
              groupId: o.group_id,
              groupName: line.options.find((x) => x.option_id === o.id)?.group_name ?? "",
              optionId: o.id,
              optionName: o.name,
              priceDelta: Number(o.price_delta),
              quantity: 1,
              source: o.source,
            }));
          const groupItemQuantity = ci.quantity ?? 1;
          const optionsPrice = cartOptions.reduce((s, o) => s + o.priceDelta, 0) * groupItemQuantity;
          return {
            groupId: ci.group_id as string,
            groupName: ci.group_name ?? "",
            productId: ci.product_id,
            productName: ci.product_name,
            componentQuantity: groupItemQuantity,
            options: cartOptions,
            optionsPrice,
          };
        });

      if (invalid) {
        skipped.push(line.product_name);
        continue;
      }

      const optionsPriceTotal =
        components.reduce((s, c) => s + c.optionsPrice, 0) +
        choices.reduce((s, c) => s + c.optionsPrice, 0);

      items.push({
        kind: "combo",
        comboId: combo.id,
        slug: combo.slug,
        name: combo.name,
        imageUrl: combo.image_url,
        basePrice: Number(combo.price),
        unitPrice: Number(combo.price) + optionsPriceTotal,
        items: line.combo_items_snapshot.map((i) => ({
          productId: i.product_id,
          name: i.product_name,
          quantity: i.quantity,
        })),
        components,
        choices,
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

    const cartOptions = chosen.map((o) => ({
      groupId: o!.group_id,
      groupName: line.options.find((x) => x.option_id === o!.id)?.group_name ?? "",
      optionId: o!.id,
      optionName: o!.name,
      priceDelta: Number(o!.price_delta),
      // Giữ đúng số lượng topping của đơn cũ, không ép về 1.
      quantity: Math.max(1, Number(line.options.find((x) => x.option_id === o!.id)?.quantity ?? 1)),
      source: o!.source,
    }));
    // Giá: biến thể/kích cỡ (price_mode "replace") thay giá gốc; topping và
    // option thường cộng thêm theo số lượng — cùng công thức với create-order.
    let replaceBase: number | null = null;
    let optionsPrice = 0;
    for (const option of chosen) {
      if (!option) continue;
      if (option.price_mode === "replace") {
        const price = Number(option.price_delta);
        replaceBase = replaceBase === null ? price : Math.max(replaceBase, price);
        continue;
      }
      const quantity = Math.max(
        1,
        Number(line.options.find((x) => x.option_id === option.id)?.quantity ?? 1),
      );
      optionsPrice += Number(option.price_delta) * quantity;
    }
    const unitBase =
      replaceBase === null
        ? discountedPrice(product.base_price, product.discount_type, product.discount_value)
        : Math.max(0, replaceBase);

    items.push({
      kind: "product",
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image_url,
      categoryId: product.category_id,
      categoryIcon: product.categories?.icon ?? null,
      basePrice: product.base_price,
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
