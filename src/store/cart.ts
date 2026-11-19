import { create } from "zustand";
import { persist } from "zustand/middleware";
import { newId } from "@/lib/id";
import type { ComboWithItems } from "@/lib/queries";

/**
 * Giỏ hàng nằm hoàn toàn ở phía client (Zustand + middleware `persist`).
 * Backend KHÔNG có bảng cart — đúng như thiết kế hiện tại, khách không cần
 * đăng nhập nên không có chỗ nào để gắn giỏ hàng vào.
 *
 * QUAN TRỌNG: mọi con số giá ở đây chỉ để HIỂN THỊ. Khi đặt hàng, Edge
 * Function `create-order` chỉ nhận product_id + option_ids + quantity rồi tự
 * tra lại giá từ DB. Giỏ hàng bị sửa trong localStorage cũng không đổi được
 * số tiền phải trả.
 */

export type CartOption = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
  quantity: number;
  source?: "topping";
};

/** Dòng sản phẩm lẻ, có thể có option tuỳ biến — hành vi y hệt từ trước. */
export type ProductCartItem = {
  lineId: string;
  kind: "product";
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  categoryId: string | null;
  categoryIcon: string | null;
  basePrice: number;
  /** Giá món sau khi trừ giảm giá, chưa cộng option */
  unitBase: number;
  options: CartOption[];
  optionsPrice: number;
  /** unitBase + optionsPrice */
  unitPrice: number;
  quantity: number;
  note: string | null;
};

/** Một món con nằm trong combo — chỉ để hiển thị tóm tắt, không có giá riêng. */
export type ComboLineItem = {
  productId: string;
  name: string;
  quantity: number;
};

/** Lựa chọn tuỳ biến cho một thành phần trong combo (tái dùng CartOption). */
export type ComboComponentSelection = {
  productId: string;
  productName: string;
  componentQuantity: number;
  options: CartOption[];
  optionsPrice: number;
};

/**
 * Dòng combo — giá cơ bản cố định, CÓ THỂ có phụ phí option từ các thành
 * phần. `components` lưu lựa chọn riêng cho từng thành phần.
 */
/** Lựa chọn trong nhóm lựa chọn của combo. */
export type ComboChoiceSelection = {
  groupId: string;
  groupName: string;
  productId: string;
  productName: string;
  componentQuantity: number;
  options: CartOption[];
  optionsPrice: number;
};

export type ComboCartItem = {
  lineId: string;
  kind: "combo";
  comboId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  unitPrice: number;
  items: ComboLineItem[];
  components: ComboComponentSelection[];
  choices: ComboChoiceSelection[];
  quantity: number;
  note: string | null;
};

export type CartItem = ProductCartItem | ComboCartItem;
export type NewCartItem = Omit<ProductCartItem, "lineId"> | Omit<ComboCartItem, "lineId">;

/**
 * Hai dòng gộp được với nhau khi: cùng loại (product/combo) VÀ cùng món/combo
 * VÀ (với sản phẩm) cùng bộ option VÀ cùng ghi chú. Combo không có option nên
 * chỉ so theo comboId + ghi chú.
 */
function identityOf(item: NewCartItem): string {
  const note = item.note?.trim() ?? "";
  if (item.kind === "combo") {
    // Topping trong combo có số lượng: khác số lượng phải là dòng riêng.
    const optKey = (o: CartOption) => `${o.optionId}:${o.quantity ?? 1}`;
    const compKey = item.components
      .map((c) => `${c.productId}:${c.options.map(optKey).sort().join(",")}`)
      .join("|");
    const choiceKey = item.choices
      .map((c) => `${c.groupId}:${c.productId}:${c.options.map(optKey).sort().join(",")}`)
      .join("|");
    return `combo:${item.comboId}|${compKey}|${choiceKey}|${note}`;
  }
  // Cùng món nhưng bộ chọn khác (kể cả số lượng topping) phải là dòng riêng.
  const ids = item.options
    .map((o) => `${o.optionId}:${o.quantity ?? 1}`)
    .sort()
    .join(",");
  return `product:${item.productId}|${ids}|${note}`;
}

