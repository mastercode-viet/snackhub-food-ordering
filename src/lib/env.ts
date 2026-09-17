import { z } from "zod";

/**
 * Validate biến môi trường ngay khi app khởi động — thiếu biến thì fail ngay
 * lúc dev, thay vì lỗi mơ hồ ở tận màn hình thanh toán.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL phải là URL hợp lệ"),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, "Thiếu VITE_SUPABASE_ANON_KEY"),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Cấu hình môi trường không hợp lệ.\n${missing}\n\nKiểm tra lại file .env.local`);
}

export const env = parsed.data;

/** URL gốc của Edge Functions — dùng từ S7 (đặt hàng) trở đi. */
export const functionsUrl = `${env.VITE_SUPABASE_URL}/functions/v1`;
