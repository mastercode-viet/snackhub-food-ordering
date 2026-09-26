-- Nhân viên tự gửi yêu cầu ĐỔI CA (với 1 đồng nghiệp) hoặc XIN NGHỈ 1 ca đã
-- được gán; superadmin duyệt/từ chối. Trước đây "Lịch của tôi" chỉ đọc, mọi
-- thay đổi lịch phải nhắn superadmin sửa tay.
--
-- Nhân viên KHÔNG ghi thẳng vào bảng (không có policy insert/update cho
-- staff): tạo / huỷ / duyệt đều qua RPC để server tự kiểm tra quyền sở hữu
-- ca, ngày chưa qua, và tự điền snapshot — client không sửa lén được cột nào.

create type public.shift_swap_request_type as enum ('swap', 'leave');
create type public.shift_swap_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  request_type public.shift_swap_request_type not null,

  requester_staff_id uuid not null references public.staff_profiles (id) on delete cascade,
  -- set null, KHÔNG cascade: duyệt "xin nghỉ" sẽ xoá chính ca đó — cascade sẽ
  -- xoá luôn yêu cầu, mất lịch sử. Ngày/ca đã được snapshot ở các cột dưới.
  requester_assignment_id uuid references public.shift_assignments (id) on delete set null,
  work_date date not null,
  shift_name text not null,
  shift_start time not null,
  shift_end time not null,

  -- Chỉ có với 'swap'. Nhân viên chỉ chọn ĐỒNG NGHIỆP (RLS staff_profiles
  -- không cho xem lịch người khác); ca cụ thể của người đó do superadmin
  -- chọn lúc duyệt, rồi mới điền target_assignment_id + snapshot.
  target_staff_id uuid references public.staff_profiles (id) on delete cascade,
  target_assignment_id uuid references public.shift_assignments (id) on delete set null,
  target_work_date date,
  target_shift_name text,

  status public.shift_swap_status not null default 'pending',
  reason text,
  resolution_note text,
  resolved_at timestamptz,
  -- auth.users thay vì staff_profiles — cùng lý do payroll_history.confirmed_by:
  -- admin trong bảng `admins` cũ không có hồ sơ staff_profiles.
  resolved_by uuid references auth.users (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shift_swap_not_self check (target_staff_id is null or target_staff_id <> requester_staff_id),
  constraint shift_swap_type_shape check (
    (request_type = 'leave' and target_staff_id is null and target_assignment_id is null)
    or (request_type = 'swap' and target_staff_id is not null)
  ),
  constraint shift_swap_resolved_fields check (
    (status in ('pending', 'cancelled') and resolved_at is null and resolved_by is null)
    or (status in ('approved', 'rejected') and resolved_at is not null and resolved_by is not null)
  ),
  constraint shift_swap_reason_len check (reason is null or char_length(reason) <= 500),
  constraint shift_swap_note_len check (resolution_note is null or char_length(resolution_note) <= 500)
);

comment on table public.shift_swap_requests is
  'Yêu cầu đổi ca / xin nghỉ của nhân viên, superadmin duyệt qua resolve_shift_swap_request().';

-- Mỗi ca chỉ có tối đa 1 yêu cầu đang chờ (bên xin lẫn bên bị nhắm tới).
create unique index shift_swap_requests_pending_requester_uidx
  on public.shift_swap_requests (requester_assignment_id)
  where status = 'pending' and requester_assignment_id is not null;
create unique index shift_swap_requests_pending_target_uidx
  on public.shift_swap_requests (target_assignment_id)
  where status = 'pending' and target_assignment_id is not null;

create index shift_swap_requests_requester_idx on public.shift_swap_requests (requester_staff_id, created_at desc);
create index shift_swap_requests_target_idx on public.shift_swap_requests (target_staff_id, created_at desc)
  where target_staff_id is not null;
create index shift_swap_requests_pending_idx on public.shift_swap_requests (created_at)
  where status = 'pending';

create trigger trg_shift_swap_requests_updated
  before update on public.shift_swap_requests
  for each row execute function public.set_updated_at();

alter table public.shift_swap_requests enable row level security;

create policy shift_swap_requests_admin_all on public.shift_swap_requests
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy shift_swap_requests_requester_select on public.shift_swap_requests
  for select to authenticated
  using (requester_staff_id = (select auth.uid()));

create policy shift_swap_requests_target_select on public.shift_swap_requests
  for select to authenticated
  using (target_staff_id = (select auth.uid()));

