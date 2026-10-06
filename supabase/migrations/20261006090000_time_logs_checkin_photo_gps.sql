-- Check-in kèm ảnh selfie + toạ độ GPS. Cố ý KHÔNG tạo bảng attendance riêng:
-- time_logs đã là bảng chấm công (staff_id = staff_profiles.id = auth.uid()),
-- lương/thống kê/ca làm đều đọc từ đây — thêm cột thay vì nhân đôi dữ liệu.
--
-- image_url lưu PATH trong bucket attendance_images (bucket private), không
-- phải URL công khai — Admin xem qua signed URL.
--
-- Sau 30 ngày chỉ xoá ẢNH + TOẠ ĐỘ (dữ liệu nhạy cảm), giữ nguyên dòng
-- time_logs để không mất giờ công tính lương.

alter table public.time_logs
  add column latitude double precision,
  add column longitude double precision,
  add column image_url text,
  add constraint time_logs_latitude_range check (latitude between -90 and 90),
  add constraint time_logs_longitude_range check (longitude between -180 and 180);

-- ── Storage ──────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance_images', 'attendance_images', false, 307200, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Nhân viên chỉ ghi vào thư mục của CHÍNH MÌNH: "<auth.uid()>/<uuid>.jpg".
create policy attendance_images_staff_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attendance_images'
    and public.is_staff()
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy attendance_images_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attendance_images'
    and (public.is_admin() or (storage.foldername(name))[1] = (select auth.uid())::text)
  );

-- Không cấp UPDATE/DELETE cho client — xoá chỉ qua Edge Function (service role).

-- ── Dọn ảnh + toạ độ cũ hơn 30 ngày ───────────────────────────────────────
--
-- Xoá dòng storage.objects bằng SQL KHÔNG xoá file thật trong Storage, nên
-- pg_cron gọi Edge Function purge-attendance-media (dùng Storage API) qua pg_net.
--
-- Cần tạo 2 secret trong Vault trước (không commit giá trị thật):
--   select vault.create_secret('https://<project>.supabase.co', 'project_url');
--   select vault.create_secret('<chuỗi ngẫu nhiên>', 'cron_secret');

create extension if not exists pg_net;

-- Edge Function gọi hàm này để kiểm tra header x-cron-secret — giữ secret
-- trong Vault, không cần thêm biến môi trường cho function.
create or replace function public.verify_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_secret
  );
$$;

revoke all on function public.verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

-- pg_cron chạy theo UTC: 17:00 UTC = 00:00 giờ Việt Nam.
select cron.schedule(
  'snackhub-purge-attendance-media',
  '0 17 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/purge-attendance-media',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
