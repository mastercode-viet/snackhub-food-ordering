import { supabase } from "@/lib/supabase";
import { normalizeSearch } from "@/lib/text";
import type { Tables } from "@/types/database";

/**
 * Toàn bộ truy vấn đọc menu công khai. Khách dùng anon key, RLS quyết định
 * thấy được gì — ở đây không có bước lọc quyền nào ở phía client.
 */

/** Sản phẩm kèm icon danh mục, dùng làm ảnh dự phòng khi món chưa có ảnh. */
export type ProductWithCategory = Tables<"products"> & {
  categories: { icon: string | null; name: string; slug: string } | null;
};

export async function fetchCategories(): Promise<Tables<"categories">[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) throw error;
  return data;
}

export async function fetchStoreSettings(): Promise<Tables<"store_settings">> {
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();

  if (error) throw error;
  return data;
}

/** Nguồn sự thật về giờ hoạt động — cùng một hàm mà Edge Function gọi. */
export async function fetchStoreOpen(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_store_open");
  if (error) throw error;
  return data === true;
}

// ── Đơn hàng của khách ──────────────────────────────────────────────────────
//
// Khách KHÔNG đọc trực tiếp bảng `orders` — RLS chỉ mở cho admin. Mọi truy cập
// đi qua RPC security-definer, tra theo mã đơn ngẫu nhiên.
//
// Hệ quả: khách cũng KHÔNG nhận được realtime (Supabase Realtime tôn trọng RLS),
// nên màn theo dõi phải poll lại RPC. Không được thêm policy anon cho `orders`
// chỉ để có realtime — làm vậy là mở toàn bộ đơn của mọi người.

export type OrderOptionView = {
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_delta: number;
};

/** Một món con nằm trong combo, snapshot tại thời điểm đặt. */
export type ComboItemSnapshot = {
  product_id: string;
  product_name: string;
  quantity: number;
};

export type OrderItemView = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image_url: string | null;
  options: OrderOptionView[];
  // combo_id CHỈ để biết dòng này có phải combo hay không — hiển thị luôn
  // dựa vào product_name/product_image_url (đã snapshot) + combo_items_snapshot,
  // không JOIN sống lại bảng combos.
  combo_id: string | null;
  combo_items_snapshot: ComboItemSnapshot[];
  unit_price: number;
  quantity: number;
  line_total: number;
  item_note: string | null;
};

export type OrderView = {
  id: string;
  order_code: string;
  status: Tables<"orders">["status"];
  payment_method: Tables<"orders">["payment_method"];
  payment_status: Tables<"orders">["payment_status"];
  customer_name: string;
  customer_phone: string;
  building: string;
  floor: string | null;
  room: string | null;
  class_name: string | null;
  delivery_note: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  discount_code: string | null;
  payos_checkout_url: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  completed_at: string | null;
  created_at: string;
  can_cancel: boolean;
  items: OrderItemView[];
};

export class OrderNotFoundError extends Error {
  constructor() {
    super("ORDER_NOT_FOUND");
    this.name = "OrderNotFoundError";
  }
}

export async function fetchOrderByCode(code: string): Promise<OrderView> {
  const { data, error } = await supabase.rpc("get_order_by_code", {
    p_order_code: code.trim().toUpperCase(),
  });

  // P0002 do chính hàm raise khi không tìm thấy mã
  if (error) {
    if (error.code === "P0002") throw new OrderNotFoundError();
    throw error;
  }
  return data as unknown as OrderView;
}

/** Chỉ thành công khi đơn còn ở trạng thái "Chờ xác nhận" — DB quyết định. */
export async function cancelOrderByCode(code: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_order_by_code", {
    p_order_code: code.trim().toUpperCase(),
    p_reason: reason ?? undefined,
  });
  if (error) throw error;
}

/** Dùng cho "Mua lại đơn": lấy dữ liệu HIỆN TẠI của các món trong đơn cũ. */
export async function fetchProductsByIds(ids: string[]): Promise<ProductWithCategory[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(icon, name, slug)")
    .in("id", ids);

  if (error) throw error;
  return data as ProductWithCategory[];
}

/**
 * Gợi ý thêm món cho giỏ hàng.
 *
 * Bản Stitch gọi mục này là "hay mua cùng". Project KHÔNG có dữ liệu nào về
 * việc mua kèm (không có bảng liên kết món, và `order_items` cũng chưa đủ đơn
 * để rút ra thống kê), nên ở đây gợi ý theo **cùng danh mục với món đang có
 * trong giỏ** — dữ liệu thật, và mục được đặt tên đúng bản chất là "Gợi ý
 * thêm món", không hứa điều mình không đo được.
 */
