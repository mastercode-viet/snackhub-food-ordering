-- Migration: 20261026210000_fix_admin_top_products_and_combos.sql
-- Mục đích: Sửa lỗi thống kê sản phẩm và combo trong /admin/thong-ke
-- 1. admin_top_products:
--    - Chỉ thống kê các dòng sản phẩm đơn lẻ (product_id IS NOT NULL), loại bỏ hoàn toàn combo khỏi tab Sản phẩm.
--    - Ưu tiên lấy tên hiện tại từ bảng products (COALESCE(p.name, i.product_name)) để tránh phân mảnh khi món đổi tên.
--    - Giữ security_invoker = true để tuân thủ RLS admin.
-- 2. admin_top_combos:
--    - Gom nhóm theo combo_id, ưu tiên tên combo hiện tại từ bảng combos (COALESCE(c.name, i.product_name)).
--    - Chỉ lấy combo_id IS NOT NULL và đơn completed.
--    - Giữ security_invoker = true.

CREATE OR REPLACE VIEW public.admin_top_products WITH (security_invoker = true) AS
SELECT 
  i.product_id,
  COALESCE(p.name, i.product_name) AS product_name,
  ((o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date AS day,
  sum(i.quantity) AS total_quantity,
  sum(i.line_total) AS total_revenue
FROM public.order_items i
JOIN public.orders o ON o.id = i.order_id
LEFT JOIN public.products p ON p.id = i.product_id
WHERE o.status = 'completed'::order_status
  AND i.product_id IS NOT NULL
GROUP BY i.product_id, COALESCE(p.name, i.product_name), (((o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date);

CREATE OR REPLACE VIEW public.admin_top_combos WITH (security_invoker = true) AS
SELECT 
  i.combo_id,
  COALESCE(c.name, i.product_name) AS combo_name,
  ((o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date AS day,
  sum(i.quantity) AS total_quantity,
  sum(i.line_total) AS total_revenue
FROM public.order_items i
JOIN public.orders o ON o.id = i.order_id
LEFT JOIN public.combos c ON c.id = i.combo_id
WHERE o.status = 'completed'::order_status
  AND i.combo_id IS NOT NULL
GROUP BY i.combo_id, COALESCE(c.name, i.product_name), (((o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date);
