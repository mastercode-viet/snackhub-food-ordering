-- "Nhận tại quán" (pickup). Đơn có delivery_method = 'delivery' (mặc định, như cũ)
-- hoặc 'pickup' (khách tự đến quán lấy: không toà, phí giao = 0 — create-order tính).
--
-- building cho phép null nhưng có ràng buộc: đơn giao hàng BẮT BUỘC có toà.
--
-- SLA: đơn pickup chỉ tính thời gian bếp làm món (tới lúc "Chờ khách lấy"),
-- không tính lúc chờ khách tới — admin_daily_stats.sla_breached_orders loại
-- đơn pickup; frontend dừng cảnh báo khi đơn pickup đã sang 'delivering'.

create type public.delivery_method as enum ('delivery', 'pickup');

alter table public.orders
  add column delivery_method public.delivery_method not null default 'delivery',
  alter column building drop not null,
  add constraint orders_delivery_requires_building check (delivery_method = 'pickup' or building is not null);

-- Thống kê: thêm tỷ trọng giao hàng / nhận tại quán (cột mới nối vào CUỐI view
-- — create or replace view không cho chèn giữa). Doanh thu tổng vẫn gồm cả hai.
-- Giữ security_invoker=true như view gốc: view chạy theo quyền người gọi (RLS orders).
create or replace view public.admin_daily_stats with (security_invoker = true) as
 SELECT ((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date AS day,
    count(*) AS total_orders,
    count(*) FILTER (WHERE (status = 'completed'::order_status)) AS completed_orders,
    count(*) FILTER (WHERE (status = 'cancelled'::order_status)) AS cancelled_orders,
    COALESCE(sum(total_amount) FILTER (WHERE (status = 'completed'::order_status)), (0)::numeric) AS revenue,
    COALESCE(sum(discount_amount) FILTER (WHERE (status = 'completed'::order_status)), (0)::numeric) AS total_discount,
    COALESCE(round(avg(total_amount) FILTER (WHERE (status = 'completed'::order_status)), 0), (0)::numeric) AS avg_order_value,
    COALESCE(sum(total_amount) FILTER (WHERE ((status = 'completed'::order_status) AND (payment_method = 'cod'::payment_method))), (0)::numeric) AS cod_revenue,
    COALESCE(sum(total_amount) FILTER (WHERE ((status = 'completed'::order_status) AND (payment_method = 'payos'::payment_method))), (0)::numeric) AS payos_revenue,
    count(*) FILTER (WHERE ((status = 'completed'::order_status) AND (delivery_method = 'delivery'::delivery_method) AND (completed_at IS NOT NULL) AND ((completed_at - created_at) >= '00:20:00'::interval))) AS sla_breached_orders,
    count(*) FILTER (WHERE ((status = 'completed'::order_status) AND (delivery_method = 'delivery'::delivery_method))) AS delivery_orders,
    count(*) FILTER (WHERE ((status = 'completed'::order_status) AND (delivery_method = 'pickup'::delivery_method))) AS pickup_orders,
    COALESCE(sum(total_amount) FILTER (WHERE ((status = 'completed'::order_status) AND (delivery_method = 'delivery'::delivery_method))), (0)::numeric) AS delivery_revenue,
    COALESCE(sum(total_amount) FILTER (WHERE ((status = 'completed'::order_status) AND (delivery_method = 'pickup'::delivery_method))), (0)::numeric) AS pickup_revenue
   FROM orders o
  GROUP BY (((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date);

-- Khách xem được hình thức nhận hàng ở trang theo dõi đơn.
CREATE OR REPLACE FUNCTION public.get_order_by_code(p_order_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare result jsonb;
begin
  select jsonb_build_object(
    'id', o.id,
    'order_code', o.order_code,
    'status', o.status,
    'payment_method', o.payment_method,
    'payment_status', o.payment_status,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'building', o.building, 'floor', o.floor, 'room', o.room, 'class_name', o.class_name,
    'delivery_note', o.delivery_note,
    'desired_delivery_time', o.desired_delivery_time,
    'delivery_method', o.delivery_method,
    'subtotal', o.subtotal, 'discount_amount', o.discount_amount,
    'shipping_fee', o.shipping_fee, 'total_amount', o.total_amount,
    'discount_code', o.discount_code,
    'payos_checkout_url', o.payos_checkout_url,
    'payos_qr_code', o.payos_qr_code,
    'cancelled_at', o.cancelled_at, 'cancel_reason', o.cancel_reason,
    'completed_at', o.completed_at, 'created_at', o.created_at,
    'can_cancel', (o.status = 'pending_confirmation' and o.payment_status <> 'paid'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_id', i.product_id, 'product_name', i.product_name,
        'product_image_url', i.product_image_url, 'options', i.options,
        'combo_id', i.combo_id, 'combo_items_snapshot', i.combo_items_snapshot,
        'unit_price', i.unit_price, 'quantity', i.quantity,
        'line_total', i.line_total, 'item_note', i.item_note
      ) order by i.created_at)
      from public.order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  into result
  from public.orders o
  where o.order_code = upper(btrim(p_order_code));

  if result is null then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return result;
end $function$;
