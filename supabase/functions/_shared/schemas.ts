import { z } from "npm:zod@3.23.8";

// Zod validate ở Edge Function — không tin type TypeScript compile-time,
// cũng không tin bất kỳ giá trị nào frontend gửi lên.

/**
 * Đầu số di động Việt Nam sau đợt chuyển 11 số về 10 số (2018):
 *   Viettel      032–039, 086, 096–098
 *   Vinaphone    081–085, 088, 091, 094
 *   Mobifone     070, 076–079, 089, 090, 093
 *   Vietnamobile 052, 056, 058, 092
 *   Gmobile      059, 099
 *   Itelecom     087
 *
 * PHẢI khớp với VN_PHONE_PATTERN trong src/lib/checkoutSchema.ts.
 */
export const VN_PHONE_PATTERN = /^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])\d{7}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(VN_PHONE_PATTERN, "Số di động Việt Nam gồm 10 số, ví dụ 0912345678");

/** PHẢI khớp với BUILDINGS trong src/lib/checkoutSchema.ts. */
export const BUILDINGS = ["A", "B", "Khuôn viên"] as const;

/**
 * Hai loại dòng giỏ hàng, phân biệt bằng `kind`:
 *   - "product": món lẻ, có thể có option tuỳ biến (như trước).
 *   - "combo": gói combo giá cố định, KHÔNG có option — món con và giá
 *     đều tra lại từ bảng `combos`/`combo_items`, không nhận từ client.
 * Xem plan tại C:\Users\Admin\.claude\plans\redesign-to-n-b-giao-shimmying-tower.md.
 */
export const productCartItemSchema = z.object({
  kind: z.literal("product"),
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  // Chỉ nhận ID option. Tên và GIÁ được tra lại từ DB, không lấy từ client.
  option_ids: z.array(z.string().uuid()).max(20).default([]),
  item_note: z.string().trim().max(200).optional(),
});

export const comboCartItemSchema = z.object({
  kind: z.literal("combo"),
  combo_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  item_note: z.string().trim().max(200).optional(),
});

export const cartItemSchema = z.discriminatedUnion("kind", [
  productCartItemSchema,
  comboCartItemSchema,
]);

export const createOrderSchema = z.object({
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: phoneSchema,
  // Chỉ 3 điểm giao, và luôn giao ở tầng 1 — không còn nhận tầng/phòng/lớp.
  building: z.enum(BUILDINGS),
  delivery_note: z.string().trim().max(500).optional(),
  payment_method: z.enum(["cod", "payos"]),
  discount_code: z.string().trim().max(50).optional(),
  items: z.array(cartItemSchema).min(1).max(50),
});

export const cancelPaymentSchema = z.object({
  order_code: z.string().trim().min(3).max(20),
});

export const applyDiscountSchema = z.object({
  code: z.string().trim().min(1).max(50),
  // Subtotal chỉ dùng để xem trước; khi đặt đơn server tính lại từ đầu.
  subtotal: z.number().min(0).max(100_000_000),
});

/** Chỉ superadmin gọi được (create-staff-account tự kiểm tra is_admin() của caller). */
export const createStaffAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  // Auth Supabase mặc định yêu cầu tối thiểu 6 ký tự — nâng lên 8 vì đây là
  // tài khoản admin tự đặt hộ nhân viên, không phải khách vãng lai.
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(1).max(100),
  phone: phoneSchema.optional(),
  bank_account: z.string().trim().max(100).optional(),
  role: z.enum(["superadmin", "staff"]),
  hourly_rate: z.number().min(0).max(1_000_000).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
export type ProductCartItemInput = z.infer<typeof productCartItemSchema>;
export type ComboCartItemInput = z.infer<typeof comboCartItemSchema>;
export type CreateStaffAccountInput = z.infer<typeof createStaffAccountSchema>;
