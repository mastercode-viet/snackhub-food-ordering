-- Admin đổi trạng thái đơn (preparing/delivering/completed...) chỉ mới phát
-- Realtime Broadcast riêng cho 'cancelled' — khách theo dõi đơn (OrderTrackingPage)
-- phải đợi tới vòng poll 20s tiếp theo mới thấy đơn nhảy sang "Đang giao",
-- "Hoàn tất"... Gộp lại thành MỘT broadcast 'status_changed' phát cho MỌI lần
-- new.status khác old.status, mang theo status mới để client khỏi phải fetch
-- lại chỉ để biết có gì đổi hay không.
create or replace function public.orders_stamp_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status then

    if new.status = 'delivering' then
      if new.assigned_staff_id is null
        and exists (
          select 1 from public.staff_profiles sp
          where sp.id = auth.uid() and sp.is_active
        )
      then
        new.assigned_staff_id := auth.uid();
      end if;
    end if;

    if new.status = 'completed' then
      if new.payment_status <> 'paid' then
        raise exception 'Đơn chưa xác nhận thanh toán — không thể chuyển sang Hoàn tất.'
          using errcode = 'P0001';
      end if;
      if new.completed_at is null then
        new.completed_at := now();
      end if;
    elsif new.status = 'cancelled' then
      if new.cancelled_at is null then
        new.cancelled_at := now();
      end if;
    end if;

    perform realtime.send(
      jsonb_build_object('order_code', new.order_code, 'status', new.status),
      'status_changed',
      'order:' || new.order_code,
      false
    );

  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    if new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.payment_method = 'cod' then
      if new.assigned_staff_id is not null
        and new.assigned_staff_id <> auth.uid()
        and not is_admin()
      then
        raise exception 'Chỉ nhân viên đang giao đơn này mới được xác nhận đã thu tiền.'
          using errcode = 'P0001';
      end if;

      if new.collected_by_staff_id is null
        and exists (select 1 from public.staff_profiles sp where sp.id = auth.uid())
      then
        new.collected_by_staff_id := auth.uid();
      end if;
    end if;
  end if;

  return new;
end
$function$;
