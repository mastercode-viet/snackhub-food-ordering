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
  customer_phone: string;
  building: string;
  floor?: string;
  room?: string;
  class_name?: string;
  delivery_note?: string;
  payment_method: "cod" | "payos";
  discount_code?: string;
  // Phải khớp CHÍNH XÁC hình dạng của cartItemSchema trong
  // supabase/functions/_shared/schemas.ts — hai bên là bản sao của nhau.
  items: Array<
    | { kind: "product"; product_id: string; quantity: number; option_ids: string[]; item_note?: string }
    | { kind: "combo"; combo_id: string; quantity: number; item_note?: string }
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
