// PayOS: tạo link thanh toán + verify chữ ký webhook (HMAC-SHA256 với CHECKSUM_KEY).

const PAYOS_API = "https://api-merchant.payos.vn/v2/payment-requests";

const clientId = () => Deno.env.get("PAYOS_CLIENT_ID")!;
const apiKey = () => Deno.env.get("PAYOS_API_KEY")!;
const checksumKey = () => Deno.env.get("PAYOS_CHECKSUM_KEY")!;

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** So sánh chuỗi theo thời gian hằng số — tránh timing attack khi verify chữ ký. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * PayOS ký trên chuỗi `key=value&key2=value2` với các key của object `data`
 * sắp xếp theo alphabet. null/undefined -> chuỗi rỗng, object/array -> JSON.
 */
function buildSignaturePayload(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k];
      let s: string;
      if (v === null || v === undefined) s = "";
      else if (typeof v === "object") s = JSON.stringify(v);
      else s = String(v);
      return `${k}=${s}`;
    })
    .join("&");
}

export interface PaymentLink {
  checkoutUrl: string;
  paymentLinkId: string;
  qrCode: string;
}

export async function createPaymentLink(params: {
  orderCode: number;
  amount: number;
  description: string; // PayOS giới hạn 25 ký tự
  returnUrl: string;
  cancelUrl: string;
  buyerName?: string;
  buyerPhone?: string;
  expiredAt?: number; // unix seconds
}): Promise<PaymentLink> {
  const { orderCode, amount, description, returnUrl, cancelUrl } = params;

  // Chữ ký lúc tạo link dùng đúng 5 trường này, theo thứ tự cố định của PayOS.
  const signature = await hmacSha256Hex(
    `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`,
    checksumKey(),
  );

  const res = await fetch(PAYOS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId(),
      "x-api-key": apiKey(),
    },
    body: JSON.stringify({ ...params, signature }),
  });

  const body = await res.json();
  if (!res.ok || body.code !== "00") {
    throw new Error(`PayOS tạo link thất bại: ${body.code ?? res.status} ${body.desc ?? ""}`);
  }
  return {
    checkoutUrl: body.data.checkoutUrl,
    paymentLinkId: body.data.paymentLinkId,
    qrCode: body.data.qrCode,
  };
}

export interface WebhookBody {
  code: string;
  desc: string;
  success?: boolean;
  data: Record<string, unknown>;
  signature: string;
}

/**
 * BẮT BUỘC gọi trước khi xử lý webhook. Trả về `data` đã được xác thực,
 * hoặc null nếu chữ ký sai / body dị dạng.
 */
export async function verifyWebhook(raw: string): Promise<Record<string, unknown> | null> {
  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!body?.data || typeof body.signature !== "string") return null;

  const expected = await hmacSha256Hex(buildSignaturePayload(body.data), checksumKey());
  return timingSafeEqual(expected, body.signature) ? body.data : null;
}

/** Hash toàn bộ raw body -> khóa idempotent, PayOS gửi lại y hệt sẽ trùng hash. */
export async function eventHash(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** orderCode PayOS phải là số nguyên dương, duy nhất theo từng merchant. */
export function newPayosOrderCode(): number {
  const ms = Number(String(Date.now()).slice(-10));
  return ms * 100 + Math.floor(Math.random() * 100);
}
