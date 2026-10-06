-- "Giờ muốn nhận": khách hẹn giờ giao (tuỳ chọn). null = giao sớm nhất có thể.
--
-- Giờ hẹn hợp lệ khi:
--   - sau thời điểm đặt (now()),
--   - cùng NGÀY với hôm nay theo múi giờ quán (bộ chọn chỉ có Giờ:Phút),
--   - nằm trong khung giờ nhận đơn của quán — dùng lại is_store_open(p_at) để
--     luôn khớp store_settings (open_time/close_time/is_open/timezone).
-- create-order gọi is_valid_desired_delivery_time() — server là nơi quyết định,
-- kiểm tra ở frontend chỉ để báo lỗi sớm.

alter table public.orders
  add column desired_delivery_time timestamptz,
  add constraint orders_desired_after_created check (desired_delivery_time is null or desired_delivery_time > created_at);

create index orders_desired_delivery_time_idx on public.orders (desired_delivery_time)
  where desired_delivery_time is not null;

create or replace function public.is_valid_desired_delivery_time(p_at timestamptz)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select
    p_at > now()
    and (p_at at time zone s.timezone)::date = (now() at time zone s.timezone)::date
    and public.is_store_open(p_at)
  from public.store_settings s
  where s.id = 1;
$$;
