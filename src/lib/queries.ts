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
  product_id?: string | null;
  product_name?: string;
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  price_delta: number;
  quantity?: number;
  /** Có từ đơn tạo bởi create-order mới. Đơn cũ không có → coi là cộng thêm. */
  price_mode?: "delta" | "replace";
  source?: "option" | "topping";
  /** Đơn giá × số lượng, do server chốt lúc đặt. */
  line_price?: number;
};

/** Một món con nằm trong combo, snapshot tại thời điểm đặt. */
export type ComboItemSnapshot = {
  product_id: string;
  product_name: string;
  quantity: number;
  is_choice?: boolean;
  group_name?: string | null;
  group_id?: string | null;
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
  /** null với đơn tại quầy. */
  customer_phone: string | null;
  /** null với đơn tại quầy. */
  building: string | null;
  delivery_method: Tables<"orders">["delivery_method"];
  floor: string | null;
  room: string | null;
  class_name: string | null;
  delivery_note: string | null;
  /** "Giờ muốn nhận" khách hẹn lúc đặt — null = giao sớm nhất có thể. */
  desired_delivery_time: string | null;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  discount_code: string | null;
  payos_checkout_url: string | null;
  payos_qr_code: string | null;
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

/** "2026-09-01".."2026-09-20" (yyyy-mm-dd) hoặc "all" — bộ lọc khoảng ngày cho lịch sử đơn của khách. */
export type OrderDateRange = "all" | { from: string; to: string };

/** true nếu mốc thời gian ISO rơi trong range (bao gồm cả ngày `to`, tới 23:59:59.999). */
export function isWithinOrderDateRange(whenIso: string, range: OrderDateRange): boolean {
  if (range === "all") return true;
  const t = new Date(whenIso).getTime();
  const fromMs = new Date(`${range.from}T00:00:00`).getTime();
  const toMs = new Date(`${range.to}T23:59:59.999`).getTime();
  return t >= fromMs && t <= toMs;
}

/**
 * Lọc đơn theo khoảng ngày (created_at) trên TẬP MÃ ĐƠN khách đã có quyền tra
 * (order_code) — KHÔNG có endpoint lọc theo customer_phone: RLS `orders`
 * không cấp SELECT cho anon, và số điện thoại không đủ "bí mật" để làm khoá
 * phân quyền xem đơn (khác order_code — gen_random_uuid(), chỉ người đặt
 * biết). gte/lte áp dụng phía client trên kết quả get_order_by_code của từng
 * mã đã được phép xem, không mở thêm quyền truy vấn hàng loạt theo SĐT.
 */
export async function fetchOrdersInRange(codes: string[], range: OrderDateRange): Promise<OrderView[]> {
  const results = await Promise.all(codes.map((code) => fetchOrderByCode(code).catch(() => null)));
  return results.filter((o): o is OrderView => o !== null && isWithinOrderDateRange(o.created_at, range));
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

/**
 * Một lựa chọn đang có trong giỏ, kèm cách nó cộng vào giá.
 *
 * `price_mode` của NHÓM là bắt buộc: biến thể/kích cỡ thay giá gốc còn topping
 * thì cộng thêm. Thiếu thông tin này thì client tính ra một con số khác hẳn
 * create-order và tự báo "đổi giá" sai.
 */
export type CartSyncOption = {
  id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  group_id: string;
  price_mode: "delta" | "replace";
  source?: "topping";
};

/** Ảnh chụp hiện trạng của các món/lựa chọn/combo đang nằm trong giỏ. */
export type CartSyncSnapshot = {
  products: Record<
    string,
    Pick<
      Tables<"products">,
      "id" | "name" | "base_price" | "discount_type" | "discount_value" | "is_available"
    >
  >;
  options: Record<string, CartSyncOption>;
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
          .select("id, name, base_price, discount_type, discount_value, is_available")
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    optionIds.length > 0
      ? supabase
          .from("product_options")
          .select("id, name, price_delta, is_available, group_id")
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
  for (const o of optionRes.data ?? []) {
    // price_mode thật được điền ở bước tra nhóm bên dưới.
    snapshot.options[o.id] = { ...o, price_mode: "delta" };
  }
  for (const c of comboRes.data ?? []) snapshot.combos[c.id] = c;

  // Giỏ hàng trộn lẫn id của product_options và topping_items trong cùng một
  // mảng options. Id nào không phải option lẻ thì tra tiếp ở topping_items —
  // bỏ qua bước này là mọi dòng có topping đều bị báo "option_gone".
  const missingOptionIds = optionIds.filter((id) => !snapshot.options[id]);
  if (missingOptionIds.length > 0) {
    const { data, error } = await supabase
      .from("topping_items")
      .select("id, name, price_delta, is_available, group_id")
      .in("id", missingOptionIds);
    if (error) throw error;
    for (const t of data ?? []) {
      // Topping luôn cộng thêm giá, không bao giờ thay giá gốc.
      snapshot.options[t.id] = { ...t, price_mode: "delta", source: "topping" };
    }
  }

  // Cách cộng giá nằm ở nhóm option (replace = thay giá gốc, delta = cộng thêm).
  const groupIds = [
    ...new Set(
      Object.values(snapshot.options)
        .filter((option) => !option.source)
        .map((option) => option.group_id),
    ),
  ];
  if (groupIds.length > 0) {
    const { data: groups, error: groupsError } = await supabase
      .from("product_option_groups")
      .select("id, price_mode")
      .in("id", groupIds);
    if (groupsError) {
      // 42703 = DB chưa chạy migration thêm price_mode. Giữ hành vi cũ (mọi
      // nhóm đều cộng thêm) thay vì làm sập giỏ hàng.
      if (groupsError.code === "42703") return snapshot;
      throw groupsError;
    }

    const modeByGroup = new Map<string, "delta" | "replace">();
    for (const group of groups ?? []) {
      modeByGroup.set(group.id, group.price_mode === "replace" ? "replace" : "delta");
    }
    for (const option of Object.values(snapshot.options)) {
      if (option.source) continue;
      option.price_mode = modeByGroup.get(option.group_id) ?? "delta";
    }
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

/**
 * Nhóm biến thể DÙNG CHUNG đã gán cho món (product_id = null + bảng nối).
 * Trả rỗng nếu DB chưa chạy migration nhóm dùng chung, để trang món vẫn chạy
 * với nhóm riêng như trước.
 */
async function fetchLinkedOptionGroups(
  productId: string,
): Promise<ProductDetail["product_option_groups"]> {
  const { data, error } = await supabase
    .from("product_option_group_links")
    .select("product_option_groups(*, product_options(*))")
    .eq("product_id", productId)
    .order("sort_order");

  if (error) {
    // Chưa chạy migration nhóm dùng chung: PostgREST trả 42P01 hoặc PGRST205
    // (không thấy bảng trong schema cache). Vẫn chạy được với nhóm riêng.
    if (
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /product_option_group_links/i.test(error.message ?? "")
    ) {
      return [];
    }
    throw error;
  }

  return (data ?? [])
    .map((link) => link.product_option_groups)
    .filter((group): group is ProductDetail["product_option_groups"][number] => group !== null);
}

export async function fetchProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      // Nêu rõ khoá ngoại: bảng nối product_option_group_links tạo quan hệ thứ hai
      // giữa products và product_option_groups, không chỉ định sẽ báo PGRST201.
      "*, categories(icon, name, slug), product_option_groups!product_option_groups_product_id_fkey(*, product_options(*)), product_topping_groups(sort_order, topping_groups(*, topping_items(*)))",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ProductDetailRow;

  // Nhóm dùng chung (vd Size M/L) gán thêm cho món, gộp cùng nhóm riêng.
  const groupsById = new Map(row.product_option_groups.map((g) => [g.id, g]));
  for (const group of await fetchLinkedOptionGroups(row.id)) {
    if (!groupsById.has(group.id)) groupsById.set(group.id, group);
  }
  row.product_option_groups = [...groupsById.values()];

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

/** Món theo id — dùng khi cần chi tiết option/topping của sản phẩm thành phần combo. */
export async function fetchProductById(id: string): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      // Xem chú thích ở fetchProductBySlug: phải chỉ định khoá ngoại.
      "*, categories(icon, name, slug), product_option_groups!product_option_groups_product_id_fkey(*, product_options(*)), product_topping_groups(sort_order, topping_groups(*, topping_items(*)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as ProductDetailRow;

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
  /** Cách nhóm cộng giá: "replace" (biến thể/kích cỡ) hay "delta" (cộng thêm). */
  price_mode: "delta" | "replace";
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

  const found: SelectedOption[] = (data ?? []).map((o) => ({ ...o, price_mode: "delta" as const }));
  const missing = ids.filter((id) => !found.some((o) => o.id === id));

  let toppings: SelectedOption[] = [];
  if (missing.length > 0) {
    const { data, error: tErr } = await supabase
      .from("topping_items")
      .select(columns)
      .in("id", missing);
    if (tErr) throw tErr;
    toppings = (data ?? []).map((t) => ({
      ...t,
      source: "topping" as const,
      price_mode: "delta" as const,
    }));
  }

  const rows = [...found, ...toppings];

  // Nhóm quyết định cách cộng giá. Mua lại đơn cũ vẫn dùng GIÁ HIỆN TẠI, nên
  // phải tính y hệt create-order — biến thể/kích cỡ thay giá gốc, không cộng.
  const groupIds = [
    ...new Set(rows.filter((row) => !row.source).map((row) => row.group_id)),
  ];
  if (groupIds.length === 0) return rows;

  const { data: groups, error: gErr } = await supabase
    .from("product_option_groups")
    .select("id, price_mode")
    .in("id", groupIds);
  if (gErr) {
    // DB chưa có cột price_mode (migration chưa áp) → coi mọi nhóm là "delta".
    if (gErr.code === "42703") return rows;
    throw gErr;
  }

  const modeByGroup = new Map<string, "delta" | "replace">();
  for (const group of groups ?? []) {
    modeByGroup.set(group.id, group.price_mode === "replace" ? "replace" : "delta");
  }

  return rows.map((row) =>
    row.source ? row : { ...row, price_mode: modeByGroup.get(row.group_id) ?? "delta" },
  );
}

// ── Combo (gộp món) ──────────────────────────────────────────────────────
//
// Quản lý qua Supabase Studio trực tiếp — app không có màn Admin (xem plan
// tại C:\Users\Admin\.claude\plans\redesign-to-n-b-giao-shimmying-tower.md).

/** Số combo tối đa hiển thị ở section "Ăn thả ga không lo về giá". */
const COMBO_LIST_LIMIT = 20;

/** Combo kèm danh sách món con — đủ để card hiển thị tóm tắt "Xôi · Trà sữa". */
export type ComboWithItems = Omit<Tables<"combos">, "choice_groups"> & {
  combo_items: Array<{ quantity: number; products: { id: string; name: string } | null }>;
  /** Cột jsonb đã chuẩn hoá về đúng hình dạng — card ngoài cần in cả món nước được chọn. */
  choice_groups: ComboChoiceGroup[];
};

function normalizeChoiceGroups(value: unknown): ComboChoiceGroup[] {
  return Array.isArray(value) ? (value as ComboChoiceGroup[]) : [];
}

/** Toàn bộ combo đang bán — dùng cho section "Ăn thả ga không lo về giá". */
export async function fetchCombos(): Promise<ComboWithItems[]> {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(quantity, products(id, name))")
    .eq("is_available", true)
    .order("sort_order")
    .limit(COMBO_LIST_LIMIT);

  if (error && /choice_groups/i.test(error.message ?? "")) {
    const retry = await supabase
      .from("combos")
      .select("id, name, slug, description, price, image_url, is_available, is_featured, sort_order, created_at, updated_at, combo_items(quantity, products(id, name))")
      .eq("is_available", true)
      .order("sort_order")
      .limit(COMBO_LIST_LIMIT);
    if (retry.error) throw retry.error;
    return ((retry.data ?? []) as Omit<ComboWithItems, "choice_groups">[]).map((c) => ({
      ...c,
      choice_groups: [],
    }));
  }

  if (error) throw error;
  return (data as ComboWithItems[]).map((c) => ({
    ...c,
    choice_groups: normalizeChoiceGroups(c.choice_groups),
  }));
}

/** Dùng cho "Mua lại đơn": lấy hiện trạng HIỆN TẠI của các combo trong đơn cũ. */
export async function fetchCombosByIds(ids: string[]): Promise<Tables<"combos">[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("combos").select("*").in("id", ids);
  if (error) throw error;
  return data;
}

/** Combo cho màn chi tiết — kèm ảnh + giá gốc từng món con để hiển thị mức tiết kiệm. */
export type ComboDetail = Tables<"combos"> & {
  combo_items: Array<{
    quantity: number;
    products: { id: string; name: string; image_url: string | null; base_price: number } | null;
  }>;
};

/**
 * Không lọc `is_available` (khác `fetchCombos`) — giống `fetchProductBySlug`,
 * để màn chi tiết còn hiển thị được trạng thái "tạm hết hàng" thay vì 404.
 */
export async function fetchComboBySlug(slug: string): Promise<ComboDetail | null> {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(quantity, products(id, name, image_url, base_price))")
    .eq("slug", slug)
    .maybeSingle();

  if (error && /choice_groups/i.test(error.message ?? "")) {
    const retry = await supabase
      .from("combos")
      .select("id, name, slug, description, price, image_url, is_available, is_featured, sort_order, created_at, updated_at, combo_items(quantity, products(id, name, image_url, base_price))")
      .eq("slug", slug)
      .maybeSingle();
    if (retry.error) throw retry.error;
    return (retry.data as ComboDetail | null) ?? null;
  }

  if (error) throw error;
  return data as ComboDetail | null;
}

// ── Banner trang chủ ─────────────────────────────────────────────────────

/** Số banner tối đa kéo về — dải cuộn ngang, nhiều hơn thế thì không ai lướt hết. */
const BANNER_LIMIT = 10;

/**
 * Banner đang bật, theo thứ tự Admin sắp.
 *
 * RLS đã lọc `is_active` (policy banners_public_read), nhưng vẫn `.eq` lại ở
 * đây: Admin đăng nhập cũng đọc chính hàm này khi xem trang chủ, mà policy cho
 * Admin thấy cả banner đã tắt — không lọc thì quán tưởng banner tắt vẫn đang chạy.
 */
export async function fetchActiveBanners(): Promise<Tables<"banners">[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at", { ascending: false })
    .limit(BANNER_LIMIT);

  if (error) throw error;
  return data;
}


export type ComboChoiceGroup = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  items: Array<{ product_id: string; product_name?: string; quantity: number; sort_order?: number }>;
};