export async function fetchSuggestions(
  categoryIds: string[],
  excludeProductIds: string[],
  limit = 8,
): Promise<ProductWithCategory[]> {
  let query = supabase
    .from("products")
    .select("*, categories(icon, name, slug)")
    .eq("is_available", true);

  if (categoryIds.length > 0) query = query.in("category_id", categoryIds);
  if (excludeProductIds.length > 0) {
    query = query.not("id", "in", `(${excludeProductIds.join(",")})`);
  }

  const { data, error } = await query
    .order("is_featured", { ascending: false })
    .order("sort_order")
    .limit(limit);

  if (error) throw error;
  return data as ProductWithCategory[];
}

/** Ảnh chụp hiện trạng của các món/lựa chọn/combo đang nằm trong giỏ. */
export type CartSyncSnapshot = {
  products: Record<
    string,
    Pick<Tables<"products">, "id" | "name" | "base_price" | "discount_percent" | "is_available">
  >;
  options: Record<string, Pick<Tables<"product_options">, "id" | "name" | "price_delta" | "is_available">>;
  combos: Record<string, Pick<Tables<"combos">, "id" | "name" | "price" | "is_available">>;
};

/**
 * Giỏ hàng sống trong localStorage nên có thể ôm dữ liệu từ nhiều ngày trước:
 * món/combo đã bị gỡ, đã hết hàng, hoặc đã đổi giá. Đọc lại hiện trạng để
 * cảnh báo khách TRƯỚC khi họ sang bước đặt hàng.
 */
