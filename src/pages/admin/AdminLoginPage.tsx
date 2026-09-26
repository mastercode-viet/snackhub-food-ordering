import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import Field from "@/components/checkout/Field";
import { supabase } from "@/lib/supabase";

/**
 * Chỉ đăng nhập, không có đăng ký / quên mật khẩu. Tài khoản admin được cấp
 * sẵn qua Supabase Studio — app không tự tạo quyền cho ai.
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      // Không phân biệt "sai email" với "sai mật khẩu" — tránh dò tài khoản.
      setError("Email hoặc mật khẩu không đúng.");
      setBusy(false);
      return;
    }

    // Không chuyển trang ở đây: useAdminSession lắng nghe onAuthStateChange,
    // kiểm tra is_admin()/is_staff() rồi mới cho vào — người có session mà
    // không phải admin lẫn nhân viên sẽ bị đăng xuất lại ngay.
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-margin-mobile py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-card-lg bg-inverse-surface text-inverse-on-surface">
          <Lock size={22} strokeWidth={2.2} />
        </span>
        <div>
          <h1 className="text-headline-sm text-on-surface">Khu vực quản trị</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Sagori · chỉ dành cho nhân viên</p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card"
      >
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Field
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
        />

        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-card bg-inverse-surface px-5 text-label-lg text-inverse-on-surface transition-opacity disabled:opacity-50"
        >
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
