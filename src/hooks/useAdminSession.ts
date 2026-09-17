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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStatus("anon");
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Có session chưa đủ: tài khoản phải nằm trong bảng admins. is_admin() là
    // cùng một hàm mà RLS dùng, nên UI không thể "rộng tay" hơn tầng DB.
    async function resolve(next: Session | null) {
      if (!next) {
        if (!cancelled) {
          setSession(null);
          setStatus("anon");
        }
        return;
      }

      const { data, error } = await supabase.rpc("is_admin");
      if (cancelled) return;

      if (error || data !== true) {
        await supabase.auth.signOut();
        if (cancelled) return;
        setSession(null);
        setStatus("anon");
        return;
      }

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

  return { status, session, signOut };
}