export async function fetchCartSync(
  productIds: string[],
  optionIds: string[],
  comboIds: string[] = [],
): Promise<CartSyncSnapshot> {
  const snapshot: CartSyncSnapshot = { products: {}, options: {}, combos: {} };
  if (productIds.length === 0 && comboIds.length === 0) return snapshot;

  const [productRes, optionRes, comboRes] = await Promise.all([
    productIds.length > 0
      ? supabase
          .from("products")
          .select("id, name, base_price, discount_percent, is_available")
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    optionIds.length > 0
      ? supabase
          .from("product_options")
          .select("id, name, price_delta, is_available")
          .in("id", optionIds)
      : Promise.resolve({ data: [], error: null }),
    comboIds.length > 0
      ? supabase.from("combos").select("id, name, price, is_available").in("id", comboIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productRes.error) throw productRes.error;
  if (optionRes.error) throw optionRes.error;
  if (comboRes.error) throw comboRes.error;

  for (const p of productRes.data ?? []) snapshot.products[p.id] = p;
  for (const o of optionRes.data ?? []) snapshot.options[o.id] = o;
  for (const c of comboRes.data ?? []) snapshot.combos[c.id] = c;

  // Giỏ hàng trộn lẫn id của product_options và topping_items trong cùng một
  // mảng options. Id nào không phải option lẻ thì tra tiếp ở topping_items —
  // bỏ qua bước này là mọi dòng có topping đều bị báo "option_gone".
  const missingOptionIds = optionIds.filter((id) => !snapshot.options[id]);
  if (missingOptionIds.length > 0) {
    const { data, error } = await supabase
      .from("topping_items")
      .select("id, name, price_delta, is_available")
      .in("id", missingOptionIds);
    if (error) throw error;
    for (const t of data ?? []) snapshot.options[t.id] = t;
  }

  return snapshot;
}

/** Nhóm topping dùng chung, kèm các topping bên trong. */
export type ToppingGroupWithItems = Tables<"topping_groups"> & {
  topping_items: Tables<"topping_items">[];
};

/** Món kèm toàn bộ nhóm tùy chọn và các lựa chọn bên trong. */
export type ProductDetail = Tables<"products"> & {
  categories: { icon: string | null; name: string; slug: string } | null;
  product_option_groups: Array<
    Tables<"product_option_groups"> & { product_options: Tables<"product_options">[] }
  >;
  /** Đã phẳng hoá khỏi bảng nối và sắp theo sort_order của phần gán. */
  toppingGroups: ToppingGroupWithItems[];
};

type ProductDetailRow = Omit<ProductDetail, "toppingGroups"> & {
  product_topping_groups: Array<{ sort_order: number; topping_groups: ToppingGroupWithItems | null }>;
};

export async function fetchProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "*, categories(icon, name, slug), product_option_groups(*, product_options(*)), product_topping_groups(sort_order, topping_groups(*, topping_items(*)))",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ProductDetailRow;

  // PostgREST không sắp xếp được cấp lồng thứ hai — sắp ở client cho gọn.
  row.product_option_groups.sort((a, b) => a.sort_order - b.sort_order);
  for (const group of row.product_option_groups) {
    group.product_options.sort((a, b) => a.sort_order - b.sort_order);
  }

  const toppingGroups = row.product_topping_groups
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((link) => link.topping_groups)
    .filter((group): group is ToppingGroupWithItems => group !== null);

  for (const group of toppingGroups) {
    group.topping_items.sort((a, b) => a.sort_order - b.sort_order);
  }

  const { product_topping_groups: _link, ...rest } = row;
  return { ...rest, toppingGroups };
}

export async function fetchProducts(params: {
  categoryId?: string | null;
  search?: string;
} = {}): Promise<ProductWithCategory[]> {
  let query = supabase.from("products").select("*, categories(icon, name, slug)");

  if (params.categoryId) {
    query = query.eq("category_id", params.categoryId);
  }

  const term = normalizeSearch(params.search ?? "");
  if (term) {
    // search_text là cột generated đã lowercase + bỏ dấu, có index GIN trgm.
    // Từ khoá phải bỏ dấu y hệt thì mới khớp — xem src/lib/text.ts.
    query = query.ilike("search_text", `%${term}%`);
  }

  // Món hết hàng tạm thời dồn xuống cuối thay vì ẩn đi — khách vẫn thấy quán có bán.
  const { data, error } = await query
    .order("is_available", { ascending: false })
    .order("sort_order")
    .order("name");

  if (error) throw error;
  return data as ProductWithCategory[];
}

/** Chỉ những cột mà mua lại đơn cần — product_options và topping_items trùng nhau đúng bộ này. */
export type SelectedOption = Pick<
  Tables<"product_options">,
  "id" | "group_id" | "name" | "price_delta" | "is_available"
> & {
  /** Snapshot đơn cũ không ghi nguồn, nên suy ra từ bảng tra được id. */
  source?: "topping";
};

/**
 * Lấy trạng thái hiện tại của các lựa chọn — dùng khi mua lại đơn cũ.
 * Snapshot đơn cũ trộn lẫn id của product_options và topping_items, nên phải
 * tra cả hai; thiếu vế topping là mọi đơn có topping đều bị bỏ qua khi mua lại.
 */
export async function fetchOptionsByIds(ids: string[]): Promise<SelectedOption[]> {
  if (ids.length === 0) return [];

  const columns = "id, group_id, name, price_delta, is_available";
  const { data, error } = await supabase.from("product_options").select(columns).in("id", ids);
  if (error) throw error;

  const found = data ?? [];
  const missing = ids.filter((id) => !found.some((o) => o.id === id));
  if (missing.length === 0) return found;

  const { data: toppings, error: tErr } = await supabase
    .from("topping_items")
    .select(columns)
    .in("id", missing);
  if (tErr) throw tErr;

  return [...found, ...(toppings ?? []).map((t) => ({ ...t, source: "topping" as const }))];
}

// ── Combo (gộp món) ──────────────────────────────────────────────────────
//
// Quản lý qua Supabase Studio trực tiếp — app không có màn Admin (xem plan
// tại C:\Users\Admin\.claude\plans\redesign-to-n-b-giao-shimmying-tower.md).

/** Số combo tối đa hiển thị ở section "Ăn thả ga không lo về giá". */
const COMBO_LIST_LIMIT = 20;

/** Combo kèm danh sách món con — đủ để card hiển thị tóm tắt "Xôi · Trà sữa". */
export type ComboWithItems = Tables<"combos"> & {
  combo_items: Array<{ quantity: number; products: { id: string; name: string } | null }>;
};

/** Combo đang bật `is_featured` — dùng cho banner đầu trang chủ. */
export async function fetchFeaturedCombos(): Promise<ComboWithItems[]> {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(quantity, products(id, name))")
    .eq("is_available", true)
    .eq("is_featured", true)
    .order("sort_order");

  if (error) throw error;
  return data as ComboWithItems[];
}

/** Toàn bộ combo đang bán — dùng cho section "Ăn thả ga không lo về giá". */
export async function fetchCombos(): Promise<ComboWithItems[]> {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(quantity, products(id, name))")
    .eq("is_available", true)
    .order("sort_order")
    .limit(COMBO_LIST_LIMIT);

  if (error) throw error;
  return data as ComboWithItems[];
}

/** Dùng cho "Mua lại đơn": lấy hiện trạng HIỆN TẠI của các combo trong đơn cũ. */
export async function fetchCombosByIds(ids: string[]): Promise<Tables<"combos">[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("combos").select("*").in("id", ids);
  if (error) throw error;
  return data;
}
