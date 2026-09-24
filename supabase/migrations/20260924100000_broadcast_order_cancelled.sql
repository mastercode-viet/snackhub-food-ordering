-- REPLICA IDENTITY FULL: Postgres Changes (Realtime) chỉ gửi payload.old đầy đủ
-- (không chỉ mỗi khoá chính) khi bảng bật cờ này. Admin cần so old.payment_status
-- với new.payment_status để biết CHÍNH XÁC thời điểm chuyển sang 'paid' (phát âm
-- báo đơn online), thay vì đoán qua giá trị hiện tại — dễ phát trùng mỗi lần đơn
-- được update tiếp sau đó (đổi trạng thái, gắn assigned_staff_id...).
alter table public.orders replica identity full;

-- Phát Realtime Broadcast khi đơn chuyển sang 'cancelled', bất kể huỷ từ
-- đường nào (admin, khách tự huỷ, hệ thống tự huỷ đơn PayOS treo quá hạn) —
-- đặt trong trigger DÙNG CHUNG thay vì rải rác ở từng chỗ gọi UPDATE.
--
-- Dùng realtime.send(..., private => false) — broadcast công khai trên kênh
-- order:<mã đơn>, đúng model bảo mật "biết mã đơn mới xem được đơn" đã dùng
-- cho sự kiện 'paid' ở payos-webhook. Khách vãng lai (anon) không có policy
-- SELECT trên `orders` nên không dùng được Postgres Changes.
create or replace function public.orders_stamp_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status then

    if new.status = 'delivering' then
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
