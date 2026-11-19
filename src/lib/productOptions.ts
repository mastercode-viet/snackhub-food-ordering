import type { OptionGroupData } from "@/components/product/OptionGroup";
import type { ProductDetail } from "@/lib/queries";
import type { CartOption } from "@/store/cart";
import { discountedPrice } from "@/lib/format";

/**
 * Nhóm topping dùng chung được nắn về đúng hình dạng của nhóm option lẻ rồi
 * ghép chung một danh sách. Nhờ vậy mọi chỗ chọn món (trang chi tiết lẫn
 * bottom sheet) không phải biết có hai loại — với cart và Edge Function thì
 * topping cũng chỉ là một option id.
 *
 * Topping luôn tuỳ chọn: is_required = false, min_select = 0. Nhóm rỗng bị
 * loại vì max_select phải >= 1 mới có nghĩa.
 */
export function toOptionGroups(product: ProductDetail): OptionGroupData[] {
  const toppings = product.toppingGroups
    .filter((g) => g.topping_items.length > 0)
    .map((g) => ({
      id: g.id,
      product_id: product.id,
      name: g.name,
      is_required: false,
      min_select: 0,
      max_select: g.topping_items.length,
      quantity_enabled: false,
      price_mode: "delta",
      source: "topping",
      sort_order: g.sort_order,
      created_at: g.created_at,
      product_options: g.topping_items.map((t) => ({
        id: t.id,
        group_id: g.id,
        name: t.name,
        price_delta: t.price_delta,
        is_available: t.is_available,
        sort_order: t.sort_order,
        created_at: t.created_at,
        max_quantity: t.max_quantity > 1 ? t.max_quantity : 99,
        default_quantity: t.default_quantity ?? 0,
      })),
    }));

  return [...product.product_option_groups, ...toppings];
}

/** Nhóm bắt buộc chọn đúng 1 thì tick sẵn lựa chọn còn hàng đầu tiên. */
export function initialSelections(groups: OptionGroupData[]): Record<string, string[]> {
  const initial: Record<string, string[]> = {};
  for (const group of groups) {
    if (group.is_required && group.max_select === 1) {
      const first = group.product_options.find((o) => o.is_available);
      if (first) initial[group.id] = [first.id];
    }
  }
  return initial;
}

export function chosenOptions(
  groups: OptionGroupData[],
  selected: Record<string, string[]>,
  quantities?: Record<string, number>,
): CartOption[] {
  const result: CartOption[] = [];
  for (const group of groups) {
    if (group.source === "topping") {
      for (const opt of group.product_options) {
        const qty = quantities?.[opt.id] ?? 0;
        if (qty > 0) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: Number(opt.price_delta),
            quantity: qty,
            source: group.source,
          });
        }
      }
    } else {
      for (const id of selected[group.id] ?? []) {
        const opt = group.product_options.find((o) => o.id === id);
        if (opt) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: Number(opt.price_delta),
            quantity: group.quantity_enabled
              ? Math.max(0, Number(quantities?.[opt.id] ?? 1))
              : 1,
            source: group.source,
          });
        }
      }
    }
  }
  return result;
}

/** Nhóm bắt buộc mà khách chưa chọn đủ — chặn thêm vào giỏ. */
export function missingRequired(
  groups: OptionGroupData[],
  selected: Record<string, string[]>,
): OptionGroupData[] {
  return groups.filter(
    (g) => g.is_required && (selected[g.id]?.length ?? 0) < Math.max(1, g.min_select),
  );
}

