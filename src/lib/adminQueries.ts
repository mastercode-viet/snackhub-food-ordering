import { supabase } from "@/lib/supabase";
import type { OrderItemView } from "@/lib/queries";
import type { Tables } from "@/types/database";
import { mondayOf } from "@/lib/format";

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

export type AdminProduct = Pick<Tables<"products">, "id" | "name" | "base_price">;

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  const { data, error } = await supabase.from("products").select("id, name, base_price").order("name");
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
  | "collected_by_staff_id"
  | "assigned_staff_id"
> & {
  order_items: OrderItemView[];
  /**
   * Null nếu chưa thu (payment_status khác 'paid'), hoặc nếu người xem là
   * staff thường và không phải người đã thu — RLS staff_profiles chỉ cho
   * đọc hồ sơ CHÍNH MÌNH, admin mới thấy tên của mọi nhân viên.
   */
  collected_by_staff: Pick<Tables<"staff_profiles">, "id" | "full_name"> | null;
  /** Nhân viên nhận giao — gắn tự động khi đơn chuyển sang 'delivering'. */
  assigned_staff: Pick<Tables<"staff_profiles">, "id" | "full_name"> | null;
};

// orders có 2 FK riêng biệt tới staff_profiles (collected_by_staff_id VÀ
// assigned_staff_id) nên PostgREST bắt buộc chỉ rõ constraint qua "!tên_fk" —
// nếu chỉ ghi "staff_profiles(...)" trần sẽ lỗi "more than one relationship
// found" vì không biết embed theo cột nào.
const ORDER_COLUMNS =
  "id, order_code, status, payment_method, payment_status, customer_name, customer_phone, " +
  "building, floor, room, class_name, delivery_note, subtotal, discount_amount, discount_code, " +
  "shipping_fee, total_amount, cancel_reason, cancelled_at, completed_at, created_at, " +
  "collected_by_staff_id, collected_by_staff:staff_profiles!orders_collected_by_staff_id_fkey(id, full_name), " +
  "assigned_staff_id, assigned_staff:staff_profiles!orders_assigned_staff_id_fkey(id, full_name), " +
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

/** Đếm nhanh đơn "chờ xác nhận" — dùng cho huy hiệu (badge) trên menu Đơn hàng, không kéo cả danh sách. */
export async function fetchPendingOrderCount(): Promise<number> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_confirmation");

  if (error) throw error;
  return count ?? 0;
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

/**
 * Ghi nhận đã thu tiền (chủ yếu cho COD). paid_at do trigger đóng dấu; với
 * đơn COD, trigger cũng tự gắn collected_by_staff_id = auth.uid() của người
 * gọi (nếu người đó có hồ sơ staff_profiles).
 */
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
  cod_revenue: number;
  payos_revenue: number;
  sla_breached_orders: number;
};

export type TopProduct = { product_name: string; quantity: number; revenue: number };

export type TopCombo = { combo_id: string; combo_name: string; quantity: number; revenue: number };

/** 1 ô trong lưới heatmap Thứ×Giờ. `dow`: 0 = Chủ nhật ... 6 = Thứ 7 (theo Date#getDay()). */
export type HeatmapCell = { dow: number; hour: number; total_orders: number };

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_DAY = {
  total_orders: 0,
  completed_orders: 0,
  cancelled_orders: 0,
  revenue: 0,
  total_discount: 0,
  avg_order_value: 0,
  cod_revenue: 0,
  payos_revenue: 0,
  sla_breached_orders: 0,
};

/**
 * View chỉ có dòng cho ngày CÓ đơn. Nếu đổ thẳng ra biểu đồ thì ngày không
 * đơn biến mất và trục ngày thành ra sai — các cột cách đều nhau như thể
 * ngày nào cũng liền ngày nào. Nên dựng đủ dải ngày rồi điền 0 vào chỗ trống.
 *
 * `from`/`to` là chuỗi ISO "YYYY-MM-DD", theo Date Range Picker trên
 * AdminDashboardPage — khác bản cũ chỉ nhận số ngày tính lùi từ hôm nay, bản
 * này cho chọn khoảng bất kỳ trong quá khứ (vd "Tháng trước").
 */
export async function fetchDailyStats(from: string, to: string): Promise<DailyStat[]> {
  const { data, error } = await supabase
    .from("admin_daily_stats")
    .select("*")
    .gte("day", from)
    .lte("day", to)
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
      cod_revenue: Number(r.cod_revenue),
      payos_revenue: Number(r.payos_revenue),
      sla_breached_orders: Number(r.sla_breached_orders),
    });
  }

  const spine: DailyStat[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  while (cursor <= end) {
    const key = isoDay(cursor);
    spine.push(byDay.get(key) ?? { day: key, ...EMPTY_DAY });
    cursor.setDate(cursor.getDate() + 1);
  }

  return spine;
}

