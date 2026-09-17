import type { Config } from "tailwindcss";

/**
 * Design tokens của SnackHub.
 *
 * ── GIÁ TRỊ MÀU KHÔNG NẰM Ở FILE NÀY ───────────────────────────────────────
 * Mọi màu khai trong `src/index.css` dưới dạng CSS variable `--color-*`, file
 * này chỉ ánh xạ tên token sang biến. Đọc phần đầu `src/index.css` để biết
 * hướng thiết kế và lý do từng lựa chọn màu.
 *
 * Hai lý do tách như vậy:
 *   1. Thêm dark mode sau này chỉ cần thêm một khối `:root` nữa trong CSS,
 *      không phải sửa lại bất kỳ component nào.
 *   2. `scripts/contrast.mjs` đọc thẳng file CSS đó, nên số đo tương phản
 *      không bao giờ lệch khỏi giá trị thật đang chạy.
 *
 * Dạng `rgb(var(--x) / <alpha-value>)` là bắt buộc để các tiện ích opacity
 * (`bg-secondary-fixed/50`, `bg-tertiary-fixed/70`) tiếp tục hoạt động.
 *
 * ── VÌ SAO GIỮ HỆ TÊN MATERIAL DESIGN 3 ────────────────────────────────────
 * Component chỉ tham chiếu TÊN token, không tham chiếu giá trị. Đó là lý do
 * đổi trọn bảng màu mà gần như không phải sửa file .tsx nào. Không dùng màu
 * Tailwind mặc định trực tiếp trong component, luôn đi qua token.
 *
 * CARD: bo mềm 16px, KHÔNG viền bao quanh, tách khỏi nền bằng `shadow-card`.
 * Viền `outline-variant` chỉ dành cho CONTROL (ô nhập, pill danh mục, nút chọn
 * option) và đường kẻ mép của nav — control cần cạnh để thấy được là bấm được.
 */

/**
 * Ánh xạ {tên token Tailwind -> tên biến CSS} thành giá trị màu Tailwind hiểu được.
 *
 * `<alpha-value>` là chỗ Tailwind thay bằng độ mờ khi gặp cú pháp `bg-x/50`.
 * Nếu viết thẳng `rgb(var(--color-x))` mà bỏ phần đó thì mọi tiện ích opacity
 * sẽ im lặng không có tác dụng — lỗi rất khó thấy vì không có cảnh báo nào.
 */
