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
 * Phương thức thanh toán quán đang bật cho từng hình thức đặt — 4 cột trong
 * store_settings, superadmin bật/tắt ở /admin/cai-dat (mặc định: giao tận nơi
 * chỉ PayOS, tại quầy PayOS + tiền mặt).
 * PHẢI khớp với allowedPaymentMethods / paymentNotAllowedMessage trong src/lib/checkoutSchema.ts.
 */
export type PaymentSettings = {
  delivery_payos_enabled: boolean;
  delivery_cod_enabled: boolean;
  in_store_payos_enabled: boolean;
  in_store_cod_enabled: boolean;
};

export function allowedPaymentMethods(
  s: PaymentSettings,
  delivery: "delivery" | "in_store",
): Record<"payos" | "cod", boolean> {
  return delivery === "delivery"
    ? { payos: s.delivery_payos_enabled, cod: s.delivery_cod_enabled }
    : { payos: s.in_store_payos_enabled, cod: s.in_store_cod_enabled };
}

export function paymentNotAllowedMessage(delivery: "delivery" | "in_store", method: "payos" | "cod"): string {
  const methodLabel =
    method === "payos" ? "thanh toán online (VietQR)" : delivery === "delivery" ? "thanh toán khi nhận hàng" : "thanh toán tiền mặt";
  const typeLabel = delivery === "delivery" ? "đơn giao tận nơi" : "đơn tại quầy";
  return `Quán đang tạm tắt ${methodLabel} cho ${typeLabel}. Vui lòng chọn phương thức khác.`;
}

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
  // Chỉ nhận ID option + số lượng. Tên và GIÁ được tra lại từ DB, không lấy từ client.
  options: z
    .array(
      z.object({
        option_id: z.string().uuid(),
        quantity: z.number().int().min(0).max(99),
      }),
    )
    // KHÔNG có .default([]): payload sai hình dạng (vd. client cũ gửi
    // `option_ids`) phải bị từ chối 400, không được lặng lẽ thành [] rồi
    // tính giá gốc — đúng kiểu lỗi từng làm đơn mất hết topping.
    .max(20),
  item_note: z.string().trim().max(200).optional(),
});

export const comboCartItemSchema = z.object({
  kind: z.literal("combo"),
  combo_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  item_note: z.string().trim().max(200).optional(),
  components: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        options: z
          .array(
            z.object({
              option_id: z.string().uuid(),
              quantity: z.number().int().min(0).max(99),
            }),
          )
          .max(20),
      }),
    )
    .default([]),
  choices: z
    .array(
      z.object({
        group_id: z.string().uuid(),
        product_id: z.string().uuid(),
        options: z
          .array(
            z.object({
              option_id: z.string().uuid(),
              quantity: z.number().int().min(0).max(99),
            }),
          )
          .max(20),
      }),
    )
    .default([]),
});

export const cartItemSchema = z.discriminatedUnion("kind", [
  productCartItemSchema,
  comboCartItemSchema,
]);

export const createOrderSchema = z
  .object({
    customer_name: z.string().trim().min(1).max(100),
    // Bắt buộc với đơn giao hàng (kiểm ở superRefine); đơn tại quầy không hỏi số.
    customer_phone: phoneSchema.optional(),
    // "delivery" = giao tận nơi, "in_store" = khách tự đặt tại quầy qua mã QR
    // (?mode=in_store — phí giao = 0, không toà, không SĐT, không hẹn giờ).
    // .default: bản frontend cũ chưa gửi trường này vẫn đặt được (hiểu là giao hàng).
    delivery_method: z.enum(["delivery", "in_store"]).default("delivery"),
    // Chỉ 3 điểm giao, và luôn giao ở tầng 1 — không còn nhận tầng/phòng/lớp.
    // Bắt buộc với đơn giao hàng (kiểm ở superRefine), bỏ qua với đơn tại quầy.
    building: z.enum(BUILDINGS).optional(),
    delivery_note: z.string().trim().max(500).optional(),
    payment_method: z.enum(["cod", "payos"]),
    discount_code: z.string().trim().max(50).optional(),
    // "Giờ muốn nhận" (ISO 8601 có múi giờ). Chỉ kiểm định dạng ở đây — sau giờ
    // đặt / cùng ngày / trong giờ mở cửa do is_valid_desired_delivery_time() ở DB quyết định.
    desired_delivery_time: z.string().datetime({ offset: true }).optional(),
    items: z.array(cartItemSchema).min(1).max(50),
  })
  .superRefine((v, ctx) => {
    if (v.delivery_method !== "delivery") return;
    if (!v.building) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["building"], message: "Đơn giao hàng phải chọn toà." });
    }
    if (!v.customer_phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customer_phone"], message: "Đơn giao hàng phải có số điện thoại." });
    }
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
