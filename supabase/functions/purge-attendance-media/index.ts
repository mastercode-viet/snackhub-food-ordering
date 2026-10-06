// POST /functions/v1/purge-attendance-media
//
// pg_cron gọi lúc 00:00 giờ VN (job snackhub-purge-attendance-media). Xoá ảnh
// check-in trong bucket attendance_images và xoá toạ độ của các dòng
// time_logs cũ hơn 30 ngày. GIỮ NGUYÊN dòng time_logs — giờ công còn dùng
// tính lương.
//
// Không có JWT (pg_net gọi server-to-server) — xác thực bằng header
// x-cron-secret, đối chiếu với secret "cron_secret" trong Vault.
//
// Idempotent: chạy lại chỉ xử lý các dòng còn image_url/toạ độ.

import { adminClient } from "../_shared/supabase.ts";
import { fail, json } from "../_shared/http.ts";

const RETENTION_DAYS = 30;
const BATCH_SIZE = 500;
const BUCKET = "attendance_images";

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", "Method không hợp lệ.", 405, null);

  const db = adminClient();

  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok, error: authErr } = await db.rpc("verify_cron_secret", { p_secret: secret });
  if (authErr || ok !== true) return fail("UNAUTHORIZED", "Không có quyền.", 401, null);

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purgedRows = 0;
  let removedFiles = 0;

  try {
    while (true) {
      const { data: rows, error } = await db
        .from("time_logs")
        .select("id, image_url")
        .lt("check_in_at", cutoff)
        .or("image_url.not.is.null,latitude.not.is.null,longitude.not.is.null")
        .limit(BATCH_SIZE);
      if (error) throw error;
      if (!rows || rows.length === 0) break;

      const paths = rows.map((r) => r.image_url).filter((p): p is string => !!p);
      if (paths.length > 0) {
        // Xoá file trước, cập nhật DB sau: lỡ lỗi giữa chừng thì lần chạy sau
        // vẫn thấy image_url và thử lại, không để file mồ côi trong bucket.
        const { error: rmErr } = await db.storage.from(BUCKET).remove(paths);
        if (rmErr) throw rmErr;
        removedFiles += paths.length;
      }

      const { error: updErr } = await db
        .from("time_logs")
        .update({ image_url: null, latitude: null, longitude: null })
        .in("id", rows.map((r) => r.id));
      if (updErr) throw updErr;
      purgedRows += rows.length;

      if (rows.length < BATCH_SIZE) break;
    }

    return json({ purgedRows, removedFiles }, 200, null);
  } catch (e) {
    console.error("purge-attendance-media failed", e);
    return fail("INTERNAL", "Không dọn được dữ liệu chấm công.", 500, null);
  }
});
