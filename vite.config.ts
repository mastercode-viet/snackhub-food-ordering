import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  server: {
    // Cho phép mở bằng điện thoại thật trong cùng mạng LAN để test mobile.
    host: true,
    port: 5173,
    // Thà báo lỗi còn hơn âm thầm nhảy sang 5174 — đổi cổng là origin đổi,
    // và Edge Function sẽ chặn CORS mà không nói rõ vì sao.
    strictPort: true,
  },
});
