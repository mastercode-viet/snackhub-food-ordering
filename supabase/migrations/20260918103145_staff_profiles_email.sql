-- Lưu email đăng nhập (auth.users.email) vào staff_profiles để Admin xem lại
-- được "tên đăng nhập" của từng nhân viên trong UI — trước giờ chỉ nằm ở
-- auth.users, admin gõ 1 lần lúc tạo tài khoản rồi mất dấu vĩnh viễn.
--
-- Đây là BẢN SAO tại thời điểm tạo tài khoản, không phải nguồn sự thật:
-- auth.users.email vẫn là nơi Supabase Auth thực sự dùng để đăng nhập. Nếu
-- sau này cho đổi email, phải đổi CẢ HAI (auth.admin.updateUserById() +
-- update cột này) trong cùng 1 Edge Function, nếu không hai nơi sẽ lệch nhau.

alter table public.staff_profiles add column email text;

update public.staff_profiles sp
set email = u.email
from auth.users u
where u.id = sp.id;

alter table public.staff_profiles
  alter column email set not null,
  add constraint staff_profiles_email_key unique (email);
