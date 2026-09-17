import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * SERVICE_ROLE_KEY chỉ tồn tại ở đây — TUYỆT ĐỐI không đưa xuống frontend.
 * Client này bypass RLS nên mọi truy vấn phải tự giới hạn phạm vi dữ liệu.
 */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Chặn ngay nếu vượt hạn mức. Trả về false = đã vượt. */
export async function withinRateLimit(
  db: SupabaseClient,
  bucketKey: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await db.rpc("check_rate_limit", {
    p_bucket_key: bucketKey,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data === true;
}

/** Giờ hoạt động 6:00–18:00 — kiểm tra lại ở server, không tin frontend. */
export async function storeIsOpen(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc("is_store_open");
  if (error) throw error;
  return data === true;
}
