import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "admin_order_sound_enabled";
const SOUND_SRC = "/sounds/ring.mp3";

export type OrderNotificationState = {
  soundEnabled: boolean;
  enableSound: () => Promise<void>;
  disableSound: () => void;
};

/** Realtime INSERT trên `orders` + phát âm báo. Autoplay policy bắt buộc
 * unlock qua tương tác UI (enableSound) trước khi trình duyệt cho .play(). */
export function useOrderNotification(onNewOrder?: () => void): OrderNotificationState {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

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

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-notification")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          onNewOrder?.();
          if (!soundEnabled) return;
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = 0;
          audio.play().catch(() => {
            // Autoplay bị chặn lại (vd. tab mất focus/permission thu hồi) — tắt cờ để UI phản ánh đúng trạng thái.
            setSoundEnabled(false);
            persist(false);
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled]);

  return { soundEnabled, enableSound, disableSound };
}
