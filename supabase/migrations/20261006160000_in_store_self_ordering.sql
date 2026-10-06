-- Refactor "Nhận tại quán" (pickup) → "Tự đặt tại quầy qua mã QR" (in_store).
-- Khách quét QR ở quầy (URL ?mode=in_store), đặt món, đưa mã đơn cho nhân viên.
-- Chưa có đơn pickup nào nên đổi tên giá trị enum thẳng, không cần chuyển dữ liệu.
-- Ràng buộc orders_delivery_requires_building và view admin_daily_stats lưu hằng
-- enum theo OID nên tự hiển thị 'in_store' sau khi đổi tên.

alter type public.delivery_method rename value 'pickup' to 'in_store';

-- Đơn tại quầy không hỏi số điện thoại; đơn giao hàng vẫn bắt buộc.
alter table public.orders
  alter column customer_phone drop not null,
  add constraint orders_delivery_requires_phone check (delivery_method = 'in_store' or customer_phone is not null);

alter view public.admin_daily_stats rename column pickup_orders to in_store_orders;
alter view public.admin_daily_stats rename column pickup_revenue to in_store_revenue;

-- Thống kê khách nhận diện theo số điện thoại — đơn tại quầy không có số nên bỏ qua.
create or replace function public.get_top_customers(
  p_from date,
  p_to date,
  p_sort text default 'orders',
  p_limit integer default 20
)
returns table (
  customer_phone text,
  customer_name text,
  completed_orders bigint,
  total_spent numeric,
  last_order_at timestamptz
)
language plpgsql
stable
set search_path to ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên xem được thống kê khách.' using errcode = '42501';
  end if;

  return query
  with in_range as (
    select
      o.customer_phone,
      count(*) as completed_orders,
      sum(o.total_amount) as total_spent,
      (array_agg(o.customer_name order by o.created_at desc))[1] as customer_name
    from public.orders o
    where o.status = 'completed'
      and o.customer_phone is not null
      and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    group by o.customer_phone
  )
  select
    r.customer_phone,
    r.customer_name,
    r.completed_orders,
    r.total_spent,
    (select max(o2.created_at) from public.orders o2
      where o2.customer_phone = r.customer_phone and o2.status = 'completed') as last_order_at
  from in_range r
  order by
    case when p_sort = 'spent' then r.total_spent else r.completed_orders end desc,
    r.total_spent desc
  limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.get_customer_retention(p_from date, p_to date)
returns table (
  customers bigint,
  repeat_customers bigint,
  new_customers bigint,
  returning_customers bigint
)
language plpgsql
stable
set search_path to ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Chỉ quản trị viên xem được thống kê khách.' using errcode = '42501';
  end if;

  return query
  with history as (
    select
      o.customer_phone,
      min((o.created_at at time zone 'Asia/Ho_Chi_Minh')::date) as first_day,
      count(*) as orders_to_date
    from public.orders o
    where o.status = 'completed'
      and o.customer_phone is not null
      and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= p_to
    group by o.customer_phone
  ),
  in_range as (
    select distinct o.customer_phone
    from public.orders o
    where o.status = 'completed'
      and o.customer_phone is not null
      and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
  )
  select
    count(*),
    count(*) filter (where h.orders_to_date >= 2),
    count(*) filter (where h.first_day >= p_from),
    count(*) filter (where h.first_day < p_from)
  from in_range r
  join history h on h.customer_phone = r.customer_phone;
end;
$$;
