-- Thống kê trễ ca / vắng ca hàng tháng — so khớp shift_assignments (ca được
-- gán) với time_logs (chấm công thực tế) theo từng ngày dương lịch.
--
-- KHÔNG dùng SECURITY DEFINER (giống get_staff_monthly_hours): hàm chạy bằng
-- quyền người gọi nên RLS của staff_profiles/shift_assignments/time_logs tự
-- lọc kết quả — superadmin thấy toàn bộ nhân viên, một staff tự gọi chỉ thấy
-- đúng dòng của mình.
--
-- "Trễ": có check-in trong ngày nhưng muộn hơn start_time của ca quá 15 phút
-- (khớp SHIFT_GRACE_MINUTES ở src/components/admin/CheckInOutWidget.tsx —
-- đổi 1 bên thì nhớ đổi bên kia).
-- "Vắng": ngày đã gán ca, ngày đó đã trôi qua (< hôm nay), nhưng không có
-- time_logs nào check-in trong ngày đó.
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
        and first_check_in.check_in_at::time > (sh.start_time + interval '15 minutes')
    ) as late_count,
    count(*) filter (
      where first_check_in.check_in_at is null and sa.work_date < current_date
    ) as absent_count
  from public.staff_profiles sp
  join public.shift_assignments sa on sa.staff_id = sp.id
    and sa.work_date >= date_trunc('month', p_month)
    and sa.work_date < date_trunc('month', p_month) + interval '1 month'
  join public.shifts sh on sh.id = sa.shift_id
  left join lateral (
    select tl.check_in_at
    from public.time_logs tl
    where tl.staff_id = sp.id
      and tl.check_in_at::date = sa.work_date
    order by tl.check_in_at
    limit 1
  ) first_check_in on true
  group by sp.id, sp.full_name;
$$;

revoke all on function public.get_staff_attendance_stats(date) from public;
grant execute on function public.get_staff_attendance_stats(date) to authenticated;
