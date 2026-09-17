import type { OptionGroupData } from "@/components/product/OptionGroup";
import type { ProductDetail } from "@/lib/queries";
import type { CartOption } from "@/store/cart";

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
  const toppings: OptionGroupData[] = product.toppingGroups
    .filter((g) => g.topping_items.length > 0)
    .map((g) => ({
      id: g.id,
      product_id: product.id,
      name: g.name,
      is_required: false,
      min_select: 0,
      max_select: g.topping_items.length,
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
): CartOption[] {
  const result: CartOption[] = [];
  for (const group of groups) {
    for (const id of selected[group.id] ?? []) {
      const opt = group.product_options.find((o) => o.id === id);
      if (opt) {
        result.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          priceDelta: Number(opt.price_delta),
          source: group.source,
        });
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
