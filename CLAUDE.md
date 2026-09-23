# CLAUDE.md — SnackHub

## 1. Tổng quan dự án

**SnackHub** là ứng dụng web bán đồ ăn vặt, giao tận nơi trong nội bộ khuôn viên trường đại học (giao tới tòa nhà/tầng/phòng/lớp). Ưu tiên tuyệt đối trải nghiệm **Mobile** — phần lớn khách hàng đặt đơn bằng điện thoại giữa giờ học/giờ ra chơi.

**Người dùng:**
- **Khách hàng (Guest):** không cần đăng nhập. Xem danh mục, tùy biến món (add-ons/toppings), áp mã giảm giá, đặt giao nội khu, tra cứu đơn bằng mã đơn hàng, mua lại đơn cũ (1-click reorder).
- **Admin (1 vai trò duy nhất, full quyền):** đăng nhập bằng tài khoản Supabase Auth, quản lý toàn diện qua bộ giao diện `/admin/*`:
  - **Tổng quan (`/admin/thong-ke`):** thống kê doanh thu, số lượng đơn, biểu đồ, đơn hàng mới nhất, chuông thông báo đơn mới.
  - **Xử lý đơn (`/admin/don-hang`):** cập nhật trạng thái đơn (Realtime), bộ lọc theo trạng thái, tích hợp hệ thống **Cảnh báo trễ hạn (SLA Alert)** với bộ đếm thời gian thực (đổi màu vàng/đỏ khi quá 15-20 phút và tự động ghim lên đầu danh sách ưu tiên), in hóa đơn nhiệt chuẩn 80mm.
  - **Thực đơn & Danh mục (`/admin/thuc-don`):** thêm/sửa món, bật/tắt còn hàng, tải ảnh lên Supabase Storage, quản lý danh mục.
  - **Thiết lập Combo (`/admin/combos`):** giao diện chuyên trách nhóm các món đơn lẻ từ bảng `combo_items` vào bảng `combos`, bổ sung cấu hình ảnh đại diện riêng, thiết lập giá ưu đãi tổng, tính toán mức tiết kiệm và quản lý trạng thái `is_available` / `is_featured` đồng bộ trực tiếp với `ComboRail` trên Frontend.
  - **Mã giảm giá (`/admin/khuyen-mai`):** cung cấp giao diện tạo mã định danh (Voucher/Coupon), thiết lập điều kiện áp dụng (loại giảm theo % hoặc số tiền cố định, giá trị đơn tối thiểu, mức giảm tối đa, thời hạn sử dụng) và kiểm soát giới hạn lượt dùng thực tế thông qua atomic update `used_count`.
  - **Topping & Tuỳ chọn (`/admin/toppings`):** quản lý nhóm option và danh sách topping đính kèm.
  - **Banner quảng cáo (`/admin/banner`):** thêm/sửa/xoá banner, tải ảnh, gán liên kết, thứ tự hiển thị và bật/tắt kích hoạt.
  - **Cài đặt quán (`/admin/cai-dat`):** đóng/mở quán thủ công, cấu hình khung giờ nhận đơn, phí giao hàng nội khu.

**Thanh toán:** PayOS (VietQR) hoặc COD (thanh toán khi nhận hàng).

**Giờ hoạt động:** chỉ nhận đơn **6:00 – 18:00** (hoặc theo cấu hình `store_settings`), tự động chặn đặt đơn ngoài khung giờ này ở cả Frontend lẫn Edge Function.

**Không có quản lý tồn kho theo số lượng** — chỉ có cờ "còn hàng / hết hàng tạm thời" (`is_available`) theo từng món và combo.

---

## 2. Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS (Material Design 3 Token System) |
| Animation | Motion (`motion/react`) |
| State management | Zustand (middleware `persist` cho giỏ hàng) |
| Backend / BaaS | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, `pg_cron`) |
| Thanh toán | PayOS (VietQR) |
| Deploy frontend | Netlify |
| Deploy backend logic | Supabase CLI (Edge Functions) — **tách biệt** quy trình deploy với Netlify |
| Validate runtime | Zod (bắt buộc cho Edge Function input & form) |

