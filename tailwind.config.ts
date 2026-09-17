import type { Config } from "tailwindcss";

/**
 * Design tokens của SnackHub.
 *
 * Giữ nguyên cách đặt tên Material Design 3 (surface / on-surface / primary-container...)
 * vì toàn bộ component đã dùng token ngữ nghĩa — đổi giá trị ở đây là cả app đổi da,
 * không phải sửa lại từng file.
 *
 * ── HƯỚNG THIẾT KẾ: editorial, tiết chế ────────────────────────────────────
 * Nền giấy ngả xanh bơ trung tính, mực ánh rêu, MỘT accent cam san hô duy nhất
 * và chỉ dành cho GIÁ TIỀN. Nút hành động chính dùng mực (`inverse-surface`),
 * không gradient.
 *
 * Cố ý loại bỏ vì chúng tạo ra vẻ "app đồ ăn AI" chung chung:
 *   1. gradient trên nút            -> nút phẳng màu mực
 *   2. đổ bóng nhiều tầng           -> MỘT lớp bóng tán mịn, nhuộm hue nền
 *
 * CARD: bo mềm 16px, KHÔNG viền bao quanh, tách khỏi nền bằng `shadow-card`.
 * Viền `outline-variant` giờ chỉ còn dành cho CONTROL (ô nhập, pill danh mục,
 * nút chọn option) và đường kẻ mép của nav — control cần cạnh để thấy bấm được.
 *
 * ── HUE: họ "Fresh Snack Wave" (DESIGN.md) ─────────────────────────────────
 * Hue lấy từ DESIGN.md, CẤU TRÚC giữ nguyên hướng editorial. Bảng cũ (giấy be
 * #f7f6f2 + mực #1a1714 + accent đỏ) rơi đúng vào họ hex bị cấm ở §4.2 của
 * skill design-taste-frontend ("warm paper + brass + espresso"), nên việc đổi
 * hue vừa theo DESIGN.md vừa gỡ được lỗi đó.
 *
 * DESIGN.md tự mâu thuẫn ở một chỗ và đây là cách xử lý: phần prose khai
 * Primary = #ff7337 đi với chữ trắng, nhưng cặp đó chỉ đạt 2.71:1 — trượt AA
 * rất xa. Component thực tế (ProductCard, ProductRail) ghép `bg-primary-container`
 * với `text-on-primary` (trắng), nên `primary-container` buộc phải đạt AA với
 * chữ trắng. Đã hạ xuống #d1461a (4.56:1). #ff7337 không xuất hiện trong bảng.
 *
 * ── TƯƠNG PHẢN: đã đo bằng script, không phải ước lượng ────────────────────
 *   inverse-surface #27332a + chữ #f1f5ef  = 11.96:1  (nút chính)
 *   primary         #a8431a + nền giấy      = 5.47:1   (giá tiền)
 *   primary-container #d1461a + chữ trắng   = 4.56:1   (badge %, dải khuyến mãi)
 *   on-surface      #131e16 + nền giấy      = 15.55:1  (chữ chính)
 *   on-surface-variant #5a685d + nền giấy   = 5.33:1   (chữ phụ)
 *   secondary       #216d12 + chữ trắng     = 6.44:1   (trạng thái)
 *   error           #ba1a1a + chữ trắng     = 6.46:1
 *   sale            #ffd426 + #6b2a08       = 7.50:1
 *
 * Mọi nền có chữ đè lên phải đạt tối thiểu 4.5:1 (WCAG AA) — đã kiểm 29 cặp,
 * gồm cả các chip dùng opacity (`bg-secondary-fixed/50`, `bg-tertiary-fixed/70`)
 * đo trên màu đã trộn với nền. Đổi giá trị nào thì phải đo lại cặp của giá trị
 * đó trước khi commit.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Nền & mặt phẳng: giấy ngả xanh bơ, chroma thấp ───────────────
        // Hue lấy từ `surface: #effdef` của DESIGN.md nhưng hạ mạnh độ bão hoà:
        // bản gốc quá bạc hà, ảnh món ăn đặt lên bị ám xanh. Ở mức này nền vẫn
        // đọc ra "xanh mát" mà mực và ảnh giữ đúng sắc.
        background: "#f1f5ef",
        surface: "#f1f5ef",
        "surface-bright": "#ffffff",
        "surface-dim": "#dfe6dd",
        "surface-variant": "#e7ede5",
        "surface-tint": "#27332a",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f7faf6",
        "surface-container": "#ecf1ea",
        "surface-container-high": "#e2e9e0",
        "surface-container-highest": "#d8e0d6",
        // Mực ánh rêu — nền của nút hành động chính. Thay mực nâu đen #1a1714
        // (nằm trong họ "espresso" bị §4.2 skill cấm) bằng #27332a của DESIGN.md.
        "inverse-surface": "#27332a",
        "inverse-on-surface": "#f1f5ef",

        // ── Chữ ──────────────────────────────────────────────────────────
        "on-background": "#131e16",
        "on-surface": "#131e16",
        // DESIGN.md khai #594139 (nâu ấm) cho token này — lệch hue khi đặt trên
        // nền xanh. Đã đổi sang xám ngả xanh cùng hue với nền, vẫn 5.33:1.
        "on-surface-variant": "#5a685d",
        // `outline` CHỈ dùng cho đường kẻ và viền, KHÔNG dùng làm màu chữ
        // (trên nền giấy chỉ đạt ~2.5:1, đọc không ra).
        outline: "#a9b3a7",
        "outline-variant": "#dde4db",

        // ── Primary: cam san hô — CHỈ dành cho GIÁ TIỀN và nhãn giảm giá ──
        // Không dùng cho nút. Nút chính là mực. Đây là điểm mấu chốt của hướng
        // editorial: màu càng hiếm thì càng có sức nặng.
        // Đây là sắc cam sáng nhất còn đọc được trên nền giấy (5.47:1). Cam
        // #ff7337 trong phần prose của DESIGN.md chỉ đạt 2.71:1 với chữ trắng
        // và ~1.9:1 khi làm chữ trên nền giấy — không dùng được, đừng khôi phục.
        primary: "#a8431a",
        "on-primary": "#ffffff",
        // Dùng làm MẢNG NỀN có chữ trắng đè lên (badge %, dải khuyến mãi), nên
        // trần sáng của nó bị chặn bởi AA với chữ trắng, không phải bởi thẩm mỹ.
        "primary-container": "#d1461a",
        "on-primary-container": "#ffffff",
        "primary-fixed": "#fbe2d6",
        "primary-fixed-dim": "#f2c9b5",
        "on-primary-fixed": "#7a2c08",
        "on-primary-fixed-variant": "#a8431a",
        "inverse-primary": "#ffb599",

        // ── Secondary: xanh lá — CHỈ dùng cho trạng thái ──────────────────
        secondary: "#216d12",
        "on-secondary": "#ffffff",
        "secondary-container": "#dcecd5",
        "on-secondary-container": "#14431a",
        "secondary-fixed": "#dcecd5",
        "secondary-fixed-dim": "#bcd9b2",
        "on-secondary-fixed": "#14431a",
        "on-secondary-fixed-variant": "#216d12",

        // ── Tertiary: ô liu — nhãn phụ, cảnh báo nhẹ ─────────────────────
        tertiary: "#675f2d",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#efeace",
        "on-tertiary-container": "#463f16",
        "tertiary-fixed": "#efeace",
        "tertiary-fixed-dim": "#d9d2ad",
        "on-tertiary-fixed": "#3d3712",
        "on-tertiary-fixed-variant": "#675f2d",

        // ── Lỗi ──────────────────────────────────────────────────────────
        // Đỏ thẫm, cố ý tách hue khỏi cam san hô để không lẫn với accent giá.
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        // ── Ngoài M3, chỉ phục vụ 4 dải khuyến mãi ở Trang chủ ───────────
        // Bốn dải đó cố ý giữ giọng ồn ào của mẫu ShopeeFood, tách khỏi ngôn
        // ngữ editorial của phần còn lại. Đây là quyết định có chủ đích.
        info: "#0b3a8e",
        "on-info": "#ffffff",
        sale: "#ffd426",
        "on-sale": "#6b2a08",
      },

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
       * Đổ bóng gần như bỏ hẳn. Phân tách bằng `border-outline-variant`.
       * Các token vẫn giữ TÊN để không phải sửa hàng loạt component, nhưng giá
       * trị đã hạ xuống mức gần như không thấy.
       */
      boxShadow: {
        nav: "0 -1px 0 0 #dde4db, 0 -4px 20px rgba(39, 51, 42, 0.05)",
        card: "0 4px 20px -4px rgba(39, 51, 42, 0.08), 0 1px 3px rgba(39, 51, 42, 0.04)",
        "card-hover": "0 14px 32px -6px rgba(39, 51, 42, 0.14), 0 2px 8px rgba(39, 51, 42, 0.06)",
        cta: "0 4px 14px -2px rgba(39, 51, 42, 0.25)",
        // Bóng đậm hơn cho CTA cuối phễu (nút "Đặt hàng ngay") — trước đây
        // CheckoutPage.tsx tham chiếu token này mà chưa từng được khai, nên
        // nút quan trọng nhất app không có bóng nào cả.
        "cta-lg": "0 10px 28px -6px rgba(39, 51, 42, 0.3)",
        sheet: "0 -8px 30px rgba(39, 51, 42, 0.1), 0 -1px 0 #dde4db",
        badge: "0 3px 10px -2px rgba(209, 70, 26, 0.35)",
        lift: "0 6px 20px -2px rgba(19, 30, 22, 0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