/** View trả theo từng ngày; gộp lại theo món để ra bảng bán chạy. */
export async function fetchTopProducts(from: string, to: string, limit = 8): Promise<TopProduct[]> {
  const { data, error } = await supabase
    .from("admin_top_products")
    .select("product_name, total_quantity, total_revenue")
    .gte("day", from)
    .lte("day", to);

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

/** Combo bán chạy — cùng khuôn view day-grain như admin_top_products. */
export async function fetchTopCombos(from: string, to: string, limit = 8): Promise<TopCombo[]> {
  const { data, error } = await supabase
    .from("admin_top_combos")
    .select("combo_id, combo_name, total_quantity, total_revenue")
    .gte("day", from)
    .lte("day", to);

  if (error) throw error;

  const byId = new Map<string, TopCombo>();
  for (const row of data ?? []) {
    const id = row.combo_id as string;
    const cur =
      byId.get(id) ?? { combo_id: id, combo_name: row.combo_name as string, quantity: 0, revenue: 0 };
    cur.quantity += Number(row.total_quantity);
    cur.revenue += Number(row.total_revenue);
    byId.set(id, cur);
  }

  return [...byId.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit);
}

/**
 * Gộp view day-grain (ngày, giờ) thành lưới Thứ×Giờ trong khoảng ngày đang
 * xem. `day` view đã quy đổi về giờ VN nên tính dow trực tiếp từ chuỗi ngày
 * là đúng, không lệch múi giờ trình duyệt.
 */
export async function fetchHeatmap(from: string, to: string): Promise<HeatmapCell[]> {
  const { data, error } = await supabase
    .from("admin_hourly_heatmap")
    .select("day, hour, total_orders")
    .gte("day", from)
    .lte("day", to);

  if (error) throw error;

  const grid = new Map<string, number>();
  for (const row of data ?? []) {
    const day = row.day as string;
    const hour = Number(row.hour);
    const dow = new Date(`${day}T00:00:00`).getDay();
    const key = `${dow}-${hour}`;
    grid.set(key, (grid.get(key) ?? 0) + Number(row.total_orders));
  }

  const cells: HeatmapCell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ dow, hour, total_orders: grid.get(`${dow}-${hour}`) ?? 0 });
    }
  }
  return cells;
}

export type RevenueBucket = {
  key: string;
  revenue: number;
  completed_orders: number;
  total_orders: number;
};

/**
 * Gộp dữ liệu ngày (từ fetchDailyStats) thành tuần (mốc Thứ 2 đầu tuần) hoặc
 * tháng (YYYY-MM) để vẽ biểu đồ theo Ngày/Tuần/Tháng — fetchDailyStats luôn
 * trả day-grain, việc gộp hiển thị tách riêng để không phải thêm tham số
 * granularity vào tầng fetch.
 */
export function bucketDailyStats(
  daily: DailyStat[],
  granularity: "day" | "week" | "month",
): RevenueBucket[] {
  if (granularity === "day") {
    return daily.map((d) => ({
      key: d.day,
      revenue: d.revenue,
      completed_orders: d.completed_orders,
      total_orders: d.total_orders,
    }));
  }

  const byKey = new Map<string, RevenueBucket>();
  for (const d of daily) {
    const key = granularity === "week" ? mondayOf(d.day) : d.day.slice(0, 7);
    const cur = byKey.get(key) ?? { key, revenue: 0, completed_orders: 0, total_orders: 0 };
    cur.revenue += d.revenue;
    cur.completed_orders += d.completed_orders;
    cur.total_orders += d.total_orders;
    byKey.set(key, cur);
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
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
  image_url: string | null;
  sort_order: number;
}): Promise<void> {
  const { error } = await supabase.from("categories").insert(input);
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  patch: Partial<
    Pick<Tables<"categories">, "name" | "slug" | "icon" | "image_url" | "sort_order" | "is_active">
  >,
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
  discount_type: "percent" | "fixed";
  discount_value: number;
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

/** Postgres 23503 = FK vi phạm — combo_items chặn xoá (ON DELETE RESTRICT) khi món còn nằm trong combo. */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      const { data } = await supabase.from("combo_items").select("combos(name)").eq("product_id", id);
      const names = [...new Set((data ?? []).map((r) => r.combos?.name).filter(Boolean))];
      const where = names.length ? `combo ${names.map((n) => `"${n}"`).join(", ")}` : "một combo";
      throw new Error(`Món này đang nằm trong ${where} — gỡ món khỏi combo trước khi xoá.`);
    }
    throw error;
  }
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
      | "store_name"
      | "open_time"
      | "close_time"
      | "is_open"
      | "shipping_fee"
      | "min_order_amount"
      | "store_latitude"
      | "store_longitude"
      | "checkin_radius_m"
    >
  >,
): Promise<void> {
  const { error } = await supabase.from("store_settings").update(patch).eq("id", 1);
  if (error) throw error;
}

