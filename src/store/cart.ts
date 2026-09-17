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

export type CartItem = {
  lineId: string;
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

export type NewCartItem = Omit<CartItem, "lineId">;

/** Hai dòng gộp được với nhau khi cùng món, cùng bộ option và cùng ghi chú. */
function identityOf(item: NewCartItem): string {
  const ids = item.options.map((o) => o.optionId).sort().join(",");
  return `${item.productId}|${ids}|${item.note?.trim() ?? ""}`;
}

type CartState = {
  items: CartItem[];
  addItem: (item: NewCartItem) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  updateItem: (lineId: string, patch: Partial<CartItem>) => void;
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
          items: state.items.map((i) => (i.lineId === lineId ? { ...i, ...patch } : i)),
        })),

      removeItem: (lineId) =>
        set((state) => ({ items: state.items.filter((i) => i.lineId !== lineId) })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "snackhub-cart",
      version: 2,
      // v1 chưa lưu categoryId; giỏ cũ trong localStorage vẫn phải dùng được.
      migrate: (state, version) => {
        const s = state as CartState;
        if (version < 2) {
          s.items = (s.items ?? []).map((i) => ({ ...i, categoryId: i.categoryId ?? null }));
        }
        return s;
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
