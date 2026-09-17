# CLAUDE.md — SnackHub

## 1. Tổng quan dự án

**SnackHub** là ứng dụng web bán đồ ăn vặt, giao tận nơi trong nội bộ khuôn viên trường đại học (giao tới tòa nhà/tầng/phòng/lớp). Ưu tiên tuyệt đối trải nghiệm **Mobile** — phần lớn khách hàng đặt đơn bằng điện thoại giữa giờ học/giờ ra chơi.

**Người dùng:**
- **Khách hàng (Guest):** không cần đăng nhập. Xem danh mục, tùy biến món (add-ons), áp mã giảm giá, đặt giao nội khu, tra cứu đơn bằng mã đơn hàng, mua lại đơn cũ (1-click reorder).
- **Admin (1 vai trò duy nhất, full quyền):** quản lý danh mục/sản phẩm/mã giảm giá, xử lý đơn hàng theo trạng thái, in hóa đơn nhiệt, xem dashboard thống kê.

**Thanh toán:** PayOS (VietQR) hoặc COD (thanh toán khi nhận hàng).

**Giờ hoạt động:** chỉ nhận đơn **6:00 – 18:00**, chặn đặt đơn ngoài khung giờ này.

**Không có quản lý tồn kho theo số lượng** — chỉ có cờ "còn hàng / hết hàng tạm thời" (`is_available`) theo từng món.

---

## 2. Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS |
| State management | Zustand (middleware `persist` cho giỏ hàng) |
| Backend / BaaS | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions, `pg_cron`) |
| Thanh toán | PayOS (VietQR) |
| Deploy frontend | Netlify |
| Deploy backend logic | Supabase CLI (Edge Functions) — **tách biệt** quy trình deploy với Netlify |
| Validate runtime | Zod (bắt buộc cho Edge Function input & form) |

---

## 3. Quy tắc thiết kế

**Phong cách:** tối giản, "soft UI", nhiều khoảng trắng, thân thiện.

**Nguồn thiết kế:** project Stitch **"Snack Store App Design"** (`projects/3631875909009859337`) — 4 màn: Trang chủ, Chi tiết món, Giỏ hàng & Đặt hàng, Theo dõi đơn hàng. Dùng Stitch để đối chiếu **bố cục** khi dựng màn mới.

> **Stitch không còn là nguồn của bảng màu.** Bảng màu đã được thiết kế lại — chi tiết ở các gạch đầu dòng bên dưới và trong `tailwind.config.ts`. Khi màu trong Stitch khác tài liệu này, **tài liệu này đúng**.

> **`DESIGN.md` ("Fresh Snack Wave") là nguồn của HUE, không phải nguồn của cấu trúc.** Lấy từ file đó: hue nền xanh bơ, accent cam san hô, mực ánh rêu `#27332a`. **Bỏ qua** các mục "Elevation & Depth", "Shapes", "Components" của file đó — glassmorphism, `backdrop-filter`, coral-glow shadow, badge nghiêng 12°, gradient nút đều là thứ hướng editorial đã cố ý gỡ bỏ. Riêng **bo góc mềm thì đã nhận** — thang bo góc của dự án hiện là 8/16/20/24px, xem gạch đầu dòng "Bo góc mềm" bên dưới. Hai chỗ trong `DESIGN.md` **không** được dùng nguyên văn: prose khai `primary #ff7337` (chỉ 2.71:1 với chữ trắng, trượt AA) và `on-surface-variant #594139` (nâu ấm, lệch hue trên nền xanh).

**Hướng thiết kế: editorial, tiết chế — nhưng hình khối mềm.** Nền giấy ngả xanh bơ, mực ánh rêu, MỘT accent cam san hô duy nhất và chỉ dành cho giá tiền. Hai thứ cố ý loại bỏ vì tạo ra vẻ "app đồ ăn AI" chung chung: gradient trên nút, và đổ bóng nhiều tầng. Bo góc mềm thì **không** nằm trong danh sách loại bỏ nữa — xem hai gạch đầu dòng về bo góc và đổ bóng bên dưới.

