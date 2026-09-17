/**
 * Giả lập webhook PayOS và GỬI HAI LẦN để kiểm tra tính idempotent.
 *
 *   deno run --allow-net --allow-env scripts/test-payos-webhook.ts <payos_order_code>
 *
 * Cần các biến môi trường: PAYOS_CHECKSUM_KEY, FUNCTIONS_URL
 * Kỳ vọng: lần 1 -> desc "ok", lần 2 -> desc "already processed",
 *          và đơn hàng chỉ chuyển sang 'paid' đúng một lần.
 */

const CHECKSUM_KEY = Deno.env.get("PAYOS_CHECKSUM_KEY");
const FUNCTIONS_URL = Deno.env.get("FUNCTIONS_URL") ?? "http://localhost:54321/functions/v1";

if (!CHECKSUM_KEY) {
  console.error("Thiếu PAYOS_CHECKSUM_KEY");
  Deno.exit(1);
}

const orderCode = Number(Deno.args[0]);
if (!Number.isFinite(orderCode)) {
  console.error("Cách dùng: deno run --allow-net --allow-env scripts/test-payos-webhook.ts <payos_order_code>");
  Deno.exit(1);
}

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Chữ ký ký trên các key của `data` sắp xếp alphabet — giống hệt phía PayOS.
function signaturePayload(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k];
      const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${k}=${s}`;
    })
    .join("&");
}

const data = {
  orderCode,
  amount: 95000,
  description: "SH-TEST000000",
  accountNumber: "0123456789",
  reference: `TF${Date.now()}`,
  transactionDateTime: new Date().toISOString(),
  currency: "VND",
  paymentLinkId: "test-payment-link-id",
  code: "00",
  desc: "success",
  counterAccountBankId: "",
  counterAccountName: "",
  counterAccountNumber: "",
  virtualAccountName: "",
  virtualAccountNumber: "",
};

const body = JSON.stringify({
  code: "00",
  desc: "success",
  success: true,
  data,
  signature: await hmacSha256Hex(signaturePayload(data), CHECKSUM_KEY),
});

for (const attempt of [1, 2]) {
  const res = await fetch(`${FUNCTIONS_URL}/payos-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body, // gửi y hệt raw body -> event_hash trùng nhau
  });
  console.log(`Lần ${attempt}: HTTP ${res.status} ${await res.text()}`);
}

// Kiểm tra chữ ký sai bị chặn
const bad = await fetch(`${FUNCTIONS_URL}/payos-webhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: "00", desc: "success", data, signature: "deadbeef" }),
});
console.log(`Chữ ký sai: HTTP ${bad.status} (kỳ vọng 401) ${await bad.text()}`);
