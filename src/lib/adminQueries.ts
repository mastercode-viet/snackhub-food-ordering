import { supabase } from "@/lib/supabase";
import type { OrderItemView } from "@/lib/queries";
import type { Tables } from "@/types/database";

/**
 * Truy vấn chỉ Admin dùng. Ghi được hay không là do RLS (`is_admin()`) quyết
 * định, không phải do UI — ẩn nút chỉ là tiện, không phải hàng rào.
 */

export type ToppingGroupFull = Tables<"topping_groups"> & {
  topping_items: Tables<"topping_items">[];
};

export async function fetchToppingGroups(): Promise<ToppingGroupFull[]> {
  const { data, error } = await supabase
    .from("topping_groups")
    .select("*, topping_items(*)")
    .order("sort_order");

  if (error) throw error;

  const groups = data as ToppingGroupFull[];
  for (const g of groups) g.topping_items.sort((a, b) => a.sort_order - b.sort_order);
  return groups;
}

export async function createToppingGroup(name: string): Promise<Tables<"topping_groups">> {
  const { data, error } = await supabase
    .from("topping_groups")
    .insert({ name })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function renameToppingGroup(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("topping_groups").update({ name }).eq("id", id);
  if (error) throw error;
}

/** Xoá nhóm kéo theo topping con và các dòng gán (FK cascade). Đơn cũ không đụng tới. */
export async function deleteToppingGroup(id: string): Promise<void> {
  const { error } = await supabase.from("topping_groups").delete().eq("id", id);
  if (error) throw error;
}

export async function createToppingItem(
  groupId: string,
  name: string,
  priceDelta: number,
  sortOrder: number,
): Promise<Tables<"topping_items">> {
  const { data, error } = await supabase
    .from("topping_items")
    .insert({ group_id: groupId, name, price_delta: priceDelta, sort_order: sortOrder })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateToppingItem(
  id: string,
  patch: Partial<Pick<Tables<"topping_items">, "name" | "price_delta" | "is_available">>,
): Promise<void> {
  const { error } = await supabase.from("topping_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteToppingItem(id: string): Promise<void> {
  const { error } = await supabase.from("topping_items").delete().eq("id", id);
  if (error) throw error;
}

export type AdminProduct = Pick<Tables<"products">, "id" | "name">;

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase.from("products").select("id, name").order("name");
  if (error) throw error;
  return data;
}

/** productIds đang gán cho từng nhóm. */
export async function fetchAssignments(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from("product_topping_groups")
    .select("product_id, topping_group_id");

  if (error) throw error;

  const byGroup: Record<string, string[]> = {};
  for (const row of data) {
    (byGroup[row.topping_group_id] ??= []).push(row.product_id);
  }
  return byGroup;
}

/** Thay toàn bộ danh sách món của một nhóm. */
export async function setGroupProducts(groupId: string, productIds: string[]): Promise<void> {
  const { error: delErr } = await supabase
    .from("product_topping_groups")
    .delete()
    .eq("topping_group_id", groupId);
  if (delErr) throw delErr;

  if (productIds.length === 0) return;

  const { error } = await supabase
    .from("product_topping_groups")
    .insert(productIds.map((product_id) => ({ product_id, topping_group_id: groupId })));
  if (error) throw error;
}

// ── Đơn hàng ─────────────────────────────────────────────────────────────
//
// Admin đọc thẳng bảng `orders` (policy orders_admin_all), không qua RPC
// get_order_by_code như khách — khách không có quyền SELECT nên mới phải đi
// đường hàm security definer đó.

export type OrderStatus = Tables<"orders">["status"];

export type AdminOrder = Pick<
  Tables<"orders">,
  | "id"
  | "order_code"
  | "status"
  | "payment_method"
  | "payment_status"
  | "customer_name"
  | "customer_phone"
  | "building"
  | "floor"
  | "room"
  | "class_name"
  | "delivery_note"
  | "subtotal"
  | "discount_amount"
  | "discount_code"
  | "shipping_fee"
  | "total_amount"
  | "cancel_reason"
  | "cancelled_at"
  | "completed_at"
  | "created_at"
> & { order_items: OrderItemView[] };

const ORDER_COLUMNS =
  "id, order_code, status, payment_method, payment_status, customer_name, customer_phone, " +
  "building, floor, room, class_name, delivery_note, subtotal, discount_amount, discount_code, " +
  "shipping_fee, total_amount, cancel_reason, cancelled_at, completed_at, created_at, " +
  "order_items(id, product_id, product_name, product_image_url, options, combo_id, " +
  "combo_items_snapshot, unit_price, quantity, line_total, item_note)";

export async function fetchAdminOrders(limit = 100): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as unknown as AdminOrder[];
}

/**
 * Chỉ set `status`. Trigger orders_stamp_status tự đóng dấu completed_at /
 * cancelled_at — đóng dấu ở client là kiểu gì cũng có ngày lệch giờ máy.
 */
export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function cancelOrderAsAdmin(id: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancel_reason: reason, cancelled_by: "admin" })
    .eq("id", id);
  if (error) throw error;
}

/** Ghi nhận đã thu tiền (chủ yếu cho COD). paid_at do trigger đóng dấu. */
export async function markOrderPaid(id: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id);
  if (error) throw error;
}