- **Nền:** giấy ngả xanh bơ `#f1f5ef`, chroma cố tình hạ thấp hơn `#effdef` của `DESIGN.md` — bản gốc quá bạc hà, ảnh món đặt lên bị ám xanh. Card dùng `surface-container-lowest` (trắng) nổi lên bằng `shadow-card`, không viền.
- **Nút hành động chính: MỰC ÁNH RÊU phẳng** `bg-inverse-surface #27332a` + `text-inverse-on-surface` (11.96:1). **Không gradient.** Gradient chỉ còn tồn tại trong `ProductRail.tsx`.
- **Accent cam san hô `primary #a8431a` CHỈ dành cho GIÁ TIỀN và nhãn giảm giá.** Không dùng cho nút, không dùng trang trí. Màu càng hiếm thì càng có sức nặng — đây là điểm mấu chốt của hướng editorial.
- **`primary-container #d1461a` là MẢNG NỀN, không phải màu chữ.** Component ghép nó với `text-on-primary` (trắng) — xem `ProductCard.tsx:22`, `ProductRail.tsx:98`. Trần sáng của nó bị chặn bởi AA với chữ trắng (4.56:1), không phải bởi thẩm mỹ. Muốn sáng hơn thì phải đổi luôn màu chữ ở cả hai component.
- **Card: KHÔNG viền bao quanh, tách khỏi nền bằng bóng.** Vỏ card dùng `bg-surface-container-lowest` + `shadow-card`, **không** dùng `border border-outline-variant`. Bóng phải nhuộm hue nền (xanh ô liu `rgba(39,51,42,…)`), cấm bóng đen thuần trên nền sáng.
- **Viền `outline-variant` giờ chỉ dành cho CONTROL và đường kẻ mép**: ô nhập, pill danh mục, nút chọn option, nút icon tròn, và `border-t`/`border-b` của nav. Control cần cạnh để thấy được là bấm được — **đừng gỡ viền ở những chỗ này** khi dọn dẹp.
- **Hai token ngoài hệ M3**, chỉ phục vụ các dải khuyến mãi ở Trang chủ: `info #0b3a8e` (banner "Must Try", đi với `on-info` trắng) và `sale #ffd426` (badge giảm giá vàng đè lên ảnh món, đi với `on-sale #6b2a08`).
- **Màu phụ:** xanh lá `secondary #216d12` — **chỉ dùng cho trạng thái**: trạng thái đơn hàng, dấu tick, nhãn "còn hàng". Không dùng xanh lá để trang trí. Lưu ý nền cũng đã ngả xanh, nên xanh lá chỉ còn đọc ra là "trạng thái" khi nó đậm và bão hoà hơn nền — đừng làm nhạt nó đi.
- **Chip pastel** cho cặp "nhãn + giá trị": `secondary-fixed` bạc hà, `primary-fixed` đào, `tertiary-fixed` vàng bơ, `error-container` hồng. Chữ trên chip dùng token `on-*-fixed` tương ứng, **không** dùng chính màu chip làm màu chữ.
- **Tương phản là ràng buộc cứng:** mọi nền có chữ đè lên phải đạt tối thiểu **4.5:1** (WCAG AA). Với gradient, đo ở **đầu sáng nhất**. Với chip dùng opacity (`bg-secondary-fixed/50`, `bg-tertiary-fixed/70`), đo trên **màu đã trộn với nền**, không đo trên màu gốc. Đổi giá trị màu nào thì phải đo lại cặp nền/chữ của màu đó trước khi commit.
- **Số đo hiện hành** (đã chạy script, 29 cặp đều đạt): nút chính **11.96:1**, `on-surface #131e16` trên nền **15.55:1**, `on-surface-variant #5a685d` trên nền **5.33:1**, `primary` trên nền **5.47:1** / trên card trắng **6.03:1**, `primary-container` + trắng **4.56:1**, `secondary` + trắng **6.44:1**, `error #ba1a1a` + trắng **6.46:1**, `sale` + `on-sale` **7.50:1**, `info` + trắng **10.45:1**.
- **Tại sao accent không sáng đúng như bản tham chiếu:** cam `#ff7337` trong prose của `DESIGN.md` chỉ đạt **2.71:1** với chữ trắng và ~1.9:1 khi làm chữ trên nền giấy — trượt AA rất xa. Đã thay bằng sắc cam gần nhất còn đạt chuẩn: `primary #a8431a` = **5.47:1** trên nền, `primary-container #d1461a` = **4.56:1** với chữ trắng. Xanh dương `#0b3a8e` đạt **10.45:1** nên giữ nguyên. **Đừng "sửa lại cho sáng giống mẫu"** — làm vậy là phá chuẩn tiếp cận.
- **Giá gốc gạch ngang** phải dùng `on-surface-variant` (5.33:1), **không** dùng `outline` — `outline` trên nền trắng chỉ đạt ~2.5:1, đọc không ra.
- **Nhịp khoảng trắng:** mọi khoảng cách theo **bội số 4px**. Token `space-xs/sm/md/lg/xl` = 4/8/12/20/32px.
- **Bo góc mềm:** `rounded-card-sm` (**8px**), `rounded-card` (**16px**), `rounded-card-lg` (**20px**), `rounded-sheet` (**24px**). Thang cũ 4/6/8px đã bỏ: quy tắc "gần vuông" thực tế chỉ được áp dụng một nửa (code có sẵn 28 chỗ `rounded-2xl` và 73 chỗ `rounded-full` viết tay), nên card vuông nằm cạnh nút viên thuốc là lệch — phạm SHAPE CONSISTENCY LOCK. **Cấm giá trị tuỳ tiện** kiểu `rounded-[22px]`; dùng token.
- **Bán kính phần tử LỒNG trong card** = bán kính ngoài − padding. Ảnh/thumbnail trong vỏ card 16px với `p-2`…`p-3` dùng `rounded-card-sm` (8px), **không** dùng lại `rounded-card` — trùng bán kính với vỏ sẽ ra góc lệch tâm.
- **Đổ bóng:** chỉ dùng token `shadow-card`, `shadow-card-hover`, `shadow-cta`, `shadow-cta-lg`, `shadow-sheet`, `shadow-badge`, `shadow-nav`, `shadow-lift`. **Cấm** chuỗi `shadow-[0_...rgba(...)]` viết tay — nó hardcode màu accent nên đổi palette là bóng lệch màu ngay.
- **Định nghĩa palette riêng trong `tailwind.config`** — giữ nguyên hệ tên token Material Design 3 (`surface`, `on-surface-variant`, `primary-container`...). Đây là lý do đổi được cả bộ màu mà gần như không phải sửa component: component chỉ tham chiếu tên, không tham chiếu giá trị. Không dùng màu Tailwind mặc định trực tiếp trong component, luôn qua token.
- **Focus:** ô nhập nào tắt `outline` thì **bắt buộc** thay bằng `focus-visible:ring-2 focus-visible:ring-primary-container` (hoặc `focus-within:ring-2` nếu input nằm trong wrapper). Tắt outline mà không thay là lỗi tiếp cận.
- **Typography:** font `Plus Jakarta Sans`. Thang chữ M3 khai báo sẵn trong `tailwind.config`: `text-display-lg`, `text-headline-lg/md/sm`, `text-body-lg/md/sm`, `text-label-lg/md/sm/xs`. **Cấm** cỡ chữ tuỳ tiện kiểu `text-[10px]` — cỡ nhỏ nhất là `text-label-xs`.
- **Icon:** dùng `lucide-react`, **không** dùng Material Symbols icon font như bản Stitch — font đó tải nguyên bộ variable vài MB, quá nặng cho mạng di động trong trường.
- **Danh mục:** dạng pill icon tròn, cuộn ngang. Mục đang chọn có **vòng ring cam** bao quanh.
- **Sản phẩm:** ảnh bo góc lớn trên nền tô nhạt, badge giảm giá (%) nổi góc trên-trái, **không nghiêng**. Nút thêm vào giỏ nằm góc dưới-phải và phải là vùng bấm **tách biệt** khỏi vùng mở chi tiết món.
- **Mẫu "nhãn trên, giá trị dưới":** mọi cặp thông tin (Giá, Ngày đặt, Giao đến, Tổng cộng) trình bày nhãn nhỏ màu `on-surface-variant` ở trên, giá trị đậm ở dưới.
- **Responsive — mobile-first, phải chạy tốt cả trên web:**
  - Lưới món `grid-cols-2` → `md:grid-cols-3` → `lg:grid-cols-4`.
  - Nội dung mỗi trang bọc trong container căn giữa `max-w-content` (1120px). **Không** kéo dãn full màn trên desktop.
  - Bottom nav chỉ hiện trên mobile (`md:hidden`). Thanh nav ngang trên đầu trang cho desktop (`hidden md:flex`) nằm **trong chính** `src/components/BottomNav.tsx`, dùng lại đúng mảng `tabs` — không tạo component mới, không đổi hành vi điều hướng.
  - Sticky bar đáy (giỏ hàng, đặt hàng, thêm vào giỏ) chỉ `fixed` trên mobile; từ `md` trở lên nằm trong luồng nội dung hoặc cột phải.
  - Chi tiết món, giỏ hàng, đặt hàng trên desktop chia hai cột: nội dung trái, ảnh/tóm tắt tiền phải.
  - Vùng bấm tối thiểu **44x44px** ở mọi kích thước màn.