function token<T extends Record<string, string>>(map: T): Record<keyof T, string> {
  return Object.fromEntries(
    Object.entries(map).map(([name, cssVar]) => [name, `rgb(var(--color-${cssVar}) / <alpha-value>)`]),
  ) as Record<keyof T, string>;
}

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: token({
        // Nền & mặt phẳng
        background: "background",
        surface: "surface",
        "surface-bright": "surface-bright",
        "surface-dim": "surface-dim",
        "surface-variant": "surface-variant",
        "surface-tint": "surface-tint",
        "surface-container-lowest": "surface-container-lowest",
        "surface-container-low": "surface-container-low",
        "surface-container": "surface-container",
        "surface-container-high": "surface-container-high",
        "surface-container-highest": "surface-container-highest",
        "inverse-surface": "inverse-surface",
        "inverse-on-surface": "inverse-on-surface",

        // Chữ & đường kẻ
        "on-background": "on-background",
        "on-surface": "on-surface",
        "on-surface-variant": "on-surface-variant",
        outline: "outline",
        "outline-variant": "outline-variant",

        // Primary: cam nung
        primary: "primary",
        "on-primary": "on-primary",
        "primary-container": "primary-container",
        "on-primary-container": "on-primary-container",
        "primary-fixed": "primary-fixed",
        "primary-fixed-dim": "primary-fixed-dim",
        "on-primary-fixed": "on-primary-fixed",
        "on-primary-fixed-variant": "on-primary-fixed-variant",
        "inverse-primary": "inverse-primary",

        // Secondary: xanh lá trạng thái
        secondary: "secondary",
        "on-secondary": "on-secondary",
        "secondary-container": "secondary-container",
        "on-secondary-container": "on-secondary-container",
        "secondary-fixed": "secondary-fixed",
        "secondary-fixed-dim": "secondary-fixed-dim",
        "on-secondary-fixed": "on-secondary-fixed",
        "on-secondary-fixed-variant": "on-secondary-fixed-variant",

        // Tertiary: cát ám vàng
        tertiary: "tertiary",
        "on-tertiary": "on-tertiary",
        "tertiary-container": "tertiary-container",
        "on-tertiary-container": "on-tertiary-container",
        "tertiary-fixed": "tertiary-fixed",
        "tertiary-fixed-dim": "tertiary-fixed-dim",
        "on-tertiary-fixed": "on-tertiary-fixed",
        "on-tertiary-fixed-variant": "on-tertiary-fixed-variant",

        // Lỗi
        error: "error",
        "on-error": "on-error",
        "error-container": "error-container",
        "on-error-container": "on-error-container",

        // Ngoài hệ M3: dải khuyến mãi Trang chủ
        info: "info",
        "on-info": "on-info",
        sale: "sale",
        "on-sale": "on-sale",
      }),

      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },

      /**
       * Thang chữ: kéo giãn hai đầu để phân cấp rõ hơn.
       * Editorial sống bằng tương phản cỡ chữ, không bằng màu. Tiêu đề to và
       * siết tracking; nhãn nhỏ viết hoa, giãn chữ.
       */
      fontSize: {
        "display-lg": ["40px", { lineHeight: "44px", letterSpacing: "-0.035em", fontWeight: "700" }],
        "headline-lg": ["30px", { lineHeight: "34px", letterSpacing: "-0.03em", fontWeight: "700" }],
        "headline-md": ["22px", { lineHeight: "27px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-sm": ["17px", { lineHeight: "22px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "25px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "body-sm": ["12.5px", { lineHeight: "18px", fontWeight: "400" }],
        "label-lg": ["15px", { lineHeight: "20px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "label-md": ["13px", { lineHeight: "18px", fontWeight: "500" }],
        // Nhãn nhỏ: viết hoa + giãn chữ, dùng cho "GIÁ", tên danh mục, eyebrow
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.08em", fontWeight: "600" }],
        "label-xs": ["10px", { lineHeight: "13px", letterSpacing: "0.08em", fontWeight: "600" }],
      },

      // Nhịp khoảng trắng theo bội số 4px.
      spacing: {
        "space-xs": "0.25rem", // 4
        "space-sm": "0.5rem", // 8
        "space-md": "0.75rem", // 12
        "space-lg": "1.25rem", // 20
        "space-xl": "2rem", // 32
        "margin-mobile": "1rem", // 16
        margin: "1.25rem", // 20
        "gutter-mobile": "0.75rem", // 12
        gutter: "1rem", // 16
        "nav-gap": "6.5rem",
      },

      maxWidth: {
        content: "1120px",
      },

      /**
       * Bo góc gần vuông. Trước đây là 20/28/32px — chính thứ tạo cảm giác
       * "app đồ ăn AI". Editorial giữ góc sắc để bố cục có cấu trúc.
       */
      borderRadius: {
        // Bo mềm. Trước đây là 4/6/8px ("gần vuông"); quy tắc đó thực ra chỉ
        // được áp dụng một nửa — code đã có sẵn 28 chỗ `rounded-2xl` và 73 chỗ
        // `rounded-full` viết tay, nên card vuông nằm cạnh nút viên thuốc là
        // lệch. Thang mới thống nhất với `rounded-2xl` (16px) đang dùng sẵn.
        "card-sm": "0.5rem", // 8px   — phần tử LỒNG trong card (ảnh, thumbnail)
        card: "1rem", // 16px  — thẻ món, ô tóm tắt
        "card-lg": "1.25rem", // 20px  — section nội dung lớn
        sheet: "1.5rem", // 24px  — sticky bar
      },

      /**
       * Đổ bóng: MỘT lớp tán mịn, nhuộm theo hue mực (`--shadow-rgb`).
       * Cấm bóng đen thuần trên nền sáng, và cấm chuỗi `shadow-[0_...rgba(...)]`
       * viết tay trong component — nó hardcode màu nên đổi palette là bóng lệch
       * màu ngay, đúng thứ vừa phải đi sửa ở đợt này.
       *
       * Dùng biến nên khi thêm dark mode, chỉ cần đổi `--shadow-rgb` là xong.
       */
      boxShadow: {
        nav: "0 -1px 0 0 rgb(var(--color-outline-variant)), 0 -4px 20px rgb(var(--shadow-rgb) / 0.05)",
        card: "0 4px 20px -4px rgb(var(--shadow-rgb) / 0.08), 0 1px 3px rgb(var(--shadow-rgb) / 0.04)",
        "card-hover": "0 14px 32px -6px rgb(var(--shadow-rgb) / 0.14), 0 2px 8px rgb(var(--shadow-rgb) / 0.06)",
        cta: "0 4px 14px -2px rgb(var(--shadow-rgb) / 0.25)",
        // Bóng đậm hơn cho CTA cuối phễu (nút "Đặt hàng ngay") — trước Phase 0
        // CheckoutPage.tsx tham chiếu token này mà nó chưa từng được khai, nên
        // nút quan trọng nhất app không có bóng nào cả.
        "cta-lg": "0 10px 28px -6px rgb(var(--shadow-rgb) / 0.3)",
        sheet: "0 -8px 30px rgb(var(--shadow-rgb) / 0.1), 0 -1px 0 rgb(var(--color-outline-variant))",
        // Bóng duy nhất nhuộm theo accent thay vì mực: badge giảm giá nổi trên
        // ảnh món, cần hơi nóng để tách khỏi ảnh.
        badge: "0 3px 10px -2px rgb(var(--color-primary-container) / 0.35)",
        lift: "0 6px 20px -2px rgb(var(--shadow-rgb) / 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
