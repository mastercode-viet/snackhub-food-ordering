import { supabase } from "@/lib/supabase";
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
