-- Biến thể Size M/L cho đồ uống (chạy tay ở dev/staging, chưa áp production).
--
-- Cách làm: giá M trở thành giá gốc của món, Size L cộng thêm phần chênh
-- (price_mode = delta). Nhờ vậy món lẻ, combo và create-order đều tính đúng
-- mà không phải sửa công thức giá ở đâu cả.
--
-- Các nhóm topping "Up size…" cũ (Size L +3.000/+5.000) bị gỡ khỏi đồ uống,
-- nếu để nguyên khách sẽ bị cộng tiền size hai lần.

begin;

-- 1. Giá M theo menu drink (M, L)
create temp table _drink_size_prices (name text primary key, m_price integer, l_price integer) on commit drop;
insert into _drink_size_prices (name, m_price, l_price) values
  ('Trà chanh',      12000, 15000),
  ('Trà tắc',        12000, 15000),
  ('Trà thái đỏ',    12000, 15000),
  ('Trà thái xanh',  12000, 15000),
  ('Sữa đậu',        10000, 12000),
  ('Milo dầm',       20000, 25000),
  ('Choco Mint',     25000, 30000),
  ('Trà vải lài',    20000, 25000);

-- 2. Giá gốc = giá size M
update products p
set base_price = s.m_price, updated_at = now()
from _drink_size_prices s
join categories c on c.slug = 'do-uong'
where p.category_id = c.id
  and p.name = s.name
  and p.base_price <> s.m_price;

-- 3. Nhóm biến thể "Size" (chọn 1, bắt buộc) cho từng món nước
insert into product_option_groups (product_id, name, is_required, min_select, max_select, price_mode, quantity_enabled, sort_order)
select p.id, 'Size', true, 1, 1, 'delta', false, 0
from products p
join categories c on c.id = p.category_id
join _drink_size_prices s on s.name = p.name
where c.slug = 'do-uong'
  and not exists (
    select 1 from product_option_groups g
    where g.product_id = p.id and lower(g.name) = 'size'
  );

-- 4. Lựa chọn M (0đ) và L (chênh lệch so với M)
insert into product_options (group_id, name, price_delta, is_available, sort_order)
select g.id, 'Size M', 0, true, 0
from product_option_groups g
join products p on p.id = g.product_id
join _drink_size_prices s on s.name = p.name
where lower(g.name) = 'size'
  and not exists (
    select 1 from product_options o where o.group_id = g.id and lower(o.name) = 'size m'
  );

insert into product_options (group_id, name, price_delta, is_available, sort_order)
select g.id, 'Size L', s.l_price - s.m_price, true, 1
from product_option_groups g
join products p on p.id = g.product_id
join _drink_size_prices s on s.name = p.name
where lower(g.name) = 'size'
  and not exists (
    select 1 from product_options o where o.group_id = g.id and lower(o.name) = 'size l'
  );

-- 5. Gỡ topping "Up size…" khỏi đồ uống để không cộng tiền size lần hai
delete from product_topping_groups pg
using products p, categories c, topping_groups tg
where pg.product_id = p.id
  and p.category_id = c.id
  and pg.topping_group_id = tg.id
  and c.slug = 'do-uong'
  and tg.name ilike 'up size%';

-- 6. Dọn nhóm "Up size…" không còn gắn với món nào
delete from topping_groups tg
where tg.name ilike 'up size%'
  and not exists (
    select 1 from product_topping_groups pg where pg.topping_group_id = tg.id
  );

commit;
