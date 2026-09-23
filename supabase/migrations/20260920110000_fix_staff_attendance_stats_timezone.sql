-- Fix: get_staff_attendance_stats so sánh check_in_at (timestamptz) với
-- work_date/start_time (date/time KHÔNG có múi giờ) mà không quy đổi múi
-- giờ trước — session Postgres chạy ở UTC, trong khi work_date/start_time
-- được nhập theo giờ VN (Asia/Ho_Chi_Minh). Kết quả: mọi ca có giờ vào
-- trong khoảng UTC 17:00–23:59 (tức 00:00–06:59 sáng hôm sau theo giờ VN —
-- đúng khung "ca sáng" điển hình) bị lệch ngày/giờ khi so khớp, khiến nhân
-- viên có thể bị tính "vắng" dù đã check-in, hoặc "trễ ca" bị tính sai.
--
-- Sửa bằng cách quy đổi mọi mốc thời gian về giờ theo store_settings.timezone
-- trước khi cast ::date/::time — cùng khuôn mẫu is_store_open() đã dùng
-- (p_at at time zone s.timezone). Fallback 'Asia/Ho_Chi_Minh' nếu vì lý do
-- gì đó thiếu dòng store_settings (id = 1).
create or replace function public.get_staff_attendance_stats(p_month date)
returns table (
  staff_id uuid,
  full_name text,
  assigned_days bigint,
  late_count bigint,
  absent_count bigint
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
    ) as absent_count
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
  group by sp.id, sp.full_name;
$$;

revoke all on function public.get_staff_attendance_stats(date) from public;
grant execute on function public.get_staff_attendance_stats(date) to authenticated;
