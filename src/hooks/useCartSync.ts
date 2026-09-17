import { useMemo } from "react";
import { useAsync } from "@/hooks/useAsync";
import { fetchCartSync, type CartSyncSnapshot } from "@/lib/queries";
import { discountedPrice } from "@/lib/format";
import type { CartItem } from "@/store/cart";

/** Vấn đề của một dòng giỏ hàng khi đối chiếu lại với dữ liệu hiện tại. */
export type LineIssue =
  | { kind: "removed" }
  | { kind: "sold_out" }
  | { kind: "option_gone"; names: string[] }
  | { kind: "price_changed"; unitBase: number; optionsPrice: number; unitPrice: number };

export type LineCheck = { issue: LineIssue | null; blocking: boolean };

/**
 * Đối chiếu giỏ hàng (localStorage) với dữ liệu thật.
 *
 * Không tự ý sửa giỏ — chỉ báo cáo. Việc xoá món hay cập nhật giá do khách bấm,
 * để họ không bị đổi đơn sau lưng.
 */
export function useCartSync(items: CartItem[]) {
  const productIds = useMemo(
    () => [...new Set(items.map((i) => i.productId))].sort(),
    [items],
  );
  const optionIds = useMemo(
    () => [...new Set(items.flatMap((i) => i.options.map((o) => o.optionId)))].sort(),
    [items],
  );

  const key = `${productIds.join(",")}|${optionIds.join(",")}`;

  const fn = useMemo(
    () => () => fetchCartSync(productIds, optionIds),
    // key gói cả hai mảng thành chuỗi để không tạo hàm mới mỗi lần render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const state = useAsync<CartSyncSnapshot>(fn, [key]);

  const checks = useMemo(() => {
    const result: Record<string, LineCheck> = {};
    if (!state.data) return result;

    for (const item of items) {
      result[item.lineId] = checkLine(item, state.data);
    }
    return result;
  }, [items, state.data]);

  const hasBlocking = Object.values(checks).some((c) => c.blocking);

  return { ...state, checks, hasBlocking };
}

function checkLine(item: CartItem, snapshot: CartSyncSnapshot): LineCheck {
  const product = snapshot.products[item.productId];

  if (!product) return { issue: { kind: "removed" }, blocking: true };
  if (!product.is_available) return { issue: { kind: "sold_out" }, blocking: true };

  const goneOptions = item.options.filter((o) => {
    const fresh = snapshot.options[o.optionId];
    return !fresh || !fresh.is_available;
  });

  if (goneOptions.length > 0) {
    return {
      issue: { kind: "option_gone", names: goneOptions.map((o) => o.optionName) },
      blocking: true,
    };
  }

  const unitBase = discountedPrice(product.base_price, product.discount_percent);
  const optionsPrice = item.options.reduce(
    (sum, o) => sum + Number(snapshot.options[o.optionId]!.price_delta),
    0,
  );
  const unitPrice = Math.max(0, unitBase + optionsPrice);

  if (unitPrice !== item.unitPrice) {
    return {
      issue: { kind: "price_changed", unitBase, optionsPrice, unitPrice },
      // Đổi giá không chặn đặt hàng — Edge Function dùng giá mới, khách chỉ cần biết.
      blocking: false,
    };
  }

  return { issue: null, blocking: false };
}