-- ── Danh bạ tối giản: chỉ id + tên của nhân viên đang hoạt động ─────────────
-- RLS staff_profiles chỉ cho staff đọc hồ sơ của chính mình (có SĐT, số tài
-- khoản, lương/giờ) — không nới RLS đó, chỉ lộ đúng 2 cột cần để chọn người đổi ca.
create or replace function public.fetch_staff_directory()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select sp.id, sp.full_name
  from public.staff_profiles sp
  where sp.is_active and public.is_staff()
  order by sp.full_name;
$$;

revoke all on function public.fetch_staff_directory() from public, anon;
grant execute on function public.fetch_staff_directory() to authenticated;

-- ── Nhân viên tạo yêu cầu ───────────────────────────────────────────────────
create or replace function public.create_shift_swap_request(
  p_assignment_id uuid,
  p_type public.shift_swap_request_type,
  p_target_staff_id uuid default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_assignment public.shift_assignments;
  v_shift public.shifts;
  v_tz text;
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Chỉ tài khoản nhân viên mới gửi được yêu cầu.' using errcode = 'P0001';
  end if;

  select * into v_assignment from public.shift_assignments where id = p_assignment_id;
  if not found or v_assignment.staff_id <> auth.uid() then
    raise exception 'Không tìm thấy ca này trong lịch của bạn.' using errcode = 'P0001';
  end if;

  v_tz := coalesce((select s.timezone from public.store_settings s where s.id = 1), 'Asia/Ho_Chi_Minh');
  if v_assignment.work_date < (now() at time zone v_tz)::date then
    raise exception 'Ca này đã qua, không gửi yêu cầu được nữa.' using errcode = 'P0001';
  end if;

  if p_type = 'swap' then
    if p_target_staff_id is null or p_target_staff_id = auth.uid() then
      raise exception 'Chọn một đồng nghiệp để đổi ca.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.staff_profiles where id = p_target_staff_id and is_active) then
      raise exception 'Đồng nghiệp này không còn hoạt động.' using errcode = 'P0001';
    end if;
  else
    p_target_staff_id := null;
  end if;

  select * into v_shift from public.shifts where id = v_assignment.shift_id;

  insert into public.shift_swap_requests (
    request_type, requester_staff_id, requester_assignment_id,
    work_date, shift_name, shift_start, shift_end,
    target_staff_id, reason
  ) values (
    p_type, auth.uid(), v_assignment.id,
    v_assignment.work_date, v_shift.name, v_shift.start_time, v_shift.end_time,
    p_target_staff_id, nullif(btrim(p_reason), '')
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Ca này đang có một yêu cầu chờ duyệt rồi.' using errcode = 'P0001';
end;
$function$;

revoke all on function public.create_shift_swap_request(uuid, public.shift_swap_request_type, uuid, text) from public, anon;
grant execute on function public.create_shift_swap_request(uuid, public.shift_swap_request_type, uuid, text) to authenticated;

-- ── Nhân viên tự huỷ yêu cầu đang chờ của chính mình ────────────────────────
create or replace function public.cancel_shift_swap_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.shift_swap_requests
  set status = 'cancelled'
  where id = p_id and requester_staff_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'Không tìm thấy yêu cầu đang chờ để huỷ.' using errcode = 'P0001';
  end if;
end;
$function$;

revoke all on function public.cancel_shift_swap_request(uuid) from public, anon;
grant execute on function public.cancel_shift_swap_request(uuid) to authenticated;

-- ── Superadmin duyệt / từ chối ──────────────────────────────────────────────
-- Chạy theo quyền người gọi (không SECURITY DEFINER) — admin đã có RLS
-- admin_all trên cả shift_assignments lẫn shift_swap_requests; kiểm tra
-- is_admin() tường minh chỉ để báo lỗi rõ ràng thay vì "0 dòng bị đổi".
--
-- Mọi bước chạy trong 1 transaction của lời gọi RPC, khoá dòng (for update)
-- để 2 admin bấm duyệt cùng lúc không áp dụng 2 lần.
create or replace function public.resolve_shift_swap_request(
  p_id uuid,
  p_approve boolean,
  p_note text default null,
  p_target_assignment_id uuid default null,
  p_replacement_staff_id uuid default null
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_req public.shift_swap_requests;
  v_a public.shift_assignments;
  v_b public.shift_assignments;
begin
  if not public.is_admin() then
    raise exception 'Chỉ superadmin mới duyệt được yêu cầu.' using errcode = 'P0001';
  end if;

  select * into v_req from public.shift_swap_requests where id = p_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'Yêu cầu không còn ở trạng thái chờ duyệt.' using errcode = 'P0001';
  end if;

  if not p_approve then
    update public.shift_swap_requests
    set status = 'rejected', resolved_at = now(), resolved_by = auth.uid(),
        resolution_note = nullif(btrim(p_note), '')
    where id = p_id;
    return;
  end if;

  -- ── Kiểm tra + khoá mọi dòng liên quan TRƯỚC khi đổi gì ──
  if v_req.requester_assignment_id is null then
    raise exception 'Ca gốc của yêu cầu đã bị xoá khỏi lịch — hãy từ chối yêu cầu này.' using errcode = 'P0001';
  end if;

  select * into v_a from public.shift_assignments where id = v_req.requester_assignment_id for update;
  if not found or v_a.staff_id <> v_req.requester_staff_id then
    raise exception 'Ca gốc đã bị đổi so với lúc gửi yêu cầu — hãy từ chối yêu cầu này.' using errcode = 'P0001';
  end if;

  if v_req.request_type = 'leave' then
    if p_replacement_staff_id is not null then
      if not exists (select 1 from public.staff_profiles where id = p_replacement_staff_id and is_active) then
        raise exception 'Người thay ca không hợp lệ hoặc đã bị khoá.' using errcode = 'P0001';
      end if;
      if exists (
        select 1 from public.shift_assignments
        where staff_id = p_replacement_staff_id and work_date = v_a.work_date
      ) then
        raise exception 'Người thay ca đã có ca khác trong ngày này.' using errcode = 'P0001';
      end if;
    end if;
  else
    if p_target_assignment_id is null then
      raise exception 'Chọn ca của người được đổi để hoàn tất.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.staff_profiles where id = v_req.target_staff_id and is_active) then
      raise exception 'Nhân viên được đổi ca đã bị khoá — hãy từ chối yêu cầu này.' using errcode = 'P0001';
    end if;

    select * into v_b from public.shift_assignments where id = p_target_assignment_id for update;
    if not found or v_b.staff_id <> v_req.target_staff_id then
      raise exception 'Ca được chọn không thuộc về người được đổi.' using errcode = 'P0001';
    end if;

    -- Khác ngày: hoán staff_id nên phải chắc không ai đã có ca khác đúng ngày
    -- sẽ nhận về (unique staff_id + work_date). Cùng ngày thì hoán shift_id,
    -- không đụng tới cặp (staff_id, work_date) nên không cần kiểm tra.
    if v_a.work_date <> v_b.work_date and (
      exists (select 1 from public.shift_assignments where staff_id = v_b.staff_id and work_date = v_a.work_date)
      or exists (select 1 from public.shift_assignments where staff_id = v_a.staff_id and work_date = v_b.work_date)
    ) then
      raise exception 'Một trong hai người đã có ca khác đúng ngày cần đổi — không thể đổi.' using errcode = 'P0001';
    end if;
  end if;

  -- Yêu cầu khác đang chờ trên chính các ca sắp đổi chủ sẽ không còn đúng nữa.
  -- Phải chạy TRƯỚC khi xoá ca (xoá sẽ set null FK, không còn khớp được).
  update public.shift_swap_requests
  set status = 'cancelled'
  where id <> p_id
    and status = 'pending'
    and (
      requester_assignment_id in (v_a.id, v_b.id)
      or target_assignment_id in (v_a.id, v_b.id)
    );

  -- ── Áp dụng ──
  if v_req.request_type = 'leave' then
    if p_replacement_staff_id is null then
      delete from public.shift_assignments where id = v_a.id;
    else
      update public.shift_assignments set staff_id = p_replacement_staff_id where id = v_a.id;
    end if;
  else
    -- Cùng ngày: hoán shift_id. Khác ngày: hoán staff_id. Cả 2 cách đều giữ
    -- đúng unique (staff_id, work_date) ở MỌI bước trung gian.
    if v_a.work_date = v_b.work_date then
      update public.shift_assignments set shift_id = v_b.shift_id where id = v_a.id;
      update public.shift_assignments set shift_id = v_a.shift_id where id = v_b.id;
    else
      update public.shift_assignments set staff_id = v_b.staff_id where id = v_a.id;
      update public.shift_assignments set staff_id = v_a.staff_id where id = v_b.id;
    end if;

    update public.shift_swap_requests
    set target_assignment_id = v_b.id,
        target_work_date = v_b.work_date,
        target_shift_name = (select sh.name from public.shifts sh where sh.id = v_b.shift_id)
    where id = p_id;
  end if;

  update public.shift_swap_requests
  set status = 'approved', resolved_at = now(), resolved_by = auth.uid(),
      resolution_note = nullif(btrim(p_note), '')
  where id = p_id;
end;
$function$;

revoke all on function public.resolve_shift_swap_request(uuid, boolean, text, uuid, uuid) from public, anon;
grant execute on function public.resolve_shift_swap_request(uuid, boolean, text, uuid, uuid) to authenticated;