- **Sticky Add-to-Cart:** ghim nút "Thêm vào giỏ" + tổng tiền tạm tính ở mép dưới khi cuộn trang chi tiết món.
- **Loading state:** dùng skeleton `animate-pulse`, **không dùng spinner**.
- **Search:** debounce 300ms trước khi gọi API.
- **Typography:** tên món đậm, giá/mô tả nhạt, ưu tiên hình ảnh hơn chữ.
- **Ảnh sản phẩm:** lưu Supabase Storage, tối ưu WebP/responsive size (ưu tiên tải nhanh trên mạng di động).

**Cố ý khác bản Stitch — không "sửa lại cho giống":**
- Brand trong Stitch là "SnackPals", dự án dùng **SnackHub**.
- Màn theo dõi đơn của Stitch có tài xế, khoảng cách GPS, ETA phút và vòng tiến độ %. **Bỏ hết** — SnackHub chỉ có 1 vai trò Admin, không có shipper riêng, backend không có dữ liệu nào đổ vào các chỗ đó. Chỉ giữ timeline 4 trạng thái map thẳng vào enum `order_status`.
- Màn theo dõi đơn **phải bổ sung** nút "Hủy đơn" (chỉ hiện khi trạng thái là "Chờ xác nhận") và "Mua lại đơn" — bản Stitch không có.

