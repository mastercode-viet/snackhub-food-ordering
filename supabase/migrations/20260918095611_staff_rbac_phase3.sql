-- Phase 3: RBAC + nhân sự + chấm công.
--
-- Thiết kế: KHÔNG thay thế bảng `admins`/`is_admin()` hiện có (đang được ~40
-- policy trên products/categories/banners/... và cả Storage bucket tham
-- chiếu). Thay vào đó, `is_admin()` được mở rộng để công nhận thêm
-- staff_profiles.role = 'superadmin' — nhờ vậy superadmin có ngay "toàn
-- quyền CRUD trên mọi bảng" như yêu cầu mà không phải sửa lại từng policy
-- cũ. `is_staff()` là hàm mới, tách riêng, chỉ cấp quyền trên orders/
-- order_items/time_logs (phạm vi nhân viên).

create type public.staff_role as enum ('superadmin', 'staff');

-- 1. staff_profiles -----------------------------------------------------

create table public.staff_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null default 'staff',
  full_name text not null,
  phone text,
  bank_account text,
  -- Khoá truy cập khi nghỉ việc mà KHÔNG xoá hồ sơ, vì time_logs/payroll_history
  -- tham chiếu tới đây và cần giữ nguyên lịch sử (cùng cách is_available dùng
  -- cho products/combos thay vì xoá món — xem CLAUDE.md mục 1).
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.staff_profiles is
  'Hồ sơ nhân sự cho RBAC Phase 3. id = auth.users.id (đăng nhập chung cổng Supabase Auth với admin).';

create index staff_profiles_role_idx on public.staff_profiles (role) where is_active;

create trigger trg_staff_profiles_updated
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

alter table public.staff_profiles enable row level security;

-- Tự đọc hồ sơ của mình (cùng khuôn mẫu admins_read_self) — cần cho UI hiển
-- thị tên/vai trò sau khi đăng nhập.
create policy staff_profiles_read_self on public.staff_profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy staff_profiles_admin_select on public.staff_profiles
  for select to authenticated
  using (public.is_admin());

create policy staff_profiles_admin_insert on public.staff_profiles
  for insert to authenticated
  with check (public.is_admin());

create policy staff_profiles_admin_update on public.staff_profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy staff_profiles_admin_delete on public.staff_profiles
  for delete to authenticated
  using (public.is_admin());

-- 2. Hàm phân quyền -------------------------------------------------------

-- Mở rộng is_admin(): admin cũ (bảng admins) HOẶC superadmin mới
-- (staff_profiles) đều có toàn quyền. CREATE OR REPLACE giữ nguyên chữ ký
-- nên toàn bộ policy/Storage đang gọi is_admin() không cần sửa.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    exists (select 1 from public.admins a where a.user_id = auth.uid())
    or exists (
      select 1 from public.staff_profiles sp
      where sp.id = auth.uid() and sp.role = 'superadmin' and sp.is_active
    );
$$;

-- Nhân viên (kể cả superadmin) đang hoạt động — dùng cho phạm vi hẹp
-- orders/order_items/time_logs, KHÔNG cấp quyền ngoài phạm vi đó.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.staff_profiles sp
    where sp.id = auth.uid() and sp.is_active
  );
$$;

-- 3. time_logs ------------------------------------------------------------

create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  -- restrict: chấm công là dữ liệu chứng minh giờ công, không được mất khi
  -- staff_profiles bị xoá — nghỉ việc thì khoá is_active, không xoá hồ sơ.
  staff_id uuid not null references public.staff_profiles (id) on delete restrict,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  -- Tự tính khi check-out, không lưu tay để tránh lệch giờ khớp thời gian
  -- thực tế của check_in_at/check_out_at.
  total_minutes_worked integer generated always as (
    case
      when check_out_at is null then null
      else round(extract(epoch from (check_out_at - check_in_at)) / 60)::integer
    end
  ) stored,
  created_at timestamptz not null default now(),
  constraint time_logs_checkout_after_checkin check (check_out_at is null or check_out_at > check_in_at)
);

comment on table public.time_logs is 'Lịch sử check-in/check-out từng ca của nhân viên.';

create index time_logs_staff_id_idx on public.time_logs (staff_id, check_in_at desc);
-- Tra nhanh "ca đang mở" (check_out_at is null) để chặn check-in trùng.
create unique index time_logs_open_shift_uidx on public.time_logs (staff_id) where check_out_at is null;

alter table public.time_logs enable row level security;

create policy time_logs_admin_all on public.time_logs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- "Bảng chấm công cá nhân": staff chỉ xem/tạo/sửa (check-out) ca của chính
-- mình, không có quyền xoá — tránh tự xoá chứng cứ giờ công của mình.
create policy time_logs_staff_select on public.time_logs
  for select to authenticated
  using (staff_id = (select auth.uid()));

create policy time_logs_staff_insert on public.time_logs
  for insert to authenticated
  with check (staff_id = (select auth.uid()));

create policy time_logs_staff_update on public.time_logs
  for update to authenticated
  using (staff_id = (select auth.uid()))
  with check (staff_id = (select auth.uid()));

-- 4. payroll_history --------------------------------------------------------

create table public.payroll_history (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles (id) on delete restrict,
  -- Luôn chuẩn hoá về ngày đầu tháng để group/so sánh theo tháng thanh toán.
  pay_month date not null,
  -- Không nằm trong yêu cầu gốc nhưng "lưu vết thanh toán lương" mà thiếu số
  -- tiền thì không đối soát được — thêm để bảng có ý nghĩa nghiệp vụ.
  amount numeric(12, 0) not null check (amount >= 0),
  confirmed_by uuid not null references public.staff_profiles (id) on delete restrict,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint payroll_history_pay_month_is_first_of_month check (pay_month = date_trunc('month', pay_month)::date),
  constraint payroll_history_staff_month_uidx unique (staff_id, pay_month)
);

comment on table public.payroll_history is 'Vết thanh toán lương theo tháng — mỗi nhân viên tối đa 1 dòng/tháng.';

create index payroll_history_staff_id_idx on public.payroll_history (staff_id, pay_month desc);

alter table public.payroll_history enable row level security;

-- Chỉ superadmin — yêu cầu không liệt kê payroll_history trong phạm vi của
-- staff, nên không cấp policy nào cho is_staff() ở bảng này.
create policy payroll_history_admin_all on public.payroll_history
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5. orders: người thu tiền COD ------------------------------------------

alter table public.orders
  add column collected_by_staff_id uuid references public.staff_profiles (id) on delete set null;

comment on column public.orders.collected_by_staff_id is
  'Nhân viên thực hiện thu tiền mặt (COD). NULL nếu chưa thu hoặc thanh toán qua PayOS.';

create index orders_collected_by_staff_id_idx on public.orders (collected_by_staff_id) where collected_by_staff_id is not null;

-- staff thao tác đơn hàng: SELECT/UPDATE (đổi trạng thái, gắn người thu
-- tiền). KHÔNG cấp INSERT/DELETE — đơn được tạo qua create-order Edge
-- Function (service role, bỏ qua RLS), và xoá đơn vẫn là đặc quyền admin.
create policy orders_staff_select on public.orders
  for select to authenticated
  using (public.is_staff());

create policy orders_staff_update on public.orders
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy order_items_staff_select on public.order_items
  for select to authenticated
  using (public.is_staff());

create policy order_items_staff_update on public.order_items
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
