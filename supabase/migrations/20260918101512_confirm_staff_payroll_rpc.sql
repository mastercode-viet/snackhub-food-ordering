-- RPC xác nhận thanh toán lương tháng X cho 1 nhân viên.
--
-- SECURITY INVOKER (mặc định): dựa hẳn vào policy payroll_history_admin_all
-- (WITH CHECK is_admin()) để chặn quyền — không tự kiểm tra lại is_admin()
-- trong hàm, tránh hai nơi có thể lệch nhau. Chỉ bọc plpgsql để bắt riêng
-- lỗi trùng UNIQUE(staff_id, pay_month) thành thông báo tiếng Việt dễ hiểu
-- thay vì mã lỗi Postgres thô.
create or replace function public.confirm_staff_payroll(
  p_staff_id uuid,
  p_pay_month date,
  p_amount numeric
)
returns public.payroll_history
language plpgsql
set search_path to 'public'
as $function$
declare
  v_row public.payroll_history;
begin
  insert into public.payroll_history (staff_id, pay_month, amount, confirmed_by)
  values (p_staff_id, date_trunc('month', p_pay_month)::date, p_amount, auth.uid())
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'Đã xác nhận thanh toán lương tháng % cho nhân viên này rồi.',
      to_char(date_trunc('month', p_pay_month)::date, 'MM/YYYY');
end;
$function$;

revoke all on function public.confirm_staff_payroll(uuid, date, numeric) from public;
grant execute on function public.confirm_staff_payroll(uuid, date, numeric) to authenticated;
