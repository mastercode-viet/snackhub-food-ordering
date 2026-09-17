import { z } from "zod";

/** Toà nhà nhận giao trong khuôn viên trường. */
export const BUILDINGS = ["A", "B", "Khuôn viên"] as const;

/** Toà A và B đều 9 tầng. */
export const FLOORS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** "Khuôn viên" là khu ngoài trời — không có tầng/phòng. */
export const OUTDOOR_BUILDING = "Khuôn viên";

/** Mẫu số phòng: 1 chữ cái + 1–3 chữ số (A1, A10, A104). Tối đa 4 ký tự. */
export const ROOM_PATTERN = /^[A-Za-z]\d{1,3}$/;

/**
 * Đầu số di động Việt Nam sau đợt chuyển đổi 11 số về 10 số (2018):
 *   Viettel      032–039, 086, 096–098
 *   Vinaphone    081–085, 088, 091, 094
 *   Mobifone     070, 076–079, 089, 090, 093
 *   Vietnamobile 052, 056, 058, 092
 *   Gmobile      059, 099
 *   Itelecom     087
 */
export const VN_PHONE_PATTERN = /^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])\d{7}$/;

/** Ghi chú tự do: chặn < > để không lọt thẻ HTML vào màn hình Admin. */
const freeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Tối đa ${max} ký tự`)
    .refine((v) => !/[<>]/.test(v), "Không dùng ký tự < và >")
    .optional();

/**
 * Bản kiểm tra phía client. Bản quyết định vẫn là `createOrderSchema` trong
 * `supabase/functions/_shared/schemas.ts` — sửa một bên phải sửa cả bên kia.
 *
 * Lưu ý: schema phía Edge Function đang lỏng hơn ở số điện thoại
 * (`^0[0-9]{8,10}$`). Nó vẫn chặn rác, chỉ không bắt được đầu số không tồn tại.
 */
export const checkoutSchema = z
  .object({
    customer_name: z
      .string()
      .trim()
      .min(2, "Tên quá ngắn")
      .max(50, "Tên quá dài")
      .regex(/^[\p{L}\s'.-]+$/u, "Tên chỉ gồm chữ cái, dấu cách và dấu nối"),

    customer_phone: z
      .string()
      .trim()
      .regex(VN_PHONE_PATTERN, "Số di động Việt Nam gồm 10 số, ví dụ 0912345678"),

    building: z.enum(BUILDINGS, { message: "Vui lòng chọn toà" }),
    floor: z.string().trim().optional(),
    room: z.string().trim().optional(),

    address_detail: freeText(200),
    shop_note: freeText(200),

    payment_method: z.enum(["cod", "payos"]),
  })
  .superRefine((value, ctx) => {
    // Khu ngoài trời thì không có tầng/phòng để nhập
    if (value.building === OUTDOOR_BUILDING) return;

    if (!value.floor) {
      ctx.addIssue({ code: "custom", path: ["floor"], message: "Chọn tầng" });
    }

    if (!value.room) {
      ctx.addIssue({ code: "custom", path: ["room"], message: "Nhập số phòng" });
    } else if (!ROOM_PATTERN.test(value.room)) {
      ctx.addIssue({
        code: "custom",
        path: ["room"],
        message: "Sai mẫu — 1 chữ cái + tối đa 3 số, ví dụ A104",
      });
    }
  });

export type CheckoutForm = z.infer<typeof checkoutSchema>;

/**
 * `orders` chỉ có một cột ghi chú (`delivery_note`, tối đa 500 ký tự) nhưng
 * giao diện có hai ô. Ghép lại kèm nhãn để Admin vẫn đọc tách bạch được,
 * thay vì thêm cột mới vào DB.
 */
export function composeDeliveryNote(form: CheckoutForm): string | undefined {
  const parts: string[] = [];
  if (form.address_detail) parts.push(`Địa chỉ: ${form.address_detail}`);
  if (form.shop_note) parts.push(`Ghi chú: ${form.shop_note}`);
  return parts.length > 0 ? parts.join(" | ") : undefined;
}
