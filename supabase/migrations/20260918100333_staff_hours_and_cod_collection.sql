-- Phase 3 tiếp theo:
--   1) RPC tổng hợp giờ công theo tháng cho từng nhân viên.
--   2) Tự gắn collected_by_staff_id khi đơn COD được đánh dấu "Đã thu tiền".

-- 1. Tổng hợp giờ công theo tháng --------------------------------------
--
-- KHÔNG dùng SECURITY DEFINER: hàm chạy bằng quyền người gọi (invoker) nên
-- RLS của staff_profiles/time_logs tự lọc kết quả — cùng khuôn mẫu với view
-- admin_daily_stats (xem comment trong adminQueries.ts). Superadmin gọi thấy
-- toàn bộ nhân viên; một staff tự gọi chỉ thấy đúng dòng của mình (hữu ích
-- để tự tra "tháng này tôi làm bao nhiêu giờ"), không cần thêm nhánh phân
-- quyền thủ công trong hàm.
--
-- p_month: bất kỳ ngày nào trong tháng cần tổng hợp, tự chuẩn hoá về đầu
-- tháng. Chỉ tính các ca ĐÃ check-out (total_minutes_worked not null);
-- ca đang mở (chưa check-out) không được cộng dồn.
create or replace function public.get_staff_monthly_hours(p_month date)
returns table (
  staff_id uuid,
  full_name text,
  role public.staff_role,
  shift_count bigint,
  total_minutes bigint,
  total_hours numeric
)
language sql
stable
set search_path to 'public'
as $$
  select
    sp.id as staff_id,
    sp.full_name,
    sp.role,
    count(tl.id) filter (where tl.total_minutes_worked is not null) as shift_count,
    coalesce(sum(tl.total_minutes_worked), 0)::bigint as total_minutes,
    round(coalesce(sum(tl.total_minutes_worked), 0) / 60.0, 2) as total_hours
  from public.staff_profiles sp
  left join public.time_logs tl
    on tl.staff_id = sp.id
    and tl.check_in_at >= date_trunc('month', p_month)
    and tl.check_in_at < date_trunc('month', p_month) + interval '1 month'
  group by sp.id, sp.full_name, sp.role
  order by sp.full_name;
$$;

revoke all on function public.get_staff_monthly_hours(date) from public;
grant execute on function public.get_staff_monthly_hours(date) to authenticated;

-- 2. Tự gắn nhân viên thu tiền COD --------------------------------------
--
-- Mở rộng đúng trigger orders_stamp_status() đã có sẵn (đang stamp
-- completed_at/cancelled_at/paid_at) thay vì thêm trigger mới, để mọi quy
-- tắc "tự động khi đổi trạng thái đơn" nằm chung một chỗ.
--
-- Điều kiện auth.uid() phải có hồ sơ trong staff_profiles: nếu bỏ qua, một
-- admin cũ (chỉ có trong bảng admins, KHÔNG có dòng staff_profiles) đánh
-- dấu "Đã thu tiền" sẽ làm insert giá trị auth.uid() không khớp FK
-- collected_by_staff_id -> staff_profiles(id) và update sẽ vỡ (FK violation).
-- payment_method = 'cod' đã tự loại các đơn PayOS được payos-webhook
-- (service role, không có auth.uid()) đánh dấu paid.
create or replace function public.orders_stamp_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status then
    if new.status = 'completed' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status = 'cancelled' and new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    if new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.payment_method = 'cod'
      and new.collected_by_staff_id is null
      and exists (select 1 from public.staff_profiles sp where sp.id = auth.uid())
    then
      new.collected_by_staff_id := auth.uid();
    end if;
  end if;

  return new;
end
$function$;
