import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchPendingOrderCount } from "@/lib/adminQueries";
import type { AdminOrderAlertsState } from "@/hooks/useAdminOrderAlerts";
import type { Tables } from "@/types/database";

// "_v2": bản cũ tự lưu "0" mỗi lần trình duyệt chặn phát âm, nên nhiều máy đang nhớ
// nhầm là tắt — đổi khoá để ai cũng bắt đầu lại ở trạng thái mặc định BẬT.
const STORAGE_KEY = "admin_order_sound_enabled_v2";
const SOUND_SRC = "/sounds/ring.mp3";

type OrderRow = Tables<"orders">;

/**
 * Realtime trên `orders` (INSERT + UPDATE) + phát âm báo + đếm badge. Được
 * mount đúng MỘT LẦN ở <AdminLayout> (không phải ở AdminOrdersPage) để kênh
 * chạy xuyên suốt mọi trang trong khu vực /admin/*, không tắt lịm khi Admin
 * rời trang Đơn hàng sang xem Thực đơn/Thống kê... — đó chính là lỗi "không
 * hoạt động toàn cục" trước đây.
 *
 * Âm báo MẶC ĐỊNH BẬT (chỉ tắt khi Admin tự bấm tắt — lưu localStorage "0").
 * Autoplay policy của trình duyệt vẫn bắt buộc một tương tác của người dùng
 * trước khi cho .play(): hook tự "mở khoá" ở lần chạm/bấm/gõ phím ĐẦU TIÊN bất
 * kỳ đâu trên trang. Trước lúc đó `soundBlocked = true` để UI nhắc "chạm để bật âm".
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
      return localStorage.getItem(STORAGE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  // Trình duyệt đã cho phát âm chưa (cần một tương tác của người dùng trong phiên này).
  const [unlocked, setUnlocked] = useState(false);
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

  /** Phát thử không tiếng để trình duyệt ghi nhận đã được phép — phải gọi trong một sự kiện người dùng. */
  const unlockAudio = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      setUnlocked(true);
      return true;
    } catch {
      audio.muted = false;
      return false;
    }
  }, []);

  const enableSound = useCallback(async () => {
    setSoundEnabled(true);
    persist(true);
    await unlockAudio();
  }, [unlockAudio]);

  // Tự mở khoá ở lần tương tác đầu tiên bất kỳ đâu — Admin không phải tìm nút bật âm.
  useEffect(() => {
    if (unlocked) return;
    const onFirstInteraction = () => {
      void unlockAudio().then((ok) => {
        if (ok) remove();
      });
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const remove = () => events.forEach((ev) => document.removeEventListener(ev, onFirstInteraction));
    events.forEach((ev) => document.addEventListener(ev, onFirstInteraction, { passive: true }));
    return remove;
  }, [unlocked, unlockAudio]);

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
      // Trình duyệt chưa cho phát (chưa có tương tác) — GIỮ lựa chọn "bật" của Admin,
      // chỉ đánh dấu bị chặn để UI nhắc chạm vào trang; lần tương tác sau sẽ mở khoá.
      setUnlocked(false);
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

  return { soundEnabled, soundBlocked: soundEnabled && !unlocked, enableSound, disableSound, pendingCount, playSound };
}
