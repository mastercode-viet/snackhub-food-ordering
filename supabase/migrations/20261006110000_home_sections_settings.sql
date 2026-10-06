-- Admin bật/tắt từng mục trên trang chủ (Banner, Flash Sale, Must Try) và tự
-- chọn món cho Flash Sale. Must Try đã có cờ products.is_featured — dùng lại.
--
-- Flash Sale trước đây TỰ ĐỘNG lấy mọi món đang giảm giá. Giờ lấy theo cờ
-- products.is_flash_sale do Admin chọn; đánh dấu sẵn các món đang giảm giá để
-- trang chủ không đổi gì ngay sau khi chạy migration.

alter table public.store_settings
  add column show_banners boolean not null default true,
  add column show_flash_sale boolean not null default true,
  add column show_must_try boolean not null default true;

alter table public.products
  add column is_flash_sale boolean not null default false;

update public.products set is_flash_sale = true where discount_value > 0;
