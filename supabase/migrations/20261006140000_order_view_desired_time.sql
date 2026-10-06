-- Trang theo dõi đơn của khách hiện "Giờ muốn nhận": thêm desired_delivery_time
-- vào kết quả get_order_by_code. Giữ nguyên mọi trường khác.
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
