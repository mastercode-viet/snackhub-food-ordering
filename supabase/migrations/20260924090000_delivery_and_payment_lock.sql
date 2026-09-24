-- Ràng buộc "người giao là người thu tiền" + "thu tiền trước, hoàn tất sau".

alter table public.orders
  add column if not exists assigned_staff_id uuid references public.staff_profiles(id);

comment on column public.orders.assigned_staff_id is
  'Nhân viên nhận giao đơn — gắn tự động khi đơn chuyển sang delivering. Chỉ người này (hoặc is_admin()) được xác nhận đã thu tiền COD của đơn.';

create or replace function public.orders_stamp_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status then

    if new.status = 'delivering' then
      -- Người đầu tiên chuyển đơn sang "Đang giao" là người chịu trách nhiệm giao +
      -- thu tiền. Chỉ gắn nếu chưa có ai nhận — khoá đua tự nhiên nhờ row lock của
      -- UPDATE, không cần cột lock riêng.
      if new.assigned_staff_id is null then
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
    elsif new.status = 'cancelled' and new.cancelled_at is null then
      new.cancelled_at := now();
    end if;

  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    if new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.payment_method = 'cod' then
      -- Đơn đã có người nhận giao (assigned_staff_id khác NULL) thì CHỈ người đó
      -- hoặc is_admin() được xác nhận thu tiền. Đơn chưa từng qua bước "Đang giao"
      -- (assigned_staff_id còn NULL) thì giữ hành vi cũ — bất kỳ is_staff() nào
      -- cũng xác nhận được, tránh khoá cứng các đơn xử lý tắt không qua đủ luồng.
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
