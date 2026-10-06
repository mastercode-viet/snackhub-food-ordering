-- Nút "Mở nhận đơn ngay" ở /admin/cai-dat: mở quán tức thì kể cả ngoài khung giờ.
--
-- open_override_until: khi còn hiệu lực (p_at < giá trị này) thì is_store_open()
-- bỏ qua khung open_time/close_time. Tự hết hạn (do Admin đặt = hết ngày hôm nay
-- theo timezone quán), nên không bao giờ "mở mãi" vì quên tắt. is_open = false
-- (nghỉ thủ công) vẫn thắng tất cả.

alter table public.store_settings
  add column if not exists open_override_until timestamptz;

create or replace function public.is_store_open(p_at timestamptz default now())
returns boolean
language plpgsql
stable
set search_path to 'public'
as $function$
declare s public.store_settings; t time;
begin
  select * into s from public.store_settings where id = 1;
  if not found then return false; end if;
  if not s.is_open then return false; end if;
  if s.open_override_until is not null and p_at < s.open_override_until then
    return true;
  end if;
  t := (p_at at time zone s.timezone)::time;
  if s.open_time <= s.close_time then
    return t >= s.open_time and t < s.close_time;
  else -- khung giờ vắt qua nửa đêm
    return t >= s.open_time or t < s.close_time;
  end if;
end $function$;
