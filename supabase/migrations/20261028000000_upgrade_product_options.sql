-- Migration: upgrade product options for variants/serving sizes/topping quantity
alter table public.product_option_groups
  add column if not exists quantity_enabled boolean not null default false,
  add column if not exists price_mode text not null default 'delta';

alter table public.product_options
  add column if not exists max_quantity integer not null default 1,
  add column if not exists default_quantity integer not null default 0;

alter table public.topping_items
  add column if not exists max_quantity integer not null default 1,
  add column if not exists default_quantity integer not null default 0;

-- constraint price_mode
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_option_groups_price_mode_check'
  ) then
    alter table public.product_option_groups
      add constraint product_option_groups_price_mode_check
      check (price_mode in ('delta','replace'));
  end if;
end $$;