---

## 4. Quy tắc bắt buộc (không được bỏ qua)

**Bảo mật:**
- Row Level Security (RLS) bật trên mọi bảng. Guest chỉ tạo/xem đơn qua **mã đơn hàng ngẫu nhiên** (`gen_random_uuid()`), tuyệt đối không dùng ID tăng dần làm mã tra cứu công khai.
- **Không bao giờ** đặt `SERVICE_ROLE_KEY` ở frontend. Mọi thao tác cần quyền cao (duyệt đơn, ghi nhận thanh toán) chỉ chạy trong Edge Function.
- Webhook PayOS: **bắt buộc verify chữ ký (HMAC)** trước khi xử lý, và **phải idempotent** (kiểm tra trạng thái đơn trước khi cập nhật, tránh xử lý trùng khi PayOS gửi lại webhook).
- CORS Supabase chỉ cho phép domain Netlify chính thức.
- Escape ký tự đặc biệt ở "Ghi chú giao hàng" trước khi hiển thị trên Admin Dashboard (chống XSS).
- Rate limit cho tạo đơn khách và áp mã giảm giá (chống spam đơn ảo / brute-force mã).
- Validate mọi input bằng Zod ở cả form phía client lẫn Edge Function — không tin tưởng type TypeScript compile-time.
- Admin dashboard: tự động đăng xuất sau thời gian không thao tác (session timeout) — vì chạy trên thiết bị dùng chung tại quầy.

