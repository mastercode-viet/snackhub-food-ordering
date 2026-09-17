import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * Client dùng anon key — mọi truy vấn đều đi qua RLS.
 * Khách không cần đăng nhập nên KHÔNG tự động lưu session ở luồng khách;
 * phiên đăng nhập chỉ phát sinh ở khu vực Admin (S9).
 */
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
