-- Sửa lỗi "Xác nhận thanh toán lương" luôn thất bại với tài khoản admin cũ
-- (bảng `admins`, không có dòng staff_profiles): confirm_staff_payroll() đặt
-- confirmed_by = auth.uid(), nhưng cột này trước đó FK vào staff_profiles(id)
-- — admin cũ is_admin() = true (đủ quyền qua RLS) nhưng KHÔNG có dòng
-- staff_profiles nên insert vỡ FK ngay tại bước cuối.
--
-- "Người xác nhận" đúng ra là BẤT KỲ danh tính is_admin() nào (admin cũ HOẶC
-- superadmin trong staff_profiles), không riêng ai có hồ sơ staff_profiles.
-- Nên trỏ thẳng vào auth.users(id) — nguồn danh tính chung của cả hai loại
-- admin — thay vì staff_profiles(id).

alter table public.payroll_history
  drop constraint payroll_history_confirmed_by_fkey;

alter table public.payroll_history
  add constraint payroll_history_confirmed_by_fkey
  foreign key (confirmed_by) references auth.users (id) on delete restrict;
