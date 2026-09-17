#!/usr/bin/env node
/**
 * Đo tương phản WCAG AA cho mọi cặp nền/chữ thực sự dùng trong SnackHub.
 *
 * CLAUDE.md nói "đã chạy script, 29 cặp đều đạt" nhưng script đó chưa từng
 * được commit — file này lấp lại chỗ trống đó (Phase 0 của đợt redesign
 * 2026-09, xem C:\Users\Admin\.claude\plans\redesign-to-n-b-giao-shimmying-tower.md).
 *
 * Cách dùng:
 *   node scripts/contrast.mjs
 *
 * Đọc thẳng bảng màu từ khối `:root` của src/index.css (nguồn sự thật duy
 * nhất của màu — tailwind.config.ts chỉ ánh xạ tên token sang biến), rồi đo
 * từng cặp khai trong PAIRS bên dưới. Danh sách PAIRS phải cập nhật tay khi
 * thêm component mới ghép một cặp nền/chữ chưa từng có — grep các class
 * `bg-*` đi kèm `text-*`/`on-*` trong src/**\/*.tsx để tìm cặp mới.
 *
 * Exit code 1 nếu có cặp nào < 4.5:1 (AA cho chữ thường).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cssPath = path.join(root, "src", "index.css");

/**
 * Đọc bảng màu thẳng từ khối `:root` của src/index.css.
 *
 * Giá trị ở đó khai dạng "R G B" (ví dụ `--color-primary: 184 66 14;`) để
 * Tailwind ghép được với <alpha-value>. Đọc từ nguồn thật thay vì chép lại
 * một bảng riêng trong script: chép lại là kiểu gì cũng có ngày lệch.
 */
function loadColors() {
  const css = readFileSync(cssPath, "utf8");
  const colors = {};
  const re = /--color-([a-z0-9-]+)\s*:\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const [, name, r, g, b] = m;
    colors[name] = "#" + [r, g, b].map((v) => Number(v).toString(16).padStart(2, "0")).join("");
  }
  if (Object.keys(colors).length === 0) {
    throw new Error(`Không đọc được token màu nào từ ${cssPath}. Định dạng khai màu có thay đổi?`);
  }
  return colors;
}

// ── WCAG relative luminance + contrast ratio ────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relLuminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(hexA, hexB) {
  const la = relLuminance(hexToRgb(hexA));
  const lb = relLuminance(hexToRgb(hexB));
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Trộn màu có alpha (0-1) lên trên một nền đặc — dùng cho chip kiểu bg-x/50. */
function blend(fgHex, alpha, bgHex) {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const mix = (a, b) => Math.round(a * alpha + b * (1 - alpha));
  const r = mix(fg.r, bg.r);
  const g = mix(fg.g, bg.g);
  const b = mix(fg.b, bg.b);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const colors = loadColors();

/**
 * Mỗi entry: [nhãn, token chữ, token nền, tuỳ chọn { alpha, onBase }]
 * `onBase` là nền thật phía sau khi token nền có opacity (khớp với nơi
 * component đó thực sự render — card trắng hay nền trang).
 */
const PAIRS = [
  // ── Cặp nền/chữ lõi, ghi trong comment tailwind.config.ts ────────────────
  ["Nút chính (mực + chữ trên nút)", "inverse-on-surface", "inverse-surface"],
  ["Chữ chính trên nền trang", "on-surface", "background"],
  ["Chữ phụ trên nền trang", "on-surface-variant", "background"],
  ["Giá tiền trên nền trang", "primary", "background"],
  ["Giá tiền trên card trắng", "primary", "surface-container-lowest"],
  ["Badge % / dải khuyến mãi", "on-primary-container", "primary-container"],
  ["Trạng thái (secondary) + chữ trắng", "on-secondary", "secondary"],
  ["Lỗi + chữ trắng", "on-error", "error"],
  ["Badge giảm giá vàng", "on-sale", "sale"],
  ["Banner Must Try", "on-info", "info"],

  // ── Chip pastel dùng opacity — đo trên màu đã trộn với nền thật ──────────
  // DiscountBox: chip trên card trắng.
  ["Chip DiscountBox (secondary-fixed/50 trên card)", "on-secondary-fixed", "secondary-fixed", { alpha: 0.5, onBase: "#ffffff" }],
  // SuggestionRow: badge trên card trắng.
  ["Badge SuggestionRow (secondary-fixed/50 trên card)", "on-secondary-fixed", "secondary-fixed", { alpha: 0.5, onBase: "#ffffff" }],
  // PaymentMethods: badge trên hàng chọn phương thức (nền surface-container-low).
  ["Badge PaymentMethods (secondary-fixed/60)", "on-secondary-fixed", "secondary-fixed", { alpha: 0.6, onBase: "#ffffff" }],
  // OptionGroup: pill option đã chọn, trên card trắng.
  ["Pill OptionGroup đã chọn (secondary-fixed/70)", "on-secondary-fixed", "secondary-fixed", { alpha: 0.7, onBase: "#ffffff" }],
  // CartLine IssueNote: cảnh báo đổi giá, trong card trắng.
  ["CartLine cảnh báo đổi giá (tertiary-fixed/60)", "on-tertiary-fixed", "tertiary-fixed", { alpha: 0.6, onBase: "#ffffff" }],
  // OrderTrackingPage: cùng loại cảnh báo, đậm hơn.
  ["OrderTracking cảnh báo (tertiary-fixed/80)", "on-tertiary-fixed", "tertiary-fixed", { alpha: 0.8, onBase: "#ffffff" }],
  // StoreStatus: banner "Quán đang tạm nghỉ" nằm thẳng trên nền trang, không phải card.
  ["Banner StoreClosed (tertiary-fixed/70 trên nền trang)", "on-tertiary-fixed", "tertiary-fixed", { alpha: 0.7, onBase: colors.background }],
  // ProductRail: badge danh mục trên card trắng.
  ["Badge danh mục ProductRail (primary-fixed/80)", "on-primary-fixed", "primary-fixed", { alpha: 0.8, onBase: "#ffffff" }],
];

let allPass = true;
const rows = [];

for (const [label, fgToken, bgToken, opts] of PAIRS) {
  const fgHex = colors[fgToken];
  const bgHexRaw = colors[bgToken];
  if (!fgHex || !bgHexRaw) {
    console.error(`✗ Token không tồn tại: ${fgToken} hoặc ${bgToken} (${label})`);
    allPass = false;
    continue;
  }
  const bgHex = opts ? blend(bgHexRaw, opts.alpha, opts.onBase) : bgHexRaw;
  const ratio = contrastRatio(fgHex, bgHex);
  const pass = ratio >= 4.5;
  if (!pass) allPass = false;
  rows.push({ label, fgToken, bgToken, ratio, pass });
}

const maxLabel = Math.max(...rows.map((r) => r.label.length));
console.log(`\nĐo tương phản WCAG AA (ngưỡng 4.5:1) — ${rows.length} cặp\n`);
for (const r of rows) {
  const mark = r.pass ? "✓" : "✗ FAIL";
  console.log(`${mark.padEnd(7)} ${r.label.padEnd(maxLabel)}  ${r.ratio.toFixed(2)}:1`);
}
console.log("");

if (!allPass) {
  console.error("Có cặp trượt AA. Xem CLAUDE.md mục 3 trước khi commit thay đổi màu.");
  process.exit(1);
}
console.log(`Tất cả ${rows.length} cặp đều đạt AA.`);
