import { env, functionsUrl } from "@/lib/env";

/**
 * Gọi Edge Function. Mọi thao tác cần quyền cao (tạo đơn, tiêu lượt mã giảm giá)
 * đều đi qua đây — frontend không bao giờ chạm SERVICE_ROLE_KEY.
 */

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${functionsUrl}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK", "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.", 0);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      data?.error ?? "UNKNOWN",
      data?.message ?? "Có lỗi xảy ra, vui lòng thử lại.",
      res.status,
    );
  }

  return data as T;
}

export type DiscountPreview = {
  code: string;
  discount_amount: number;
  subtotal_after: number;
};

/** Xem trước mức giảm. KHÔNG tiêu lượt — lượt chỉ trừ khi đơn được tạo. */
export function applyDiscount(code: string, subtotal: number): Promise<DiscountPreview> {
  return callFunction<DiscountPreview>("apply-discount", { code, subtotal });
}

export type CreateOrderPayload = {
  customer_name: string;
  /** Bắt buộc khi giao tận nơi, bỏ trống khi đặt tại quầy. */
  customer_phone?: string;
  delivery_method: "delivery" | "in_store";
  /** Bắt buộc khi giao tận nơi, bỏ trống khi đặt tại quầy. */
  building?: string;
  delivery_note?: string;
  payment_method: "cod" | "payos";
  discount_code?: string;
  /** ISO 8601 — "Giờ muốn nhận". Bỏ trống = giao sớm nhất có thể. */
  desired_delivery_time?: string;
  // Phải khớp CHÍNH XÁC hình dạng của cartItemSchema trong
  // supabase/functions/_shared/schemas.ts — hai bên là bản sao của nhau.
  items: Array<
    | {
        kind: "product";
        product_id: string;
        quantity: number;
        options: Array<{ option_id: string; quantity: number }>;
        item_note?: string;
      }
    | {
        kind: "combo";
        combo_id: string;
        quantity: number;
        item_note?: string;
        components?: Array<{
          product_id: string;
          options: Array<{ option_id: string; quantity: number }>;
        }>;
        choices?: Array<{
          group_id: string;
          product_id: string;
          options: Array<{ option_id: string; quantity: number }>;
        }>;
      }
  >;
};

export type CreateOrderResult = {
  order_code: string;
  total_amount: number;
  payment_method: "cod" | "payos";
  checkout_url?: string;
  qr_code?: string;
};

export function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  return callFunction<CreateOrderResult>("create-order", payload);
}

export type CancelPaymentResult = {
  cancelled: boolean;
  /** Vì sao không huỷ: PAID (khách vừa trả xong) | NOT_PENDING | RACED. */
  reason?: "PAID" | "NOT_PENDING" | "RACED";
};

/** Khách rời trang QR — huỷ link PayOS và đóng đơn. */
export function cancelPayment(orderCode: string): Promise<CancelPaymentResult> {
  return callFunction<CancelPaymentResult>("cancel-payment", { order_code: orderCode });
}

/**
 * Bản dùng trong `beforeunload`. `keepalive` giữ request sống khi tab đang
 * đóng — sendBeacon không dùng được vì không gắn được header apikey.
 */
export function cancelPaymentOnUnload(orderCode: string): void {
  void fetch(`${functionsUrl}/cancel-payment`, {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      apikey: env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ order_code: orderCode }),
  }).catch(() => {});
}
