import { create } from "zustand";
import { persist } from "zustand/middleware";
import { newId } from "@/lib/id";

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
  discountPercent: number;
  /** Giá món sau khi trừ % giảm, chưa cộng option */
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

/**
 * Dòng combo — giá cố định, KHÔNG có option tuỳ biến. `items` là danh sách
 * món con để CartLine hiển thị tóm tắt (không phải nguồn tính giá — giá luôn
 * là `unitPrice` do combo quy định).
 */
export type ComboCartItem = {
  lineId: string;
  kind: "combo";
  comboId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  items: ComboLineItem[];
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
  if (item.kind === "combo") return `combo:${item.comboId}|${note}`;
  const ids = item.options.map((o) => o.optionId).sort().join(",");
  return `product:${item.productId}|${ids}|${note}`;
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
      version: 3,
      // v1 chưa lưu categoryId; v2 chưa có "kind" (chưa có combo, mọi dòng
      // đều là sản phẩm) — giỏ cũ trong localStorage vẫn phải dùng được.
      // Dữ liệu cũ trong localStorage chưa chắc khớp CartItem hiện tại (đó
      // chính là lý do cần migrate) — xử lý ở dạng lỏng, chỉ ép kiểu CartState
      // ở bước trả về cuối cùng. Ép kiểu ngay từ đầu (như bản trước) khiến
      // TypeScript tưởng nhầm input đã có "kind", vỡ type union mới.
      migrate: (persisted, version) => {
        let items = ((persisted as { items?: unknown[] })?.items ?? []) as Record<string, unknown>[];
        if (version < 2) {
          items = items.map((i) => ({ ...i, categoryId: i.categoryId ?? null }));
        }
        if (version < 3) {
          items = items.map((i) => ("kind" in i ? i : { ...i, kind: "product" }));
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
