import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "@/store/toast";

/**
 * Máy ở quầy là máy dùng chung — nhân viên bỏ đi mà phiên còn mở là ai cũng
 * sửa được menu. Hết 15 phút không thao tác thì tự đăng xuất.
 */
const IDLE_LIMIT_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export type AdminStatus = "checking" | "authed" | "anon";

export function useAdminSession() {
  const [status, setStatus] = useState<AdminStatus>("checking");
  const [session, setSession] = useState<Session | null>(null);
  // isAdmin: is_admin() true — admin cũ hoặc staff_profiles.role='superadmin', toàn quyền.
  // isStaff: is_staff() true — có hồ sơ staff_profiles đang active (kể cả superadmin),
  // dùng để hiện Widget Check-in/Check-out (cần staff_id hợp lệ để insert time_logs).
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsAdmin(false);
    setIsStaff(false);
    setStatus("anon");
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Có session chưa đủ: tài khoản phải là admin (is_admin()) HOẶC nhân viên
    // (is_staff()) — cùng hai hàm mà RLS dùng, nên UI không thể "rộng tay"
    // hơn tầng DB. Ai không thuộc cả hai (không phải admin cũ, không có hồ sơ
    // staff_profiles) thì bị đăng xuất ngay.
    async function resolve(next: Session | null) {
      if (!next) {
        if (!cancelled) {
          setSession(null);
          setIsAdmin(false);
          setIsStaff(false);
          setStatus("anon");
        }
        return;
      }

      const [adminRes, staffRes] = await Promise.all([
        supabase.rpc("is_admin"),
        supabase.rpc("is_staff"),
      ]);
      if (cancelled) return;

      const admin = !adminRes.error && adminRes.data === true;
      const staff = !staffRes.error && staffRes.data === true;

      if (!admin && !staff) {
        await supabase.auth.signOut();
        if (cancelled) return;
        setSession(null);
        setIsAdmin(false);
        setIsStaff(false);
        setStatus("anon");
        return;
      }

      setIsAdmin(admin);
      setIsStaff(staff);
      setSession(next);
      setStatus("authed");
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      void resolve(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "authed") return;

    const arm = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void signOut();
        toast.info("Đã tự đăng xuất do không thao tác.");
      }, IDLE_LIMIT_MS);
    };

    arm();
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, arm, { passive: true });

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, arm);
    };
  }, [status, signOut]);

  return { status, session, signOut, isAdmin, isStaff };
}