/**
 * Tính giá một dòng sản phẩm LẺ theo quy tắc đơn nhất và quyền thẩm định của
 * server — dùng chung cho trang chi tiết, nhanh thêm (Quick Add) và mọi nơi
 * khách chọn tuỳ chọn, để không tính giá hai lần ở hai thành phần.
 *
 * Quy tắc giá:
 * - Nhóm price_mode = "replace" (SET_BASE_PRICE, ví dụ biến thể/kích thước):
 *   lựa chọn được chọn thay thế toàn bộ giá cơ bản của món.
 * - Nhóm price_mode = "delta" (PRICE_DELTA): mỗi lựa chọn cộng vào
 *   price_delta × số lượng (topping số lượng, biến thể phụ phí…).
 * - Không bao giờ tin giá gửi từ client.
 *
 * Trả về `chosen` kèm số lượng của mỗi option — dùng trực tiếp làm payload
 * giỏ hàng và snapshot đơn hàng.
 */
export interface ProductPriceBreakdown {
  /** Giá cơ bản dùng để tính dòng (sau khi có biến thể thay thế giá). */
  unitBase: number;
  /** Tổng phụ phí các lựa chọn kiểu delta (đã nhân số lượng). */
  optionsPrice: number;
  /** Đơn giá của 1 phần đã chọn. */
  unitPrice: number;
  /** Các option đã chọn kèm số lượng, đúng hình dạng đưa vào giỏ hàng. */
  chosen: CartOption[];
}

export function computeProductPrice({
  product,
  groups,
  selected,
  quantities = {},
}: {
  // Explicitly allow null — caller must guard before calling.
  product:
    | {
        base_price: number;
        discount_type: "percent" | "fixed";
        discount_value: number;
      }
    | null;
  groups: OptionGroupData[];
  selected: Record<string, string[]>;
  quantities?: Record<string, number>;
}): ProductPriceBreakdown {
  // Ưu tiên xử lý lúc product hợp lệ — crash với lỗi rõ ràng hơn là đành null làm rối UI.
  if (!product) {
    throw new Error(
      "computeProductPrice: product is null — caller must guarantee product is mounted before calling.",
    );
  }
  const { base_price, discount_type, discount_value } = product;
  let unitBase = discountedPrice(base_price, discount_type, discount_value);
  const chosen: CartOption[] = [];
  let optionsPrice = 0;
  // Giá gốc mới khi có nhóm thay giá (biến thể/kích cỡ). Nhiều nhóm cùng lúc
  // thì lấy mức cao nhất — y hệt create-order để client/server không lệch giá.
  let replaceBase: number | null = null;

  for (const group of groups) {
    // ── Topping (nhóm dùng chung): số lượng tự chọn, giá là delta × qty ────
    if (group.source === "topping") {
      for (const opt of group.product_options) {
        const qty = Math.max(0, Number(quantities[opt.id] ?? 0));
        if (qty === 0) continue;
        const delta = Number(opt.price_delta);
        chosen.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: delta,
          quantity: qty,
          source: group.source,
        });
        optionsPrice += delta * qty;
      }
      continue;
    }

    // ── Nhóm option của món (biến thể, kích thước, tuỳ chọn đơn lẻ…) ───────
    const ids = selected[group.id] ?? [];
    for (const id of ids) {
      const opt = group.product_options.find((o) => o.id === id);
      if (!opt) continue;
      const delta = Number(opt.price_delta);
      // Nhóm không bật số lượng (radio) luôn tính là 1 đơn vị.
      const qty = group.quantity_enabled
        ? Math.max(0, Number(quantities[opt.id] ?? 1))
        : 1;
      chosen.push({
        groupId: group.id,
        groupName: group.name,
        optionId: opt.id,
        optionName: opt.name,
        priceDelta: delta,
        quantity: qty,
      });
      if (group.price_mode === "replace") {
        // SET_BASE_PRICE: biến thể/kích thước được chọn làm giá cơ bản mới.
        replaceBase = replaceBase === null ? delta : Math.max(replaceBase, delta);
      } else {
        optionsPrice += delta * qty;
      }
    }
  }

  if (replaceBase !== null) unitBase = Math.max(0, replaceBase);
  const unitPrice = Math.max(0, unitBase + optionsPrice);
  return { unitBase, optionsPrice, unitPrice, chosen };
}
