-- Thống kê khách hàng cho /admin/thong-ke. Khách không đăng nhập nên nhận diện
-- theo customer_phone (đã validate định dạng ở create-order nên nhất quán).
--
-- Chỉ tính đơn status = 'completed' — đơn huỷ/spam không làm sai số liệu.
-- Ngày quy đổi theo giờ VN, giống view admin_top_products / admin_daily_stats.
-- Chỉ superadmin (is_admin()) gọi được — staff đọc được orders nhưng không
-- cần thấy danh sách khách.

-- Top khách trong khoảng ngày. p_sort: 'orders' (số đơn) hoặc 'spent' (tổng tiền).
-- last_order_at = lần mua (hoàn tất) gần nhất TỪ TRƯỚC TỚI NAY, không chỉ trong khoảng.
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
      -- Tên khách có thể đổi giữa các đơn — lấy tên của đơn mới nhất.
      (array_agg(o.customer_name order by o.created_at desc))[1] as customer_name
    from public.orders o
    where o.status = 'completed'
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

-- Khách quay lại trong khoảng ngày:
--   customers           = số khách có đơn hoàn tất trong khoảng
--   repeat_customers    = trong số đó, bao nhiêu khách có >= 2 đơn hoàn tất (tính tới p_to)
--   new_customers       = đơn hoàn tất ĐẦU TIÊN rơi vào khoảng này
--   returning_customers = đã từng mua trước p_from, nay quay lại
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
      and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= p_to
    group by o.customer_phone
  ),
  in_range as (
    select distinct o.customer_phone
    from public.orders o
    where o.status = 'completed'
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

revoke all on function public.get_top_customers(date, date, text, integer) from public, anon;
revoke all on function public.get_customer_retention(date, date) from public, anon;
grant execute on function public.get_top_customers(date, date, text, integer) to authenticated;
grant execute on function public.get_customer_retention(date, date) to authenticated;