/**
 * Dựng dòng giỏ hàng combo từ dữ liệu hiển thị (ComboCard).
 * Combo không có option nên không cần bước "chọn" như ProductDetailPage —
 * bấm "Thêm vào giỏ" là gọi thẳng hàm này rồi addItem().
 */
export function comboToCartItem(
  combo: Pick<ComboWithItems, "id" | "slug" | "name" | "image_url" | "price" | "combo_items">,
  quantity = 1,
  components: ComboComponentSelection[] = [],
  choices: ComboChoiceSelection[] = [],
): Omit<ComboCartItem, "lineId"> {
  const items = combo.combo_items.map((i) => ({
    productId: i.products?.id ?? "",
    name: i.products?.name ?? "",
    quantity: i.quantity,
  }));
  const optionsPrice = components.reduce((s, c) => s + c.optionsPrice, 0) + choices.reduce((s, c) => s + c.optionsPrice, 0);
  return {
    kind: "combo",
    comboId: combo.id,
    slug: combo.slug,
    name: combo.name,
    imageUrl: combo.image_url,
    basePrice: Number(combo.price),
    unitPrice: Number(combo.price) + optionsPrice,
    items,
    components,
    choices,
    quantity,
    note: null,
  };
}

type CartState = {
  items: CartItem[];
  addItem: (item: NewCartItem) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  // Chỉ dùng để cập nhật giá sản phẩm sau khi useCartSync phát hiện đổi giá
  // (xem CartPage.tsx) — combo có giá cố định, không có "issue" dạng này.
  updateItem: (lineId: string, patch: Partial<ProductCartItem>) => void;
  removeItem: (lineId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (incoming) =>
        set((state) => {
          const key = identityOf(incoming);
          const existing = state.items.find((i) => identityOf(i) === key);

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === existing.lineId
                  ? { ...i, quantity: Math.min(99, i.quantity + incoming.quantity) }
                  : i,
              ),
            };
          }

          return { items: [...state.items, { ...incoming, lineId: newId() }] };
        }),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.lineId !== lineId)
              : state.items.map((i) =>
                  i.lineId === lineId ? { ...i, quantity: Math.min(99, quantity) } : i,
                ),
        })),

      updateItem: (lineId, patch) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.lineId === lineId && i.kind === "product" ? { ...i, ...patch } : i,
          ),
        })),

      removeItem: (lineId) =>
        set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "snackhub-cart",
      version: 5,
      // v1 chưa lưu categoryId; v2 chưa có "kind"; v3 combo chưa có basePrice/components.
      migrate: (persisted, version) => {
        let items = ((persisted as { items?: unknown[] })?.items ?? []) as Record<string, unknown>[];
        if (version < 2) {
          items = items.map((i) => ({ ...i, categoryId: i.categoryId ?? null }));
        }
        if (version < 3) {
          items = items.map((i) => ("kind" in i ? i : { ...i, kind: "product" }));
        }
        if (version < 4) {
          items = items.map((i) =>
            i.kind === "combo"
              ? {
                  ...i,
                  basePrice: (i as Record<string, unknown>).basePrice ?? (i as Record<string, unknown>).unitPrice ?? 0,
                  components: (i as Record<string, unknown>).components ?? [],
                  items: (i as Record<string, unknown>).items ?? [],
                }
              : i,
          );
        }
        if (version < 5) {
          items = items.map((i) =>
            i.kind === "combo"
              ? {
                  ...i,
                  choices: (i as Record<string, unknown>).choices ?? [],
                }
              : i,
          );
        }
        return { items } as CartState;
      },
    },
  ),
);

/** Tổng số món — dùng cho badge ở Bottom Navigation. */
export function useCartCount(): number {
  return useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
}

/** Tạm tính, chỉ để hiển thị. Số tiền thật do Edge Function tính lại. */
export function useCartSubtotal(): number {
  return useCartStore((s) => s.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
}
