-- Superadmin bật/tắt phương thức thanh toán theo hình thức đặt, tại /admin/cai-dat.
--
-- Mặc định giữ đúng quy tắc hiện hành: giao tận nơi chỉ thanh toán online
-- (PayOS); đặt tại quầy được chọn online hoặc tiền mặt. Bật lại COD cho đơn
-- giao là đường lui khi PayOS gặp sự cố.
--
-- Mỗi hình thức phải còn ít nhất 1 phương thức — nếu tắt hết thì khách không
-- đặt được, nên chặn luôn ở DB chứ không chỉ ở giao diện.
-- Edge Function create-order đọc 4 cột này để từ chối phương thức đang tắt.

alter table public.store_settings
  add column if not exists delivery_payos_enabled boolean not null default true,
  add column if not exists delivery_cod_enabled   boolean not null default false,
  add column if not exists in_store_payos_enabled boolean not null default true,
  add column if not exists in_store_cod_enabled   boolean not null default true;

alter table public.store_settings
  drop constraint if exists store_settings_delivery_payment_check,
  add constraint store_settings_delivery_payment_check
    check (delivery_payos_enabled or delivery_cod_enabled),
  drop constraint if exists store_settings_in_store_payment_check,
  add constraint store_settings_in_store_payment_check
    check (in_store_payos_enabled or in_store_cod_enabled);
