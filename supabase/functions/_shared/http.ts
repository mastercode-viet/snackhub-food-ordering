// CORS + helper phản hồi dùng chung.
// CORS chỉ cho phép domain Netlify chính thức (khai báo qua env ALLOWED_ORIGINS).

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function isOriginAllowed(origin: string | null): boolean {
  // Cho phép request không có Origin (server-to-server, webhook).
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/** Lỗi trả về cho client: chỉ mã lỗi + thông điệp tiếng Việt, không lộ chi tiết nội bộ. */
export function fail(code: string, message: string, status: number, origin: string | null): Response {
  return json({ error: code, message }, status, origin);
}

export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) });
}

/** Hash IP để rate-limit mà không lưu IP thô. */
export async function clientKey(req: Request): Promise<string> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
