-- Chỉ cho check-in khi đứng gần quán. Vị trí quán + bán kính nằm trong
-- store_settings (Admin sửa ở /admin/cai-dat). Chặn bằng trigger ở DB, không
-- chỉ ở frontend — sửa code trên trình duyệt không lách được.
--
-- Toạ độ do trình duyệt gửi lên nên vẫn có thể bị giả lập bằng app fake GPS;
-- trigger chặn được người đứng ở nhà bấm check-in, không chặn được giả mạo có chủ đích.
--
-- store_latitude/store_longitude để null = tắt kiểm tra vị trí.

alter table public.store_settings
  add column store_latitude double precision,
  add column store_longitude double precision,
  add column checkin_radius_m integer not null default 200,
  add constraint store_settings_latitude_range check (store_latitude between -90 and 90),
  add constraint store_settings_longitude_range check (store_longitude between -180 and 180),
  add constraint store_settings_checkin_radius_range check (checkin_radius_m between 20 and 5000);

-- Plus Code XRG8+CR9 Định Công, Hà Nội.
update public.store_settings
set store_latitude = 20.976038, store_longitude = 105.817109
where id = 1;

-- Khoảng cách (mét) giữa 2 toạ độ — công thức haversine, đủ chính xác ở cự ly vài km.
create or replace function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path to ''
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.enforce_checkin_location()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  s record;
  d double precision;
begin
  select store_latitude, store_longitude, checkin_radius_m into s
  from public.store_settings where id = 1;

  if s.store_latitude is null or s.store_longitude is null then
    return new;
  end if;

  if new.latitude is null or new.longitude is null then
    raise exception 'Cần bật định vị để chấm công.' using errcode = 'P0001';
  end if;

  d := public.distance_m(new.latitude, new.longitude, s.store_latitude, s.store_longitude);
  if d > s.checkin_radius_m then
    raise exception 'Bạn đang cách quán khoảng % m — chỉ được check-in trong bán kính % m.',
      round(d)::int, s.checkin_radius_m
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger time_logs_enforce_checkin_location
  before insert on public.time_logs
  for each row execute function public.enforce_checkin_location();