---

## 3. Quy tắc thiết kế & Cấu trúc giao diện

**Phong cách:** tối giản, editorial "soft UI", nhiều khoảng trắng, thân thiện, hình khối mềm.

**Bố cục Trang chủ (`HomePage`):**
1. **Header:** Địa chỉ giao hàng, avatar tài khoản đơn hàng, lời chào & trạng thái quán (`StoreHoursBadge`), thanh tìm kiếm (`SearchBar`), danh mục dạng pill cuộn ngang (`CategoryPills`).
2. **Trạng thái đóng cửa:** `StoreClosedBanner` (tự động hiện khi quán đang đóng cửa).
3. **Banner quảng cáo (`BannerRail`):** 
   - Lấy dữ liệu động từ bảng `banners` (do Admin quản lý).
   - Tích hợp **animation chuyển slide tự động** (4.5s), tự tạm dừng khi hover/chạm.
   - Hỗ trợ cử chỉ kéo/vuốt mượt mà (**drag/swipe**) trên mobile và desktop.
   - Chấm phân trang hoạt hoạ (**animated dots indicator**) và nút điều hướng khi hover trên desktop.
4. **Combo thả ga (`ComboRail`):** Đặt ngay TRÊN mục Món ăn vặt thịnh hành, hiển thị danh sách combo kèm các chip món con, giá ưu đãi và nút thêm nhanh vào giỏ.
5. **Món ăn vặt thịnh hành (`ProductGrid`):** Lưới món ăn phân theo danh mục đang chọn hoặc kết quả tìm kiếm.
6. **Các dải cuộn ngang (`ProductRail`):**
   - **FLASH SALE:** Món đang giảm giá (theo % hoặc theo số tiền cố định), sắp xếp theo mức giảm sâu nhất (quy đổi cả hai kiểu về cùng % hiệu dụng để so sánh).
   - **Must Try:** Món nổi bật do quán đánh dấu cờ `is_featured`.
   - **Ăn Ngon Rẻ:** Món có giá sau giảm thấp nhất.

**Quy tắc màu sắc & Token:**
- **Nền:** giấy ngả xanh bơ `#f1f5ef`. Card dùng `surface-container-lowest` (trắng) nổi lên bằng `shadow-card`, không viền.
- **Nút hành động chính:** MỰC ÁNH RÊU phẳng `bg-inverse-surface #27332a` + `text-inverse-on-surface` (11.96:1). **Không gradient.**
- **Accent cam san hô `primary #a8431a` CHỈ dành cho GIÁ TIỀN và nhãn giảm giá.** Không dùng cho nút, không dùng trang trí.
- **`primary-container #d1461a` là MẢNG NỀN, không phải màu chữ.** Ghép với `text-on-primary` (trắng).
- **Card: KHÔNG viền bao quanh, tách khỏi nền bằng bóng.** Vỏ card dùng `bg-surface-container-lowest` + `shadow-card`.
- **Viền `outline-variant`:** dành cho CONTROL và đường kẻ mép (ô nhập, pill danh mục, nút chọn option, nút icon tròn).
- **Màu phụ:** xanh lá `secondary #216d12` — **chỉ dùng cho trạng thái**: trạng thái đơn hàng, dấu tick, nhãn "còn hàng".
- **Chip pastel:** `secondary-fixed` bạc hà, `primary-fixed` đào, `tertiary-fixed` vàng bơ, `error-container` hồng.
- **Tương phản (WCAG AA):** tối thiểu **4.5:1** cho mọi văn bản thông thường.
- **Bo góc mềm:** `rounded-card-sm` (8px), `rounded-card` (16px), `rounded-card-lg` (20px), `rounded-sheet` (24px).
- **Đổ bóng:** dùng token `shadow-card`, `shadow-card-hover`, `shadow-cta`, `shadow-sheet`, `shadow-nav`...
- **Typography:** font `Plus Jakarta Sans`. Thang chữ M3: `text-display-lg`, `text-headline-*`, `text-body-*`, `text-label-*`.
- **Icon:** dùng `lucide-react`.

