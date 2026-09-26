// Static server tối giản cho Plesk/Passenger (Tenten Vibe Code Hosting) — không cần thêm dependency.
// Serve dist/ + fallback mọi route không khớp file thật về index.html (bắt buộc cho SPA dùng
// createBrowserRouter: PayOS returnUrl, deep-link /admin, /don-hang/:code... đều là full page load).
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const DIST_DIR = join(process.cwd(), "dist");
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

function sendFile(res, filePath, status = 200) {
  const isIndex = filePath.endsWith("index.html");
  res.writeHead(status, {
    "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    // index.html luôn phải fetch mới — tên file JS/CSS đổi theo content-hash mỗi lần build.
    "Cache-Control": isIndex ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const requested = normalize(join(DIST_DIR, decodeURIComponent(url.pathname)));

    // Chặn path traversal (../..) — request phải nằm trong dist/.
    if (!requested.startsWith(DIST_DIR + sep) && requested !== DIST_DIR) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const st = await stat(requested).catch(() => null);
    if (st?.isFile()) {
      sendFile(res, requested);
      return;
    }

    // Route client-side (React Router) hoặc 404 thật: cả hai đều trả index.html,
    // App tự render NotFoundPage khi không khớp path nào.
    sendFile(res, join(DIST_DIR, "index.html"));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("Internal Server Error");
  }
}).listen(PORT, () => {
  console.log(`snackhub server đang chạy ở port ${PORT}`);
});
