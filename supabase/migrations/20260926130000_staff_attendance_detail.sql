-- Mở rộng thống kê chấm công: thêm "về sớm" (check-out sớm hơn giờ kết thúc
-- ca) vào get_staff_attendance_stats — hàm cũ chỉ tính lệch check-in, bỏ qua
-- hoàn toàn lệch check-out. Thêm hàm get_staff_attendance_detail trả chi
-- tiết TỪNG NGÀY (thay vì chỉ tổng số trong tháng) để Admin xem được đúng
-- ngày nào trễ/sớm bao nhiêu phút, không chỉ đếm tổng.
--
-- Giữ nguyên cách quy đổi múi giờ store_settings.timezone (fallback
-- 'Asia/Ho_Chi_Minh') đã sửa ở 20260920110000_fix_staff_attendance_stats_timezone.sql —
-- session Postgres chạy UTC, work_date/start_time/end_time nhập theo giờ VN.

-- Đổi shape RETURNS TABLE (thêm cột) — Postgres không cho CREATE OR REPLACE
-- khi đổi tập cột trả về, phải drop trước.
drop function if exists public.get_staff_attendance_stats(date);

create function public.get_staff_attendance_stats(p_month date)
returns table (
  staff_id uuid,
  full_name text,
  assigned_days bigint,
  late_count bigint,
  absent_count bigint,
  early_leave_count bigint
)
language sql
stable
set search_path to 'public'
as $$
  select
    sp.id as staff_id,
    sp.full_name,
    count(sa.id) as assigned_days,
    count(*) filter (
      where first_check_in.check_in_at is not null
        and (first_check_in.check_in_at at time zone tz.value)::time > (sh.start_time + interval '15 minutes')
    ) as late_count,
    count(*) filter (
      where first_check_in.check_in_at is null
        and sa.work_date < (now() at time zone tz.value)::date
    ) as absent_count,
    count(*) filter (
      where last_check_out.check_out_at is not null
        and (last_check_out.check_out_at at time zone tz.value)::time < (sh.end_time - interval '15 minutes')
    ) as early_leave_count
  from public.staff_profiles sp
  cross join lateral (
    select coalesce((select s.timezone from public.store_settings s where s.id = 1), 'Asia/Ho_Chi_Minh') as value
  ) tz
  join public.shift_assignments sa on sa.staff_id = sp.id
    and sa.work_date >= date_trunc('month', p_month)
    and sa.work_date < date_trunc('month', p_month) + interval '1 month'
  join public.shifts sh on sh.id = sa.shift_id
  left join lateral (
    select tl.check_in_at
    from public.time_logs tl
    where tl.staff_id = sp.id
      and (tl.check_in_at at time zone tz.value)::date = sa.work_date
    order by tl.check_in_at
    limit 1
  ) first_check_in on true
  left join lateral (
    select tl.check_out_at
    from public.time_logs tl
    where tl.staff_id = sp.id
      and (tl.check_in_at at time zone tz.value)::date = sa.work_date
      and tl.check_out_at is not null
    order by tl.check_out_at desc
    limit 1
  ) last_check_out on true
  group by sp.id, sp.full_name;
$$;

revoke all on function public.get_staff_attendance_stats(date) from public;
grant execute on function public.get_staff_attendance_stats(date) to authenticated;

-- Chi tiết chấm công từng ngày của MỘT nhân viên trong tháng — không
-- SECURITY DEFINER, chạy theo quyền người gọi giống get_staff_attendance_stats:
-- RLS shift_assignments/time_logs tự giới hạn, staff thường truyền p_staff_id
-- khác auth.uid() của mình sẽ chỉ nhận về 0 dòng (không lộ dữ liệu người khác).
create or replace function public.get_staff_attendance_detail(p_staff_id uuid, p_month date)
returns table (
  work_date date,
  shift_name text,
  shift_start time,
  shift_end time,
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_deviation_minutes integer,
  check_out_deviation_minutes integer
)
language sql
stable
set search_path to 'public'
as $$
  select
    sa.work_date,
    sh.name as shift_name,
    sh.start_time as shift_start,
    sh.end_time as shift_end,
    first_check_in.check_in_at,
    last_check_out.check_out_at,
    case when first_check_in.check_in_at is not null then
      (extract(epoch from ((first_check_in.check_in_at at time zone tz.value)::time - sh.start_time)) / 60)::integer
    end as check_in_deviation_minutes,
    case when last_check_out.check_out_at is not null then
      (extract(epoch from ((last_check_out.check_out_at at time zone tz.value)::time - sh.end_time)) / 60)::integer
    end as check_out_deviation_minutes
  from public.shift_assignments sa
  cross join lateral (
    select coalesce((select s.timezone from public.store_settings s where s.id = 1), 'Asia/Ho_Chi_Minh') as value
  ) tz
  join public.shifts sh on sh.id = sa.shift_id
  left join lateral (
    select tl.check_in_at
    from public.time_logs tl
    where tl.staff_id = sa.staff_id
      and (tl.check_in_at at time zone tz.value)::date = sa.work_date
    order by tl.check_in_at
    limit 1
  ) first_check_in on true
  left join lateral (
    select tl.check_out_at
    from public.time_logs tl
    where tl.staff_id = sa.staff_id
      and (tl.check_in_at at time zone tz.value)::date = sa.work_date
      and tl.check_out_at is not null
    order by tl.check_out_at desc
    limit 1
  ) last_check_out on true
  where sa.staff_id = p_staff_id
    and sa.work_date >= date_trunc('month', p_month)
    and sa.work_date < date_trunc('month', p_month) + interval '1 month'
  order by sa.work_date;
$$;

revoke all on function public.get_staff_attendance_detail(uuid, date) from public;
grant execute on function public.get_staff_attendance_detail(uuid, date) to authenticated;
