-- Ca làm (shift templates) + lịch gán ca theo NGÀY CỤ THỂ cho từng nhân viên.
--
-- Không đổi model check-in/check-out hiện có (time_logs vẫn tự tính
-- total_minutes_worked qua generated column) — bảng ở đây chỉ phục vụ xếp
-- lịch trước và đối chiếu cảnh báo lệch giờ ở Frontend, không chặn
-- check-in/check-out.

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_end_after_start check (end_time > start_time)
);

comment on table public.shifts is
  'Mẫu ca làm (vd: "Ca sáng" 06:00-10:00) do superadmin định nghĩa, dùng để gán lịch cho nhân viên.';

create trigger trg_shifts_updated
  before update on public.shifts
  for each row execute function public.set_updated_at();

alter table public.shifts enable row level security;

create policy shifts_admin_all on public.shifts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Nhân viên cần đọc được tên/giờ ca (qua shift_assignments join sang đây)
-- để biết mình được xếp ca gì — không phải dữ liệu nhạy cảm.
create policy shifts_staff_select on public.shifts
  for select to authenticated
  using (public.is_staff());

-- Gán ca theo ngày cụ thể: mỗi nhân viên tối đa 1 ca / 1 ngày. Sửa ca cho
-- một ngày đã gán là UPDATE/UPSERT trên đúng dòng đó (unique staff_id+work_date),
-- không phải xoá rồi tạo lại.
create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  -- restrict: không cho xoá 1 mẫu ca khi lịch làm việc còn đang dùng nó —
  -- superadmin phải gỡ/đổi các lịch đó trước, tránh mất dấu vết lịch sử
  -- "hôm đó ai làm ca gì" một cách âm thầm.
  shift_id uuid not null references public.shifts (id) on delete restrict,
  staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  work_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_assignments_staff_date_uidx unique (staff_id, work_date)
);

comment on table public.shift_assignments is
  'Lịch gán ca theo ngày cụ thể — mỗi nhân viên tối đa 1 ca/ngày, superadmin CRUD.';

create index shift_assignments_work_date_idx on public.shift_assignments (work_date);
create index shift_assignments_staff_id_idx on public.shift_assignments (staff_id, work_date desc);

create trigger trg_shift_assignments_updated
  before update on public.shift_assignments
  for each row execute function public.set_updated_at();

alter table public.shift_assignments enable row level security;

create policy shift_assignments_admin_all on public.shift_assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Nhân viên tự xem lịch của MÌNH (mọi ngày, kể cả tương lai) để biết ca sắp
-- tới — không sửa được, chỉ superadmin gán/sửa/xoá.
create policy shift_assignments_staff_select on public.shift_assignments
  for select to authenticated
  using (staff_id = (select auth.uid()));
