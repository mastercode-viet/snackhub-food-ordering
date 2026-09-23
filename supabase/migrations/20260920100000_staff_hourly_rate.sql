-- Lương/giờ cho nhân viên — dùng để GỢI Ý số tiền khi superadmin xác nhận
-- lương tháng (confirm_staff_payroll vẫn nhận p_amount tự do, không đổi RPC
-- đó — cột này chỉ để Frontend tính sẵn một con số hợp lý, admin sửa tay
-- trước khi xác nhận vẫn được).

alter table public.staff_profiles
  add column hourly_rate numeric(10, 0) not null default 0
  constraint staff_profiles_hourly_rate_non_negative check (hourly_rate >= 0);

comment on column public.staff_profiles.hourly_rate is
  'Lương/giờ (VNĐ) dùng để gợi ý số tiền lương tháng — không tự động ghi vào payroll_history.';
