# RUNBOOK — SnackHub

Tài liệu vận hành, quy trình làm việc và bảo trì cho SnackHub (web bán đồ ăn vặt, giao nội khu trường đại học).

> Quy ước: lệnh chạy từ thư mục gốc dự án. Không dán giá trị khoá bí mật vào tài liệu, ticket hay chat — chỉ ghi **tên** biến.

## Mục lục

1. [Workflow phát triển & deploy](#1-workflow-phát-triển--deploy)
2. [Vận hành hằng ngày qua `/admin/*`](#2-vận-hành-hằng-ngày-qua-admin)
3. [Bảo trì & xử lý sự cố](#3-bảo-trì--xử-lý-sự-cố)
4. [Phụ lục](#4-phụ-lục)

---

## 1. Workflow phát triển & deploy

### 1.1 Stack

| Lớp | Công nghệ |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript, Tailwind CSS 3 (token Material Design 3), Zustand, Zod, `motion/react`, `lucide-react` |
| Backend | Supabase: Postgres, Auth, Realtime, Storage, Edge Functions (Deno), `pg_cron` |
| Thanh toán | PayOS (VietQR) hoặc COD — bật/tắt theo hình thức đặt ở `/admin/cai-dat` (mục 2.3) |

### 1.2 Chạy local

```bash
npm install
# tạo .env.local (xem mục 3.5), sau đó:
npm run dev          # Vite dev server
npm run typecheck    # npx tsc -b --noEmit — phải sạch lỗi trước khi commit
npm run build        # tsc -b && vite build -> dist/
npm run preview      # xem thử bản build
```

Quy tắc khi sửa giao diện:

- Dùng token Tailwind sẵn có (màu, `rounded-card*`, `shadow-card*`, thang chữ M3) thay vì mã màu/pixel viết cứng. Chi tiết quy tắc màu: `CLAUDE.md` mục 3; giá trị màu thật nằm ở khối `:root` của `src/index.css`.
- Ưu tiên **mobile**: kiểm tra trên viewport điện thoại thật trước khi coi là xong.
- Kiểm tra cử chỉ vuốt/kéo (ví dụ `BannerRail`) không làm hỏng click vào liên kết.
- Mọi input phải validate bằng Zod (form phía client và Edge Function).
- Kiểm tra tương phản tối thiểu 4.5:1 (có script `scripts/contrast.mjs`).

### 1.3 Môi trường Supabase — tách biệt dev/staging và production

Mỗi môi trường dùng **một Supabase project riêng**, có URL, anon key, secrets Edge Function và dữ liệu riêng. Không dùng chung project cho dev và production.

| Môi trường | Project Supabase | Biến frontend | Secrets Edge Function |
|---|---|---|---|
| Local / dev / staging | project dev | `.env.local` | đặt bằng `supabase secrets set` trên project dev |
| Production (Tenten) | project production | giá trị có mặt **lúc build** (xem 1.4) | đặt trên project production |

Trạng thái hiện tại của repo: [supabase/config.toml](supabase/config.toml) đang trỏ `project_id` tới **một** project. Trước khi chạy bất kỳ lệnh `supabase` nào, xác nhận đang trỏ đúng môi trường:

```bash
supabase projects list            # xem danh sách project
supabase link --project-ref <ref> # trỏ sang đúng project cần thao tác
```

Với PayOS: dev/staging nên dùng bộ khoá thử nghiệm riêng và webhook URL riêng; production dùng bộ khoá thật. Mỗi project Supabase có URL webhook riêng (`https://<ref>.supabase.co/functions/v1/payos-webhook`).

### 1.4 Deploy Frontend

Frontend chạy trên **Tenten Vibe Code Hosting** (Plesk + Passenger/Node). Push lên GitHub **không** tự deploy lên đây; phải đưa bản build mới lên hosting theo quy trình dưới.

[server.js](server.js) là điểm vào của hosting: static server tối giản (không thêm dependency) phục vụ thư mục `dist/`, chạy bằng `npm start` (cổng lấy từ `PORT`, mặc định 3000). Nó cũng làm **SPA fallback** — mọi route không khớp file thật trả về `index.html`, bắt buộc vì PayOS returnUrl, deep-link `/admin/...`, `/don-hang/:code` đều là full page load. `index.html` luôn `no-cache`; file JS/CSS có hash trong tên nên cache dài hạn (`immutable`).

Quy trình phát hành:

1. Chạy `npm run typecheck` rồi `npm run build` với đúng biến môi trường production (xem bên dưới).
2. Đưa `dist/` mới (cùng `server.js`) lên hosting theo cách quán đang dùng (Git trong Plesk, hoặc upload).
3. Khởi động lại ứng dụng Node trong Plesk nếu `server.js` hoặc `package.json` đổi (chỉ đổi nội dung `dist/` thì không cần).
4. Kiểm tra: mở trang chủ, tải lại thẳng một route sâu (ví dụ `/admin/don-hang`) — phải ra giao diện chứ không 404; kiểm tra bản mới đã lên (hash file trong `dist/assets` đổi).

Biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` được **đóng gói vào bundle lúc build**, không đọc lúc chạy. Vì vậy phải build với giá trị của **project production** (ví dụ `.env.production` cục bộ, không commit), nếu không bản lên hosting sẽ trỏ nhầm sang project dev. Đổi project hoặc đổi khoá = build lại và phát hành lại.

Thư mục `dist/` **đang được track trong git** dù có trong `.gitignore` (file đã add từ trước), nên đây có thể chính là cách bản build lên hosting. Hệ quả: `npm run build` cục bộ làm `git status` hiện hàng chục file `dist/` đổi/xoá, và hash file thay đổi mỗi lần build.

- Chỉ sửa code mà chưa định phát hành: chạy `git checkout -- dist/` trước khi commit để diff không lẫn artifact.
- Phát hành: build bằng biến production, commit `dist/` **trong commit riêng** (ví dụ `chore(deploy): build production`), rồi đưa lên hosting.
- Chưa gỡ track `dist/` (`git rm -r --cached dist/`) khi chưa xác nhận hosting không lấy `dist/` từ git.

### 1.5 Deploy Backend (Edge Functions + migration) — tách biệt khỏi hosting frontend

Đưa bản build frontend lên hosting **không** deploy backend. Edge Functions và migration phải deploy riêng bằng Supabase CLI.

Các function hiện có (cấu hình `verify_jwt` trong [supabase/config.toml](supabase/config.toml)):

| Function | `verify_jwt` | Vai trò |
|---|---|---|
| `create-order` | true | Tạo đơn: kiểm tra giờ mở cửa, giá, mã giảm giá, rate limit |
| `apply-discount` | true | Kiểm tra/áp mã giảm giá, có rate limit |
| `cancel-payment` | true | Khách bỏ thanh toán PayOS |
| `payos-webhook` | **false** | Nhận webhook PayOS; bảo mật bằng chữ ký HMAC trong body |
| `create-staff-account` | true | Tạo tài khoản nhân viên; tự kiểm tra `is_admin()` của người gọi |

```bash
supabase link --project-ref <ref>              # trỏ đúng môi trường
supabase functions deploy payos-webhook        # deploy 1 function
supabase functions deploy                      # deploy tất cả
supabase secrets set PAYOS_CHECKSUM_KEY=...    # đặt secret (xem 3.5)
supabase db push                               # áp migration trong supabase/migrations/
```

Quy trình đổi schema:

1. Tạo file mới `supabase/migrations/<yyyymmddhhmmss>_<ten_thay_doi>.sql` (thêm vào, **không sửa** migration đã áp dụng).
2. Áp lên dev/staging, thử luồng thật.
3. Áp lên production sau khi dev đã ổn.
4. Nếu đổi bảng/cột: cập nhật `src/types/database.ts` (hoặc sinh lại bằng `supabase gen types typescript`).

### 1.6 Checklist trước khi hoàn tất một tính năng

- [ ] `npm run typecheck` không lỗi; `npm run build` thành công
- [ ] Kiểm tra mobile viewport thật; animation/vuốt không cản click
- [ ] Nếu đụng Edge Function: đã `supabase functions deploy` đúng môi trường
- [ ] Nếu đụng webhook PayOS: đã chạy kiểm tra gửi trùng (mục 3.1)
- [ ] Nếu đụng bảng mới: đã bật RLS và viết policy (mục 3.2)
- [ ] Nếu đụng in hoá đơn (khi tính năng đã phát triển): đã in thử trên trình duyệt và thiết bị thật (mục 2.4)
- [ ] Nếu phát hành frontend: đã build bằng biến production và kiểm tra route sâu trên Tenten (mục 1.4)

---

## 2. Vận hành hằng ngày qua `/admin/*`

Đăng nhập bằng tài khoản Supabase Auth; quyền được kiểm tra qua bảng `admins` (và `staff_profiles` cho nhân viên) bởi `AdminLayout` + `useAdminSession`. Hàm DB `is_admin()` công nhận admin/superadmin, `is_staff()` dành cho thao tác đơn hàng và chấm công.

| Đường dẫn | Chức năng |
|---|---|
| `/admin/thong-ke` | Doanh thu, số đơn, biểu đồ, tỷ lệ trễ SLA |
| `/admin/don-hang` | Xử lý đơn, SLA Alert |
| `/admin/thuc-don` | Món và danh mục, bật/tắt phục vụ, ảnh |
| `/admin/combos` | Combo (giá ưu đãi, ảnh, nổi bật) |
| `/admin/khuyen-mai` | Mã giảm giá |
| `/admin/toppings` | Nhóm tuỳ chọn và topping |
| `/admin/banner` | Banner trang chủ |
| `/admin/cai-dat` | Đóng/mở quán, giờ nhận đơn, phí giao |
| `/admin/nhan-su`, `/admin/ca-lam`, `/admin/lich-cua-toi`, `/admin/cham-cong` | Nhân sự, ca làm, chấm công |

### 2.1 Xử lý đơn hàng realtime

Luồng trạng thái chuẩn:

```
Chờ xác nhận ──> Đang chuẩn bị ──> Đang giao ──> Hoàn tất
      └──────────────── Huỷ (kèm lý do) ────────────────┘
```

Thao tác tại `/admin/don-hang`:

1. Đơn mới tự xuất hiện (Realtime), có chuông và badge đếm đơn chờ. Trình duyệt chỉ cho phát âm sau khi người dùng bấm bật âm một lần; lựa chọn được nhớ trong trình duyệt. Chuông chạy xuyên suốt mọi trang `/admin/*` vì được mount ở `AdminLayout`.
2. Bấm nút hành động trên đơn: **Xác nhận đơn** → **Bắt đầu giao** → **Hoàn tất đơn**. Dùng bộ lọc trạng thái để thu hẹp danh sách.
3. Quy tắc cần nhớ:
   - **Đơn PayOS**: khi tiền về (webhook), đơn tự nhảy sang *Đang chuẩn bị*, không cần bấm xác nhận. Âm báo của đơn online chỉ phát lúc thanh toán thành công, không phát lúc tạo đơn.
   - **Đơn COD** (đơn tại quầy trả tiền mặt, hoặc đơn giao khi quán đang bật COD cho giao tận nơi): phát âm ngay khi đặt. Phải xác nhận **đã thu tiền** thì mới chuyển được sang *Hoàn tất* — nếu chưa, hệ thống từ chối với thông báo "Đơn chưa xác nhận thanh toán".
   - Đơn COD đã có người nhận giao: chỉ người đó hoặc admin được xác nhận thu tiền.
   - Đơn PayOS treo chưa thanh toán quá `payos_hold_minutes` sẽ bị hệ thống tự huỷ.
4. **Khách tự cập nhật**: mọi lần Admin đổi trạng thái, trigger DB `orders_stamp_status()` phát broadcast `status_changed` trên kênh `order:<mã đơn>`; trang `/don-hang/:mã` của khách cập nhật ngay, không cần tải lại (vẫn có poll 20 giây làm lưới an toàn khi mất kết nối).
5. Ghi chú giao hàng do khách nhập luôn được escape trước khi hiển thị — không dán HTML thô vào giao diện.

### 2.2 Cảnh báo trễ hạn (SLA Alert)

Bộ đếm tính từ `created_at` cho mọi đơn chưa hoàn tất/chưa huỷ:

| Thời gian trôi qua | Mức | Hiển thị |
|---|---|---|
| < 15 phút | Bình thường | `Xp` |
| 15 – 19 phút | Cảnh báo (vàng) | `Xp · Sắp trễ` |
| ≥ 20 phút | Nghiêm trọng (đỏ) | `Xp · Trễ SLA` |

Đơn trễ được ghim lên đầu danh sách; có thanh cảnh báo tổng ở đầu trang và bộ lọc **⚠️ Trễ hạn SLA**. Trong nhóm theo toà nhà, thứ tự ưu tiên SLA được giữ nguyên. `/admin/thong-ke` hiển thị **Tỷ lệ trễ SLA**. Ngưỡng hiện đặt cứng trong code `AdminOrdersPage.tsx` (15/20 phút); muốn đổi phải sửa code và deploy lại frontend.

Cách xử lý đơn đỏ: mở đơn → xác định đang kẹt ở bước nào → đẩy trạng thái tiếp; nếu không giao được, liên hệ khách theo số điện thoại trên đơn và huỷ kèm lý do.

### 2.3 Đóng/mở quán và giờ nhận đơn — `/admin/cai-dat`

Cấu hình trong bảng `store_settings` (một dòng, `id = 1`):

| Trường | Ý nghĩa |
|---|---|
| `is_open` | Công tắc đóng/mở thủ công |
| `open_time`, `close_time` | Khung giờ nhận đơn (mặc định 6:00 – 18:00) |
| `timezone` | Múi giờ dùng để tính giờ mở cửa và thống kê chấm công |
| `shipping_fee` | Phí giao nội khu |
| `min_order_amount` | Giá trị đơn tối thiểu |
| `payos_hold_minutes` | Thời gian giữ đơn PayOS chưa thanh toán |
| `open_override_until` | Nút "Mở quán nhận đơn ngay": nhận đơn bất kể khung giờ tới mốc này (tự hết hạn cuối ngày) |
| `delivery_payos_enabled`, `delivery_cod_enabled` | Phương thức thanh toán cho đơn giao tận nơi (mặc định chỉ PayOS) |
| `in_store_payos_enabled`, `in_store_cod_enabled` | Phương thức thanh toán cho đơn đặt tại quầy (mặc định cả hai) |

Phương thức thanh toán bật/tắt ở khối **Phương thức thanh toán**, bấm là lưu. Mỗi hình thức đặt phải còn ít nhất 1 phương thức (DB có CHECK chặn). Khi PayOS gặp sự cố, tạm bật COD cho đơn giao tận nơi rồi tắt lại khi PayOS ổn.

Ngoài khung giờ hoặc khi tắt `is_open`, trang chủ hiện `StoreClosedBanner` và Edge Function `create-order` cũng từ chối đơn mới (chặn ở cả hai lớp, không chỉ giao diện). Nếu quán đóng bất thường, tắt `is_open` ngay.

Với món/combo tạm ngưng phục vụ: bật/tắt `is_available` ở `/admin/thuc-don` hoặc `/admin/combos`. Combo bị chặn đặt nếu chính nó hoặc bất kỳ món con nào đang tắt.

### 2.4 In hoá đơn nhiệt 80mm

Yêu cầu theo thiết kế: `@media print` riêng cho khổ 80mm trên `AdminOrdersPage`, hiển thị đủ món, combo, topping.

> **Trạng thái: chưa phát triển.** Chức năng in hoá đơn đang nằm trong kế hoạch, sẽ hoàn thiện sau; hiện chưa có `@media print` hay `window.print` trong code. Quy trình dưới đây áp dụng **sau khi** tính năng ra mắt.

Quy trình in:

1. Mở đơn → bấm in; trong hộp thoại in chọn đúng máy in nhiệt, khổ giấy **80mm**, lề **None/Tối thiểu**, tắt Headers and footers, tỷ lệ 100%.
2. In thử một đơn có combo + topping + ghi chú dài để kiểm tra không bị cắt dòng.
3. Kiểm tra trên **thiết bị và trình duyệt thật** mà quán đang dùng (kết quả xem trước trên máy dev không đủ).

### 2.5 Quản lý mã giảm giá — `/admin/khuyen-mai`

Tạo mã với: loại giảm (**%** hoặc **số tiền cố định**), giá trị giảm, giá trị đơn tối thiểu, mức giảm tối đa (với loại %), thời hạn, giới hạn lượt dùng `max_uses`.

Cơ chế đếm lượt dùng (chống vượt giới hạn khi nhiều khách đặt cùng lúc):

- Khi tạo đơn, `create-order` gọi RPC `redeem_discount_code`, thực hiện **atomic update**:
  `UPDATE ... SET used_count = used_count + 1 WHERE used_count < max_uses`
  Không có dòng nào được cập nhật nghĩa là mã đã hết lượt (hoặc hết hạn/chưa đủ điều kiện) và đơn bị từ chối với `DISCOUNT_INVALID`.
- Nếu tạo đơn thất bại giữa chừng, `release_discount_code` trả lại lượt đã giữ (rollback).
- `apply-discount` chỉ để khách xem trước mức giảm và có rate limit; lượt chỉ thật sự bị trừ khi đơn được tạo.

Vận hành:

- **Không tự sửa `used_count` bằng tay** trừ khi đang xử lý sự cố; nếu buộc phải sửa, làm trong một câu lệnh SQL duy nhất và ghi lại lý do.
- Muốn dừng mã: tắt kích hoạt/đặt hết hạn thay vì xoá, để đơn cũ vẫn tra được `discount_code` snapshot.
- Khách báo "mã không dùng được": kiểm tra theo thứ tự — còn hạn? đã đủ giá trị tối thiểu? `used_count` đã chạm `max_uses`? mã có đang kích hoạt?

---

## 3. Bảo trì & xử lý sự cố

### 3.1 Sự cố webhook PayOS

**Cách hoạt động** ([supabase/functions/payos-webhook/index.ts](supabase/functions/payos-webhook/index.ts)), theo thứ tự:

1. Verify chữ ký **HMAC-SHA256** bằng `PAYOS_CHECKSUM_KEY` trên các key của `data` sắp xếp theo alphabet (`key=value` nối bằng `&`). Sai chữ ký → trả 401 và **không đọc payload**. So sánh dùng timing-safe.
2. Chốt idempotent: ghi `payos_webhook_events` với `event_hash` UNIQUE; gửi trùng → trả `already processed`.
3. Kiểm tra trạng thái đơn; đơn đã `paid` thì bỏ qua.
4. Đối chiếu số tiền nhận với `total_amount`.
5. Cập nhật `paid` (webhook luôn thắng dù khách vừa bấm quay lại làm đơn bị `cancelled`), đơn nhảy sang *Đang chuẩn bị*, rồi phát broadcast `paid` cho trang QR của khách.
6. Luôn trả 200 cho các trường hợp "đã xử lý rồi" để PayOS ngừng retry.

**Khách đã chuyển tiền nhưng đơn vẫn "chờ thanh toán"** — kiểm tra lần lượt:

1. Dashboard PayOS: giao dịch có thật không, webhook URL đã đăng ký đúng project (đúng `<ref>`) chưa, PayOS báo gửi thành công hay lỗi.
2. Log Edge Function `payos-webhook` (Supabase Dashboard → Edge Functions → Logs, hoặc công cụ log của MCP/CLI):
   - `payos_webhook_bad_signature` → `PAYOS_CHECKSUM_KEY` trên Supabase không khớp khoá trên PayOS (đúng kênh/đúng môi trường?). Sửa secret rồi để PayOS gửi lại.
   - Không có log nào → URL webhook sai, hoặc function chưa deploy; chạy `supabase functions deploy payos-webhook`. Function này phải giữ `verify_jwt = false` (PayOS không gửi JWT).
3. Bảng `payos_webhook_events`: tìm theo `payos_order_code`. Có dòng → webhook đã tới; xem cột xử lý/lỗi để biết dừng ở bước nào (lệch số tiền? đơn không tồn tại?).
4. Lệch số tiền: đối chiếu `orders.total_amount` với số tiền thực nhận; chỉ xác nhận thủ công khi đã kiểm tra sao kê.
5. Xác nhận thủ công: ở `/admin/don-hang`, dùng nút xác nhận đã thanh toán sau khi đối soát giao dịch ngân hàng.

**Kiểm tra gửi trùng** (sau khi sửa code webhook): dùng [scripts/test-payos-webhook.ts](scripts/test-payos-webhook.ts):

```bash
# cần PAYOS_CHECKSUM_KEY và FUNCTIONS_URL trong môi trường (KHÔNG commit giá trị)
deno run --allow-net --allow-env scripts/test-payos-webhook.ts <payos_order_code>
```

Kỳ vọng: lần 1 → `ok`; lần 2 → `already processed`; đơn chỉ chuyển `paid` đúng một lần. Chỉ chạy với đơn thử trên **môi trường dev**.

**Xoay khoá PayOS**: tạo khoá mới trên PayOS → `supabase secrets set` cho cả `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` → redeploy `create-order`, `cancel-payment`, `payos-webhook` → thử một giao dịch nhỏ.

### 3.2 Chỉnh sửa chính sách bảo mật RLS

Nguyên tắc: **RLS bật trên mọi bảng**; bảng mới không có policy nghĩa là không ai đọc/ghi được (an toàn mặc định). Không bao giờ tắt RLS để "cho chạy tạm".

Phân quyền hiện có (ví dụ):

- `orders`, `order_items`: policy `*_staff_select` / `*_staff_update` cho nhân viên; admin qua `is_admin()`.
- `staff_profiles`, `time_logs`, `payroll_history`, `shifts`, `shift_assignments`, `shift_swap_requests`: policy theo admin / chính chủ.
- **Khách vãng lai không có policy SELECT trên `orders`.** Họ chỉ truy cập đơn qua các RPC kiểm soát bằng mã đơn (mục 3.3).

Quy trình sửa policy:

1. Xem policy hiện tại:
   ```sql
   select schemaname, tablename, policyname, cmd, qual, with_check
   from pg_policies where tablename = 'orders';
   ```
2. Viết thay đổi thành **migration mới** (`drop policy if exists ...; create policy ...`) — không sửa trực tiếp trên production qua giao diện mà không lưu lại migration.
3. Thử bằng ít nhất 3 vai trò: **anon** (khách), **nhân viên** (`is_staff()`), **admin** (`is_admin()`); xác nhận anon vẫn *không* đọc được `orders`.
4. Chạy kiểm tra cảnh báo bảo mật của Supabase (Advisors → Security) sau mỗi lần đổi.
5. Với hàm `security definer`, luôn đặt `set search_path` cố định (như `orders_stamp_status`) và kiểm tra quyền bên trong hàm.

### 3.3 Tra cứu đơn bằng mã đơn (UUID)

Khách chỉ xem được đơn khi **biết mã đơn** (`order_code`, sinh bằng `gen_random_uuid()`, hiển thị dạng `SH-XXXXXXXXXX`). Không có cách tra theo số điện thoại phía khách (cố ý, để tránh lộ đơn người khác).

- Trang khách: `/don-hang` (nhập mã) và `/don-hang/:orderCode`.
- Kỹ thuật: RPC `get_order_by_code(p_order_code)` và `cancel_order_by_code(p_order_code)` (chuẩn hoá `trim().toUpperCase()`); `cancel_order_by_code` chỉ huỷ được khi đơn còn *Chờ xác nhận*.
- Realtime cho khách là **Broadcast công khai** trên kênh `order:<mã đơn>` (sự kiện `paid`, `status_changed`) vì anon không dùng được Postgres Changes. Mô hình bảo mật: biết mã đơn mới nghe được. Payload chỉ chứa mã đơn và trạng thái, **không** đưa dữ liệu cá nhân vào broadcast.

Khách mất mã đơn: Admin tìm đơn ở `/admin/don-hang` (tìm theo số điện thoại) và gửi lại mã qua kênh liên hệ đã xác minh.

Tra cứu nhanh trong SQL (dev hoặc khi điều tra, quyền service/admin):

```sql
select id, order_code, status, payment_method, payment_status, total_amount, created_at
from public.orders
where order_code = 'SH-XXXXXXXXXX';
```

### 3.4 Rate limit

`create-order`, `apply-discount`, `cancel-payment` gọi RPC `check_rate_limit` với **hash của IP** (không lưu IP thô). Khách bị chặn nhầm (nhiều người dùng chung wifi trường): kiểm tra bảng/log rate limit, nới ngưỡng bằng migration hoặc xoá dòng đếm của IP bị ảnh hưởng; ghi lại việc đã làm.

### 3.5 Quản lý biến môi trường & bí mật an toàn

**Frontend** (`.env.local` khi dev; `.env.production` hoặc biến môi trường tại thời điểm build khi phát hành lên Tenten) — chỉ chứa giá trị **công khai theo thiết kế**:

| Biến | Ghi chú |
|---|---|
| `VITE_SUPABASE_URL` | URL project |
| `VITE_SUPABASE_ANON_KEY` | Khoá anon/publishable; an toàn để lộ vì mọi truy cập bị RLS chặn |

Mọi biến `VITE_*` bị đóng gói vào bundle trình duyệt — **tuyệt đối không** đặt khoá bí mật vào đây.

**Edge Function** (đặt bằng `supabase secrets set`, không nằm trong repo):

| Secret | Dùng cho |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Tác vụ quyền cao trong function (duyệt đơn, webhook). **Chỉ** ở Edge Function; không bao giờ ở frontend, log, hay tài liệu |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | Gọi PayOS và verify chữ ký webhook |
| `ALLOWED_ORIGINS` | CORS: danh sách origin được gọi function (đổi domain/preview thì cập nhật) |
| `PUBLIC_SITE_URL` | URL site dùng làm returnUrl/cancelUrl của PayOS (đúng theo từng môi trường) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` do Supabase tự cấp cho function.

Quy tắc:

- `.env.local` không được commit. Trước mỗi lần commit, xem lại `git status`/`git diff` để chắc không có khoá.
- Liệt kê tên secret đã đặt: `supabase secrets list` (không hiện giá trị).
- Nghi ngờ lộ khoá: **xoay ngay** (Supabase: tạo lại service role/JWT secret theo hướng dẫn của Supabase; PayOS: tạo khoá mới), cập nhật secrets, redeploy function, rồi kiểm tra log truy cập bất thường.
- Chỉ người có trách nhiệm vận hành mới có quyền xem/sửa secrets production; mỗi môi trường một bộ khoá riêng.

### 3.6 Bảng tra nhanh sự cố

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| Khách không đặt được, báo ngoài giờ | `is_open = false` hoặc ngoài `open_time`–`close_time` | Kiểm tra `/admin/cai-dat` |
| Khách không thấy COD / báo "Quán đang tạm tắt..." | Phương thức đó đang tắt cho hình thức đặt này | Khối Phương thức thanh toán ở `/admin/cai-dat` |
| Khách không thấy trạng thái đổi | Mất kết nối Realtime; trigger chưa áp migration `..._broadcast_order_status_changed` | Poll 20 giây vẫn bù; kiểm tra migration đã áp đúng project |
| Admin không nghe chuông | Chưa bấm bật âm, trình duyệt chặn autoplay | Bật âm một lần trong giao diện admin |
| Bấm "Hoàn tất" báo chưa thanh toán | Đơn COD chưa xác nhận thu tiền | Xác nhận đã thu tiền trước |
| Bấm "Bắt đầu giao" lỗi | Trigger gắn `assigned_staff_id` với tài khoản không có hồ sơ nhân viên | Đã vá ở migration `..._fix_delivering_assigned_staff_fk`; kiểm tra migration đã áp |
| `/admin/...` hoặc `/don-hang/...` 404 khi tải lại trang | App Node trên Plesk không chạy `server.js` (thiếu SPA fallback) | Kiểm tra Passenger/Node trong Plesk trỏ đúng `server.js`, khởi động lại app |
| Sau phát hành giao diện vẫn bản cũ | Chưa đưa `dist/` mới lên, hoặc cache trình duyệt/CDN giữ `index.html` | Kiểm tra hash trong `dist/assets`; `server.js` đã gửi `no-cache` cho `index.html`, nên xoá cache CDN nếu có |
| Bản production trỏ nhầm project Supabase | Build bằng biến của dev | Build lại với biến production rồi phát hành lại |
| Function trả 401/403 | Sai loại JWT (anon vs đã đăng nhập), hoặc `verify_jwt` cấu hình sai | Đối chiếu bảng ở mục 1.5 |
| Lỗi CORS khi gọi function | `ALLOWED_ORIGINS` thiếu origin hiện tại | Cập nhật secret, không cần redeploy frontend |

---

## 4. Phụ lục

### 4.1 Lệnh hay dùng

```bash
npm run dev | typecheck | build | preview | start
supabase link --project-ref <ref>
supabase functions deploy [<ten-function>]
supabase functions logs <ten-function>      # nếu CLI bản đang dùng hỗ trợ
supabase secrets list
supabase db push
```

### 4.2 Bản đồ mã nguồn

| Việc | Vị trí |
|---|---|
| Khai báo route | `src/App.tsx` |
| Trang Admin | `src/pages/admin/` |
| Truy vấn Admin / khách | `src/lib/adminQueries.ts`, `src/lib/queries.ts` |
| Realtime cho Admin (chuông, badge) | `src/hooks/useOrderNotification.ts` |
| Theo dõi đơn của khách | `src/pages/OrderTrackingPage.tsx` |
| Edge Functions | `supabase/functions/` (dùng chung: `_shared/`) |
| Migration | `supabase/migrations/` |
| Cấu hình function | `supabase/config.toml` |

### 4.3 Nguyên tắc vàng

1. Không đặt `SERVICE_ROLE_KEY` hay bất kỳ bí mật nào ở frontend.
2. Không tắt RLS; thay đổi quyền phải đi qua migration và được thử với anon/staff/admin.
3. Webhook luôn verify chữ ký trước khi đọc dữ liệu và luôn idempotent.
4. Edge Function và migration được deploy riêng bằng Supabase CLI, tách khỏi việc phát hành frontend lên Tenten.
5. Xác nhận đúng môi trường (dev hay production) trước mọi lệnh ghi.
