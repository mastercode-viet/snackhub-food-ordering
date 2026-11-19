-- Trang /admin/bien-the cho superadmin quản lý nhóm biến thể (biến thể mì,
-- size đồ uống…) và các lựa chọn bên trong.
--
-- Hai bảng này đã có policy ĐỌC công khai cho khách xem thực đơn, nhưng chưa có
-- policy GHI cho admin — thiếu nó thì giao diện admin không lưu được.
-- Chỉ tạo khi chưa tồn tại để chạy lại nhiều lần vẫn an toàn.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'product_option_groups'
      and policyname = 'product_option_groups_admin_all'
  ) then
    create policy product_option_groups_admin_all on public.product_option_groups
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'product_options'
      and policyname = 'product_options_admin_all'
  ) then
    create policy product_options_admin_all on public.product_options
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;
