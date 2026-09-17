import { fetchOptionsByIds, fetchProductsByIds, type OrderItemView } from "@/lib/queries";
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
  const productIds = [
    ...new Set(orderItems.map((i) => i.product_id).filter((id): id is string => Boolean(id))),
  ];
  const optionIds = [
    ...new Set(orderItems.flatMap((i) => i.options.map((o) => o.option_id))),
  ];

  const [products, options] = await Promise.all([
    fetchProductsByIds(productIds),
    fetchOptionsByIds(optionIds),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const optionById = new Map(options.map((o) => [o.id, o]));

  const items: NewCartItem[] = [];
  const skipped: string[] = [];

  for (const line of orderItems) {
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