// ── Banner trang chủ ─────────────────────────────────────────────────────

export type AdminBanner = Tables<"banners">;

export type BannerFormValues = {
  image_url: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
};

/** Cả banner đã tắt (policy banners_public_read cho Admin thấy hết). */
export async function fetchAdminBanners(): Promise<AdminBanner[]> {
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createBanner(values: BannerFormValues): Promise<void> {
  const { error } = await supabase.from("banners").insert(values);
  if (error) throw error;
}

export async function updateBanner(
  id: string,
  patch: Partial<BannerFormValues>,
): Promise<void> {
  const { error } = await supabase.from("banners").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabase.from("banners").delete().eq("id", id);
  if (error) throw error;
}

/** Bật/tắt banner — thao tác nhanh ngay trên danh sách, không cần mở form. */
export async function setBannerActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("banners").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

// ── Mã giảm giá (Khuyến mãi) ─────────────────────────────────────────────

export type AdminDiscountCode = Tables<"discount_codes">;

export type DiscountCodeFormValues = {
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  max_uses: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
};

export async function fetchAdminDiscountCodes(): Promise<AdminDiscountCode[]> {
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createDiscountCode(values: DiscountCodeFormValues): Promise<void> {
  const { error } = await supabase.from("discount_codes").insert({
    ...values,
    code: values.code.trim().toUpperCase(),
  });
  if (error) throw error;
}

export async function updateDiscountCode(
  id: string,
  patch: Partial<DiscountCodeFormValues>,
): Promise<void> {
  const formattedPatch = { ...patch };
  if (formattedPatch.code) {
    formattedPatch.code = formattedPatch.code.trim().toUpperCase();
  }
  const { error } = await supabase.from("discount_codes").update(formattedPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteDiscountCode(id: string): Promise<void> {
  const { error } = await supabase.from("discount_codes").delete().eq("id", id);
  if (error) throw error;
}

export async function setDiscountCodeActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("discount_codes").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

// ── Quản lý Combo ────────────────────────────────────────────────────────

export type AdminComboItem = Tables<"combo_items"> & {
  products: Pick<Tables<"products">, "id" | "name" | "base_price" | "image_url" | "is_available"> | null;
};

export type AdminCombo = Tables<"combos"> & {
  combo_items: AdminComboItem[];
};

export type ComboFormValues = {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
};

export type ComboItemInput = {
  product_id: string;
  quantity: number;
  sort_order?: number;
};

export async function fetchAdminCombos(): Promise<AdminCombo[]> {
  const { data, error } = await supabase
    .from("combos")
    .select("*, combo_items(*, products(id, name, base_price, image_url, is_available))")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as AdminCombo[];
}

export async function createCombo(
  combo: ComboFormValues,
  items: ComboItemInput[],
): Promise<void> {
  const { data: newCombo, error: comboErr } = await supabase
    .from("combos")
    .insert(combo)
    .select("id")
    .single();

  if (comboErr) throw comboErr;

  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from("combo_items").insert(
      items.map((item, idx) => ({
        combo_id: newCombo.id,
        product_id: item.product_id,
        quantity: item.quantity,
        sort_order: item.sort_order ?? idx,
      })),
    );
    if (itemsErr) throw itemsErr;
  }
}

export async function updateCombo(
  id: string,
  combo: Partial<ComboFormValues>,
  items?: ComboItemInput[],
): Promise<void> {
  const { error: comboErr } = await supabase.from("combos").update(combo).eq("id", id);
  if (comboErr) throw comboErr;

  if (items !== undefined) {
    // Thay thế toàn bộ combo_items của combo
    const { error: delErr } = await supabase.from("combo_items").delete().eq("combo_id", id);
    if (delErr) throw delErr;

    if (items.length > 0) {
      const { error: insErr } = await supabase.from("combo_items").insert(
        items.map((item, idx) => ({
          combo_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          sort_order: item.sort_order ?? idx,
        })),
      );
      if (insErr) throw insErr;
    }
  }
}

export async function deleteCombo(id: string): Promise<void> {
  // combo_items có FK ON DELETE CASCADE nên xóa combo sẽ tự xóa combo_items
  const { error } = await supabase.from("combos").delete().eq("id", id);
  if (error) throw error;
}

export async function setComboAvailability(id: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.from("combos").update({ is_available: isAvailable }).eq("id", id);
  if (error) throw error;
}

export async function setComboFeatured(id: string, isFeatured: boolean): Promise<void> {
  const { error } = await supabase.from("combos").update({ is_featured: isFeatured }).eq("id", id);
  if (error) throw error;
}

