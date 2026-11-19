-- Migration: nhóm biến thể dùng chung (Size M/L…) tạo một lần, gán cho nhiều món
--
-- Trước đây mỗi món phải có một nhóm product_option_groups riêng (product_id
-- trỏ thẳng vào món). Giờ nhóm có thể để product_id = null (nhóm dùng chung)
-- và gán cho từng món qua product_option_group_links.

begin;

alter table public.product_option_groups alter column product_id drop not null;

create table if not exists public.product_option_group_links (
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, group_id)
);

comment on table public.product_option_group_links is
  'Gán nhóm biến thể dùng chung (product_option_groups.product_id = null) cho từng món.';

create index if not exists product_option_group_links_group_id_idx
  on public.product_option_group_links (group_id);

alter table public.product_option_group_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'product_option_group_links'
      and policyname = 'product_option_group_links_public_read'
  ) then
    create policy product_option_group_links_public_read on public.product_option_group_links
      for select to anon, authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'product_option_group_links'
      and policyname = 'product_option_group_links_admin_all'
  ) then
    create policy product_option_group_links_admin_all on public.product_option_group_links
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- Gom các nhóm "Size" riêng của từng món thành nhóm dùng chung theo mức phụ phí:
-- các món có cùng mức L (2.000đ, 3.000đ, 5.000đ…) dùng chung một nhóm.
do $$
declare
  r record;
  shared_id uuid;
  shared_name text;
begin
  for r in
    select distinct l.price_delta as l_delta
    from public.product_option_groups g
    join public.product_options l
      on l.group_id = g.id and lower(l.name) = 'size l'
    where g.product_id is not null and lower(g.name) = 'size'
    order by l.price_delta
  loop
    select g.id into shared_id
    from public.product_option_groups g
    join public.product_options o
      on o.group_id = g.id and lower(o.name) = 'size l' and o.price_delta = r.l_delta
    where g.product_id is null and lower(g.name) like 'size%'
    limit 1;

    if shared_id is null then
      shared_name := format('Size (+%sđ)', r.l_delta);
      insert into public.product_option_groups
        (product_id, name, is_required, min_select, max_select, price_mode, quantity_enabled, sort_order)
      values (null, shared_name, true, 1, 1, 'delta', false, 0)
      returning id into shared_id;

      insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
      values (shared_id, 'Size M', 0, true, 0),
             (shared_id, 'Size L', r.l_delta, true, 1);
    end if;

    insert into public.product_option_group_links (product_id, group_id, sort_order)
    select g.product_id, shared_id, g.sort_order
    from public.product_option_groups g
    join public.product_options l
      on l.group_id = g.id and lower(l.name) = 'size l' and l.price_delta = r.l_delta
    where g.product_id is not null and lower(g.name) = 'size'
    on conflict (product_id, group_id) do nothing;

    -- Nhóm riêng cũ đã được thay bằng nhóm dùng chung.
    delete from public.product_option_groups g
    using public.product_options l
    where l.group_id = g.id
      and lower(l.name) = 'size l'
      and l.price_delta = r.l_delta
      and g.product_id is not null
      and lower(g.name) = 'size';
  end loop;
end $$;

commit;
