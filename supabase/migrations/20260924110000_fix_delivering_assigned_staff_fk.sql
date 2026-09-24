-- Sửa lỗi "Không cập nhật được trạng thái Đang giao" cho admin cũ (bảng
-- `admins`, KHÔNG có dòng staff_profiles): orders_stamp_status() (từ migration
-- delivery_and_payment_lock) gán new.assigned_staff_id := auth.uid() không
-- điều kiện khi chuyển sang 'delivering', trong khi assigned_staff_id có FK
-- tới staff_profiles(id) — admin cũ bấm "Bắt đầu giao" là vỡ FK ngay.
--
-- Cùng mẫu lỗi (và cùng cách vá) đã áp dụng cho collected_by_staff_id ở
-- migration staff_hours_and_cod_collection: chỉ tự gắn khi auth.uid() thực sự
-- có hồ sơ staff_profiles đang hoạt động; ngược lại giữ assigned_staff_id là
-- NULL — đúng hành vi "đơn chưa qua bước giao" mà Frontend (AdminOrdersPage)
-- đã xử lý sẵn.

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
      perform realtime.send(
        jsonb_build_object('order_code', new.order_code),
        'cancelled',
        'order:' || new.order_code,
        false
      );
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
