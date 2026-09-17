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

export const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  // Chỉ nhận ID option. Tên và GIÁ được tra lại từ DB, không lấy từ client.
  option_ids: z.array(z.string().uuid()).max(20).default([]),
  item_note: z.string().trim().max(200).optional(),
});

export const createOrderSchema = z.object({
  customer_name: z.string().trim().min(1).max(100),
  customer_phone: phoneSchema,
  building: z.string().trim().min(1).max(50),
  floor: z.string().trim().max(20).optional(),
  room: z.string().trim().max(20).optional(),
  class_name: z.string().trim().max(50).optional(),
  delivery_note: z.string().trim().max(500).optional(),
  payment_method: z.enum(["cod", "payos"]),
  discount_code: z.string().trim().max(50).optional(),
  items: z.array(cartItemSchema).min(1).max(50),
});

export const applyDiscountSchema = z.object({
  code: z.string().trim().min(1).max(50),
  // Subtotal chỉ dùng để xem trước; khi đặt đơn server tính lại từ đầu.
  subtotal: z.number().min(0).max(100_000_000),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