---

## 4. Quy tắc bắt buộc & Nghiệp vụ

**Bảo mật & Phân quyền:**
- Row Level Security (RLS) bật trên mọi bảng. Guest chỉ tra cứu đơn qua `order_code` (`gen_random_uuid()`).
- **Admin Authentication:** Xác thực thông qua Supabase Auth + kiểm tra phân quyền trong bảng `admins`. Phục vụ toàn bộ khu vực `/admin/*` qua `AdminLayout` và `useAdminSession`.
- **Không bao giờ** đặt `SERVICE_ROLE_KEY` ở frontend. Các tác vụ duyệt đơn / webhook chỉ chạy trong Edge Function.
- Webhook PayOS: verify chữ ký (HMAC) trước khi xử lý, đảm bảo idempotent.
- Escape ký tự đặc biệt ở "Ghi chú giao hàng" trước khi hiển thị trên Admin Dashboard (chống XSS).
- Rate limit cho tạo đơn khách và áp mã giảm giá.
- Validate mọi input bằng Zod ở cả form phía client lẫn Edge Function.

**Logic nghiệp vụ:**
- **Mã giảm giá:** atomic update `UPDATE ... SET used_count = used_count + 1 WHERE used_count < max_uses`.
- **Đơn hàng (`order_items`):** lưu **snapshot** tên món/option/giá tại thời điểm đặt.
- **Combo:** bảng `combos` + `combo_items`. Có giao diện hiển thị tại `ComboRail`, hỗ trợ giỏ hàng `kind: "combo"` và lưu snapshot danh sách món con trong `combo_items_snapshot`. Chặn đặt combo nếu combo hoặc bất kỳ món con nào bị tắt `is_available`.
- **Banners:** bảng `banners` (`id`, `title`, `image_url`, `link_url`, `is_active`, `display_order`). Quản trị trực tiếp tại `/admin/banners`, hiển thị với animation tại `BannerRail` trên Trang chủ.
- **Giờ hoạt động:** kiểm tra qua bảng `store_settings` hoặc khung giờ mặc định, chặn ở cả frontend lẫn Edge Function.
- **Tìm kiếm:** chuẩn hoá từ khoá không dấu (`normalizeSearch`) kết hợp `immutable_unaccent` trong Postgres.
- **In hóa đơn nhiệt:** `@media print` riêng cho khổ 80mm trong trang quản trị đơn hàng (`AdminOrdersPage`), tối ưu bố cục và thông tin món/combo/topping.
- **Realtime Admin:** Trang quản lý đơn hàng Admin lắng nghe kênh Supabase Realtime để cập nhật ngay lập tức khi có đơn mới phát sinh kèm âm thanh thông báo.

---

## 5. Workflow & Kiểm thử

**Môi trường:**
- Tách riêng Supabase project cho **dev/staging** và **production**.
- Netlify preview deploy dùng biến môi trường riêng.

**Deploy:**
- Frontend: deploy tự động qua Netlify khi push code.
- Edge Functions: deploy qua Supabase CLI (`supabase functions deploy`).

**Checklist trước khi hoàn tất tính năng:**
- Kiểm tra tính responsive trên mobile viewport thực tế.
- Kiểm tra animation và cử chỉ vuốt/chạm không gây xung đột với sự kiện click liên kết.
- Kiểm tra typecheck TypeScript (`npx tsc -b --noEmit`) không còn lỗi.
- Test webhook PayOS và kiểm tra xử lý trùng.
- Kiểm tra in hoá đơn nhiệt trên trình duyệt và thiết bị thực tế.