**Logic nghiệp vụ:**
- Mã giảm giá: dùng atomic update `UPDATE ... SET used_count = used_count + 1 WHERE used_count < max_uses` để tránh vượt hạn mức khi nhiều khách dùng cùng lúc.
- Đơn hàng (`order_items`) phải lưu **snapshot** tên món/option/giá tại thời điểm đặt — không JOIN sống với bảng sản phẩm hiện tại (phục vụ đúng cho "Mua lại đơn cũ" và báo cáo doanh thu lịch sử).
- Giờ hoạt động 6:00–18:00 phải chặn ở **cả** frontend lẫn Edge Function (không tin frontend là đủ).
- Tìm kiếm: cột `products.search_text` đã lowercase **và bỏ dấu** (`immutable_unaccent`). Từ khoá phía client **bắt buộc** đi qua `normalizeSearch()` trong `src/lib/text.ts` trước khi `ilike` — chuẩn hoá một bên mà quên bên kia thì gõ có dấu sẽ ra 0 kết quả.
- Form đặt hàng có **hai** ô ghi chú ("Chi tiết địa chỉ" và "Ghi chú cho quán") nhưng `orders` chỉ có **một** cột `delivery_note`. Hai ô được ghép bằng `composeDeliveryNote()` trong `src/lib/checkoutSchema.ts` thành `"Địa chỉ: … | Ghi chú: …"`. Nếu sau này cần tách bạch để lọc/báo cáo thì mới thêm cột riêng.
- `src/lib/checkoutSchema.ts` là **bản sao** của `createOrderSchema` trong `supabase/functions/_shared/schemas.ts`. Sửa ràng buộc ở một bên phải sửa cả bên kia.
- Không quản lý tồn kho theo số lượng — chỉ dùng cờ `is_available` (boolean) để bật/tắt món "hết hàng tạm thời".
- Chỉ 1 vai trò Admin, full quyền — không tách Shipper/Kitchen.
- Khách chỉ được tự hủy đơn khi trạng thái đơn đang là **"Chờ xác nhận"**. Các trạng thái sau đó (Đang làm đồ / Đang giao / Hoàn tất) không cho khách hủy.
- `pg_cron` tự động hủy đơn thanh toán PayOS còn "treo" (pending) quá 15 phút.
- Khách **không** nhận được Realtime cho đơn hàng: Supabase Realtime tôn trọng RLS, mà `orders` chỉ có policy cho `authenticated`. Màn theo dõi đơn của khách phải **poll** lại `get_order_by_code`. Tuyệt đối không thêm policy SELECT cho `anon` trên `orders` chỉ để có realtime — làm vậy là mở toàn bộ đơn của mọi người. Realtime chỉ dùng cho Admin (đã đăng nhập).
- In hóa đơn nhiệt: dùng CSS `@media print` riêng cho khổ 80mm, phải test thực tế trên máy in trước khi coi là hoàn thành.

**Edge Functions:**
- Secret `ALLOWED_ORIGINS` **bắt buộc** phải set, nếu không mọi request từ trình duyệt đều bị trả `403 FORBIDDEN_ORIGIN`. Đặt tại Supabase Dashboard → Project Settings → Edge Functions → Secrets.
- Deploy qua Supabase MCP cần cấu trúc file phẳng (`./_shared/x.ts`), còn deploy qua Supabase CLI dùng cấu trúc trong repo (`../_shared/x.ts`). Cùng một mã nguồn, chỉ khác cách đóng gói — CLI là đường chính thức.

---

## 5. Workflow

**Môi trường:**
- Tách riêng Supabase project cho **dev/staging** và **production** — không test trực tiếp trên dữ liệu thật.
- Netlify preview deploy dùng biến môi trường riêng, không trỏ vào Supabase production.

**Deploy:**
- Frontend: deploy tự động qua Netlify khi push code.
- Edge Functions: deploy **riêng biệt** qua Supabase CLI (`supabase functions deploy`) — đây là bước dễ bị quên vì không nằm trong luồng deploy Netlify, phải chủ động deploy lại khi sửa Edge Function.

**Trước khi coi 1 tính năng là xong:**
- Test luồng chính trên mobile viewport thực tế (không chỉ resize trình duyệt desktop).
- Với các thay đổi liên quan thanh toán: test webhook PayOS bằng dữ liệu giả lập, xác nhận không xử lý trùng khi gọi webhook 2 lần.
- Với các thay đổi liên quan mã giảm giá/đơn hàng: kiểm tra race condition khi có 2 request đồng thời (ví dụ 2 tab cùng áp 1 mã giảm giá gần hết lượt).
- Với thay đổi giao diện Admin in hóa đơn: test in thử trên máy in nhiệt 80mm thật, không chỉ xem trên trình duyệt.
