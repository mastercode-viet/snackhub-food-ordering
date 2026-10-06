import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAwaitingScheduledOrders, type ScheduledOrder } from "@/lib/adminQueries";
import { getDesiredDeliverySla, type DesiredLevel } from "@/lib/orderSla";
import { placeLabel } from "@/lib/delivery";

const STORAGE_KEY = "admin_scheduled_alerts_notified";
const TICK_MS = 15_000;
const RANK: Record<DesiredLevel, number> = { normal: 0, warning: 1, critical: 2 };

export type ScheduledAlert = {
  orderId: string;
  orderCode: string;
  customerName: string;
  /** "Toà A" | "Nhận tại quán" */
  place: string;
  desiredAt: string;
  level: Exclude<DesiredLevel, "normal">;
};

function loadNotified(): Map<string, DesiredLevel> {
  try {
    return new Map(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return new Map();
  }
}

function saveNotified(map: Map<string, DesiredLevel>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...map]));
  } catch {
    // ignore
  }
}

/**
 * Chuông + pop-up khi đơn hẹn giờ chạm mốc cảnh báo (còn 15p → vàng, còn 5p
 * hoặc trễ → đỏ) mà vẫn chưa chuyển "Đang giao". Mount MỘT LẦN ở <AdminLayout>
 * cùng chỗ với useOrderNotification để báo trên mọi trang /admin/*.
 *
 * Mỗi đơn chỉ báo một lần cho mỗi mức (vàng rồi đỏ), nhớ trong sessionStorage
 * để tải lại trang không kêu lại. Đơn PayOS chưa trả tiền thì không báo — đơn
 * có thể bị bỏ ngang, cùng quy tắc với chuông đơn mới.
 */
export function useScheduledOrderAlerts(playSound: () => void) {
  // null = chưa tải lần nào — chưa được kiểm tra/dọn bộ nhớ đã báo, kẻo xoá mất dữ liệu sessionStorage.
  const [orders, setOrders] = useState<ScheduledOrder[] | null>(null);
  const [alerts, setAlerts] = useState<ScheduledAlert[]>([]);
  const notified = useRef<Map<string, DesiredLevel>>(loadNotified());

  const refresh = useCallback(() => {
    fetchAwaitingScheduledOrders()
      .then(setOrders)
      .catch(() => {
        // Cảnh báo phụ — lỗi mạng thì lần tick/realtime sau thử lại, không toast giữa các trang.
      });
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 60_000);
    const channel = supabase
      .channel("admin-scheduled-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .subscribe();
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    if (orders === null) return;
    const list = orders;

    function check() {
      const now = Date.now();
      const fresh: ScheduledAlert[] = [];
      const activeIds = new Set(list.map((o) => o.id));

      for (const o of list) {
        if (!o.desired_delivery_time) continue;
        if (o.payment_method === "payos" && o.payment_status !== "paid") continue;
        const { level } = getDesiredDeliverySla(o.desired_delivery_time, now);
        if (level === "normal") continue;
        const prev = notified.current.get(o.id) ?? "normal";
        if (RANK[level] <= RANK[prev]) continue;
        notified.current.set(o.id, level);
        fresh.push({
          orderId: o.id,
          orderCode: o.order_code,
          customerName: o.customer_name,
          place: placeLabel(o),
          desiredAt: o.desired_delivery_time,
          level,
        });
      }

      // Đơn đã giao/huỷ thì gỡ khỏi pop-up và khỏi bộ nhớ đã báo.
      setAlerts((cur) => {
        const kept = cur.filter((a) => activeIds.has(a.orderId) && !fresh.some((f) => f.orderId === a.orderId));
        return fresh.length || kept.length !== cur.length ? [...fresh, ...kept] : cur;
      });
      for (const id of notified.current.keys()) if (!activeIds.has(id)) notified.current.delete(id);
      saveNotified(notified.current);

      if (fresh.length > 0) playSound();
    }

    check();
    const timer = setInterval(check, TICK_MS);
    return () => clearInterval(timer);
  }, [orders, playSound]);

  const dismiss = useCallback((orderId: string) => {
    setAlerts((cur) => cur.filter((a) => a.orderId !== orderId));
  }, []);

  return { alerts, dismiss };
}
