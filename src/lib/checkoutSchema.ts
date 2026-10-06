import { z } from "zod";

/** Toà nhà nhận giao trong khuôn viên trường. */
export const BUILDINGS = ["A", "B", "Khuôn viên"] as const;

/**
 * Điểm giao cố định. Quán không lên tầng, không giao tận phòng — khách xuống
 * sảnh nhận. Vì vậy form chỉ hỏi toà, không còn ô tầng/phòng.
 */
export const DELIVERY_POINT_NOTE = "Đơn được giao tại tầng 1 của mỗi toà.";

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
export const DELIVERY_METHODS = ["delivery", "pickup"] as const;

export const checkoutSchema = z
  .object({
    /** Bắt buộc — giao tận nơi hay khách tự đến quán lấy. */
    delivery_method: z.enum(DELIVERY_METHODS, { message: "Chọn giao tận nơi hoặc nhận tại quán" }),

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

    // Chỉ bắt buộc khi giao tận nơi — kiểm ở superRefine bên dưới.
    // "" (profile cũ chưa chọn toà) coi như chưa chọn, để đơn nhận tại quán không bị báo lỗi oan.
    building: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.enum(BUILDINGS, { message: "Vui lòng chọn toà" }).optional(),
    ),

    address_detail: freeText(200),
    shop_note: freeText(200),

    payment_method: z.enum(["cod", "payos"]),
  })
  .superRefine((v, ctx) => {
    if (v.delivery_method === "delivery" && !v.building) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["building"], message: "Vui lòng chọn toà" });
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
  // Nhận tại quán thì không có địa chỉ giao — bỏ qua ô chi tiết địa chỉ dù còn chữ cũ.
  if (form.address_detail && form.delivery_method === "delivery") parts.push(`Địa chỉ: ${form.address_detail}`);
  if (form.shop_note) parts.push(`Ghi chú: ${form.shop_note}`);
  return parts.length > 0 ? parts.join(" | ") : undefined;
}

// ── Giờ muốn nhận ─────────────────────────────────────────────────────────
//
// Bộ chọn chỉ có Giờ:Phút → luôn hiểu là HÔM NAY theo giờ máy khách (khách ở
// VN, cùng múi giờ quán). Bản quyết định là is_valid_desired_delivery_time()
// ở DB (gọi trong create-order) — ở đây chỉ để báo lỗi sớm, cùng quy tắc:
// sau thời điểm hiện tại + trong khung giờ mở cửa (hỗ trợ khung vắt qua nửa đêm).

export type StoreHours = { open_time: string; close_time: string };

/** "18:30:00" | "18:30" -> phút trong ngày. */
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** "HH:MM" có nằm trong giờ mở cửa không — cùng logic với is_store_open() ở DB. */
export function isWithinStoreHours(hhmm: string, hours: StoreHours): boolean {
  const t = toMinutes(hhmm);
  const open = toMinutes(hours.open_time);
  const close = toMinutes(hours.close_time);
  return open <= close ? t >= open && t < close : t >= open || t < close;
}

/** "HH:MM" hôm nay -> Date. */
export function desiredTimeToDate(hhmm: string, now: Date = new Date()): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Mặc định khi bật hẹn giờ: 30 phút nữa, làm tròn lên bội số 5 phút. */
export function defaultDesiredTime(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 30 * 60 * 1000);
  const rounded = Math.ceil(d.getMinutes() / 5) * 5;
  d.setMinutes(rounded, 0, 0); // 60 phút tự tràn sang giờ kế tiếp
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Schema cho "HH:MM" — phụ thuộc giờ mở cửa và thời điểm hiện tại nên dựng lúc validate. */
export function desiredDeliverySchema(hours: StoreHours, now: Date = new Date()) {
  const fmt = (t: string) => t.slice(0, 5);
  return z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ không hợp lệ")
    .superRefine((hhmm, ctx) => {
      if (desiredTimeToDate(hhmm, now).getTime() <= now.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Giờ muốn nhận phải sau thời điểm hiện tại." });
        return;
      }
      if (!isWithinStoreHours(hhmm, hours)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Ngoài giờ mở cửa (${fmt(hours.open_time)}–${fmt(hours.close_time)}).`,
        });
      }
    });
}

/**
 * Các mốc còn hẹn được HÔM NAY: giờ -> danh sách phút (bước `step`), chỉ gồm mốc
 * sau thời điểm hiện tại và trong giờ mở cửa. Bộ chọn chỉ hiện các mốc này nên
 * khách không chọn được giờ sai ngay từ đầu.
 */
export function selectableSlots(hours: StoreHours, now: Date = new Date(), step = 5): Map<number, number[]> {
  const slots = new Map<number, number[]>();
  for (let h = now.getHours(); h < 24; h++) {
    const minutes: number[] = [];
    for (let m = 0; m < 60; m += step) {
      const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (desiredTimeToDate(hhmm, now).getTime() > now.getTime() && isWithinStoreHours(hhmm, hours)) minutes.push(m);
    }
    if (minutes.length > 0) slots.set(h, minutes);
  }
  return slots;
}

/** "HH:MM" có nằm trong `slots` không. */
export function isSelectableSlot(hhmm: string, slots: Map<number, number[]>): boolean {
  const [h, m] = hhmm.split(":").map(Number);
  return slots.get(h)?.includes(m) ?? false;
}

/** Mốc hợp lệ sớm nhất không trước `hhmm` (hoặc mốc đầu tiên) — dùng để tự chỉnh khi giờ đã chọn vừa trôi qua. */
export function nextSelectableSlot(hhmm: string, slots: Map<number, number[]>): string | null {
  const [h, m] = hhmm.split(":").map(Number);
  const target = h * 60 + m;
  let first: string | null = null;
  for (const [sh, mins] of slots) {
    for (const sm of mins) {
      const t = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
      first ??= t;
      if (sh * 60 + sm >= target) return t;
    }
  }
  return first;
}
