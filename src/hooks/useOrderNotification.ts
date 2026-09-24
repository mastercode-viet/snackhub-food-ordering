import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchPendingOrderCount } from "@/lib/adminQueries";
import type { AdminOrderAlertsState } from "@/hooks/useAdminOrderAlerts";
import type { Tables } from "@/types/database";

const STORAGE_KEY = "admin_order_sound_enabled";
const SOUND_SRC = "/sounds/ring.mp3";

type OrderRow = Tables<"orders">;

/**
 * Realtime trên `orders` (INSERT + UPDATE) + phát âm báo + đếm badge. Được
 * mount đúng MỘT LẦN ở <AdminLayout> (không phải ở AdminOrdersPage) để kênh
 * chạy xuyên suốt mọi trang trong khu vực /admin/*, không tắt lịm khi Admin
 * rời trang Đơn hàng sang xem Thực đơn/Thống kê... — đó chính là lỗi "không
 * hoạt động toàn cục" trước đây.
 *
 * Autoplay policy bắt buộc unlock qua tương tác UI (enableSound) trước khi
 * trình duyệt cho .play().
 *
 * Hai nguồn phát âm KHÔNG trùng nhau:
 *   - Đơn COD: phát ngay lúc tạo (INSERT) — khách đặt xong là admin cần biết
 *     ngay để chuẩn bị, tiền thu sau khi giao.
 *   - Đơn Online (payos): KHÔNG phát lúc tạo (đơn có thể bị bỏ ngang giữa
 *     chừng lúc chưa trả tiền — báo sớm chỉ gây nhiễu). Chỉ phát khi
 *     payment_status chuyển sang 'paid' — đúng lúc đơn cần bếp xử lý.
 */
export function useOrderNotification(): AdminOrderAlertsState {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [pendingCount, setPendingCount] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== "undefined") {
    audioRef.current = new Audio(SOUND_SRC);
  }

  const persist = (value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const enableSound = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      setSoundEnabled(true);
      persist(true);
    } catch {
      setSoundEnabled(false);
      persist(false);
    }
  }, []);

  const disableSound = useCallback(() => {
    setSoundEnabled(false);
    persist(false);
  }, []);

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const playSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay bị chặn lại (vd. tab mất focus/permission thu hồi) — tắt cờ để UI phản ánh đúng trạng thái.
      setSoundEnabled(false);
      persist(false);
    });
  }, []);

  const refreshPendingCount = useCallback(() => {
    fetchPendingOrderCount()
      .then(setPendingCount)
      .catch(() => {
        // Badge chỉ mang tính tham khảo — im lặng bỏ qua, không toast lỗi giữa các trang khác.
      });
  }, []);

  useEffect(() => {
    refreshPendingCount();

    const channel = supabase
      .channel("admin-orders-notification")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as OrderRow;
          refreshPendingCount();
          if (order.payment_method === "cod") playSound();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const order = payload.new as OrderRow;
          const before = payload.old as Partial<OrderRow>;
          if (order.status !== before.status) refreshPendingCount();

          const justPaid = order.payment_status === "paid" && before.payment_status !== "paid";
          if (!justPaid || order.payment_method !== "payos") return;
          playSound();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [playSound, refreshPendingCount]);

  return { soundEnabled, enableSound, disableSound, pendingCount };
}