// ── Thống kê ─────────────────────────────────────────────────────────────
//
// Hai view admin_daily_stats / admin_top_products khai security_invoker=true
// nên chạy theo quyền người gọi: RLS của orders vẫn áp, ai không phải admin
// đọc ra rỗng chứ không thấy doanh thu.

export type DailyStat = {
  day: string;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  revenue: number;
  total_discount: number;
  avg_order_value: number;
};

export type TopProduct = { product_name: string; quantity: number; revenue: number };

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return isoDay(d);
}

const EMPTY_DAY = {
  total_orders: 0,
  completed_orders: 0,
  cancelled_orders: 0,
  revenue: 0,
  total_discount: 0,
  avg_order_value: 0,
};

/**
 * View chỉ có dòng cho ngày CÓ đơn. Nếu đổ thẳng ra biểu đồ thì ngày không
 * đơn biến mất và trục ngày thành ra sai — các cột cách đều nhau như thể
 * ngày nào cũng liền ngày nào. Nên dựng đủ dải ngày rồi điền 0 vào chỗ trống.
 */
export async function fetchDailyStats(days = 14): Promise<DailyStat[]> {
  const from = daysAgoISO(days - 1);

  const { data, error } = await supabase
    .from("admin_daily_stats")
    .select("*")
    .gte("day", from)
    .order("day");

  if (error) throw error;

  const byDay = new Map<string, DailyStat>();
  for (const r of data ?? []) {
    byDay.set(r.day as string, {
      day: r.day as string,
      total_orders: Number(r.total_orders),
      completed_orders: Number(r.completed_orders),
      cancelled_orders: Number(r.cancelled_orders),
      revenue: Number(r.revenue),
      total_discount: Number(r.total_discount),
      avg_order_value: Number(r.avg_order_value),
    });
  }

  const spine: DailyStat[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (days - 1));

  for (let i = 0; i < days; i++) {
    const key = isoDay(cursor);
    spine.push(byDay.get(key) ?? { day: key, ...EMPTY_DAY });
    cursor.setDate(cursor.getDate() + 1);
  }

  return spine;
}

/** View trả theo từng ngày; gộp lại theo món để ra bảng bán chạy. */
export async function fetchTopProducts(days = 14, limit = 8): Promise<TopProduct[]> {
  const { data, error } = await supabase
    .from("admin_top_products")
    .select("product_name, total_quantity, total_revenue")
    .gte("day", daysAgoISO(days));

  if (error) throw error;

  const byName = new Map<string, TopProduct>();
  for (const row of data ?? []) {
    const name = row.product_name as string;
    const cur = byName.get(name) ?? { product_name: name, quantity: 0, revenue: 0 };
    cur.quantity += Number(row.total_quantity);
    cur.revenue += Number(row.total_revenue);
    byName.set(name, cur);
  }

  return [...byName.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

// ── Danh mục ─────────────────────────────────────────────────────────────

export type AdminCategory = Tables<"categories">;

export async function fetchAdminCategories(): Promise<AdminCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data;
}

export async function createCategory(input: {
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}): Promise<void> {
  const { error } = await supabase.from("categories").insert(input);
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Tables<"categories">, "name" | "slug" | "icon" | "sort_order" | "is_active">>,
): Promise<void> {
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

// ── Sản phẩm ─────────────────────────────────────────────────────────────
//
// KHÔNG bao giờ ghi vào products.search_text: đó là cột GENERATED ALWAYS,
// Postgres tự sinh từ name + description (đã lowercase + bỏ dấu). Ghi vào
// là Postgres báo lỗi ngay.

export type AdminProductRow = Tables<"products"> & {
  categories: { name: string } | null;
};

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  base_price: number;
  discount_percent: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
};

export async function fetchAdminProductRows(): Promise<AdminProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(name)")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data as AdminProductRow[];
}

export async function createProduct(values: ProductFormValues): Promise<void> {
  const { error } = await supabase.from("products").insert(values);
  if (error) throw error;
}

export async function updateProduct(id: string, patch: Partial<ProductFormValues>): Promise<void> {
  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/** Bật/tắt "hết hàng tạm thời" — thao tác dùng nhiều nhất trong ngày. */
export async function setProductAvailability(id: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.from("products").update({ is_available: isAvailable }).eq("id", id);
  if (error) throw error;
}

/**
 * Bucket product-images đã có sẵn: public read, ghi/xoá chỉ is_admin(),
 * tối đa 3MB, chỉ nhận webp/jpeg/png/avif. Chặn sớm ở client để khách khỏi
 * chờ upload xong mới nhận lỗi từ Storage.
 */
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif"];

export async function uploadProductImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error("Ảnh phải là WEBP, JPEG, PNG hoặc AVIF.");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error("Ảnh tối đa 3MB. Nén bớt rồi tải lại nhé.");
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;

  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

// ── Cài đặt quán ─────────────────────────────────────────────────────────
//
// Bảng chỉ có đúng 1 dòng id=1, không bao giờ thêm/xoá — nên chỉ cấp UPDATE.

export type StoreSettings = Tables<"store_settings">;

export async function fetchSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateSettings(
  patch: Partial<
    Pick<
      StoreSettings,
      "store_name" | "open_time" | "close_time" | "is_open" | "shipping_fee" | "min_order_amount"
    >
  >,
): Promise<void> {
  const { error } = await supabase.from("store_settings").update(patch).eq("id", 1);
  if (error) throw error;
}
