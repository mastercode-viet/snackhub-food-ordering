-- Migration: add choice_groups to combos (dev/staging only, run manually)
-- Khong chay tren production khi chua duoc duyet.
alter table public.combos
  add column if not exists choice_groups jsonb not null default '[]'::jsonb;