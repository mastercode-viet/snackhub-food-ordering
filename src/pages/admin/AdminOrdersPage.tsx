import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Clock,
  Flame,
  Layers,
  Phone,
  RotateCw,
  Timer,
} from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { useAdminOrderAlerts } from "@/hooks/useAdminOrderAlerts";
import OrderSoundToggle from "@/components/admin/OrderSoundToggle";
import AdminSearchInput from "@/components/admin/AdminSearchInput";
import type { AdminOutletContext } from "@/routes/AdminLayout";
import { supabase } from "@/lib/supabase";
import { normalizeSearch } from "@/lib/text";
import { formatVnd, formatTime } from "@/lib/format";
import { toast } from "@/store/toast";
import { OrderStatusBadge, STATUS_LABEL } from "@/components/order/OrderStatus";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  cancelOrderAsAdmin,
  fetchAdminOrders,
  markOrderPaid,
  setOrderStatus,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/adminQueries";

/** Bước kế tiếp của một đơn chạy trơn tru. Huỷ nằm ngoài luồng này. */
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending_confirmation: { status: "preparing", label: "Xác nhận đơn" },
  preparing: { status: "delivering", label: "Bắt đầu giao" },
  delivering: { status: "completed", label: "Hoàn tất đơn" },
};

const TABS: Array<{ key: OrderStatus | "all" | "sla_overdue"; label: string }> = [
  { key: "pending_confirmation", label: "Chờ xác nhận" },
  { key: "preparing", label: "Đang làm" },
  { key: "delivering", label: "Đang giao" },
  { key: "completed", label: "Hoàn tất" },
  { key: "cancelled", label: "Đã huỷ" },
  { key: "all", label: "Tất cả" },
  { key: "sla_overdue", label: "⚠️ Trễ hạn SLA" },
];

export type SlaLevel = "normal" | "warning" | "critical";

export function getOrderSla(
  order: AdminOrder,
  now: number,
): {
  elapsedMinutes: number;
  level: SlaLevel;
  label: string;
} {
  const isFinished = order.status === "completed" || order.status === "cancelled";
  const createdMs = new Date(order.created_at).getTime();
  const elapsedMs = Math.max(0, now - createdMs);
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

  if (isFinished) {
    return {
      elapsedMinutes,
      level: "normal",
      label: `${elapsedMinutes}p`,
    };
  }

  // Đơn chưa hoàn tất:
  // >= 20 phút: Critical (Đỏ - Trễ hạn SLA)
  // >= 15 phút: Warning (Vàng - Cảnh báo trễ)
  if (elapsedMinutes >= 20) {
    return {
      elapsedMinutes,
      level: "critical",
      label: `${elapsedMinutes}p · Trễ SLA`,
    };
  }

  if (elapsedMinutes >= 15) {
    return {
      elapsedMinutes,
      level: "warning",
      label: `${elapsedMinutes}p · Sắp trễ`,
    };
  }

  return {
    elapsedMinutes,
    level: "normal",
    label: `${elapsedMinutes}p`,
  };
}

export default function AdminOrdersPage() {
  const { isAdmin } = useOutletContext<AdminOutletContext>();
  const state = useAsync(() => fetchAdminOrders(), []);
  const { soundEnabled, enableSound, disableSound } = useAdminOrderAlerts();
  const [tab, setTab] = useState<OrderStatus | "all" | "sla_overdue">("pending_confirmation");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  // Lọc + gom nhóm theo toà nhà: chỉ Superadmin có nhu cầu điều phối giao
  // hàng theo khu vực toàn quán; staff xử lý đơn theo hàng đợi thông thường.
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [groupByBuilding, setGroupByBuilding] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  // Cập nhật bộ đếm thời gian thực mỗi 15 giây để timer và cảnh báo nhảy số chính xác
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Realtime chỉ dành cho Admin: Supabase Realtime tôn trọng RLS và `orders`
   * chỉ có policy cho authenticated. Khách vẫn phải poll get_order_by_code.
   */
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        state.reload();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orders = state.data ?? [];

  // Thống kê SLA toàn cục
  const { criticalCount, warningCount } = useMemo(() => {
    let crit = 0;
    let warn = 0;
    for (const o of orders) {
      if (o.status !== "completed" && o.status !== "cancelled") {
        const sla = getOrderSla(o, now);
        if (sla.level === "critical") crit++;
        else if (sla.level === "warning") warn++;
      }
    }
    return { criticalCount: crit, warningCount: warn };
  }, [orders, now]);

  // Danh sách toà nhà có đơn thật, để đổ vào <select> lọc — không bày sẵn
  // toà không ai đặt, và Superadmin biết ngay khu nào đang phát sinh đơn.
  const buildings = useMemo(() => {
    return [...new Set(orders.map((o) => o.building))].sort((a, b) => a.localeCompare(b, "vi"));
  }, [orders]);

  // Lọc và Sắp xếp ưu tiên: Đơn trễ hạn (Critical -> Warning) tự động đẩy lên đầu danh sách!
  const visible = useMemo(() => {
    let filtered = orders;
    if (tab === "sla_overdue") {
      filtered = orders.filter((o) => {
        if (o.status === "completed" || o.status === "cancelled") return false;
        const sla = getOrderSla(o, now);
        return sla.level === "critical" || sla.level === "warning";
      });
    } else if (tab !== "all") {
      filtered = orders.filter((o) => o.status === tab);
    }

    if (isAdmin && buildingFilter !== "all") {
      filtered = filtered.filter((o) => o.building === buildingFilter);
    }

    const q = normalizeSearch(debouncedSearch);
    if (q) {
      filtered = filtered.filter(
        (o) =>
          normalizeSearch(o.order_code).includes(q) ||
          normalizeSearch(o.customer_name).includes(q) ||
          o.customer_phone.includes(q),
      );
    }

    // Sắp xếp ưu tiên theo SLA đối với các đơn chưa hoàn thành
    return [...filtered].sort((a, b) => {
      const aFinished = a.status === "completed" || a.status === "cancelled";
      const bFinished = b.status === "completed" || b.status === "cancelled";

      if (aFinished !== bFinished) {
        return aFinished ? 1 : -1; // Đơn đang xử lý luôn lên trước
      }

      const aSla = getOrderSla(a, now);
      const bSla = getOrderSla(b, now);

      const priorityWeight = { critical: 3, warning: 2, normal: 1 };
      const aWeight = aFinished ? 0 : priorityWeight[aSla.level];
      const bWeight = bFinished ? 0 : priorityWeight[bSla.level];

      if (aWeight !== bWeight) {
        return bWeight - aWeight; // Đơn trễ hơn xếp trước
      }

      // Nếu cùng mức ưu tiên, đơn chờ lâu hơn (elapsedMinutes lớn hơn) xếp trước
      if (!aFinished && aSla.elapsedMinutes !== bSla.elapsedMinutes) {
        return bSla.elapsedMinutes - aSla.elapsedMinutes;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, tab, now, isAdmin, buildingFilter, debouncedSearch]);

  // Gom `visible` (đã lọc + sắp SLA) thành từng nhóm theo toà nhà, giữ
  // nguyên thứ tự ưu tiên SLA bên trong mỗi nhóm — chỉ đổi cách trình bày,
  // không đổi cách xếp hạng đơn cần xử lý trước.
  const groupedByBuilding = useMemo(() => {
    if (!groupByBuilding) return null;
    const map = new Map<string, AdminOrder[]>();
    for (const o of visible) {
      const list = map.get(o.building) ?? [];
      list.push(o);
      map.set(o.building, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));
  }, [visible, groupByBuilding]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return map;
  }, [orders]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  async function run(action: () => Promise<unknown>, okMessage: string) {
    try {
      await action();
      toast.success(okMessage);
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được, thử lại nhé.");
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Đơn hàng</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-headline-sm text-on-surface">Hàng đợi đơn hàng</h1>
            {(criticalCount > 0 || warningCount > 0) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2.5 py-0.5 text-label-xs font-bold text-error animate-pulse">
                <AlertTriangle size={13} strokeWidth={2.5} />
                {criticalCount + warningCount} đơn cần xử lý gấp
              </span>
            )}
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Tự động cập nhật Realtime. Tích hợp bộ đếm SLA: đơn quá 15-20 phút tự động đổi màu
            và được đẩy lên vị trí ưu tiên cao nhất.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <OrderSoundToggle enabled={soundEnabled} onEnable={() => void enableSound()} onDisable={disableSound} />
          <button
            type="button"
            onClick={state.reload}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            <RotateCw size={16} strokeWidth={2.2} />
            Tải lại
          </button>
        </div>
      </header>

      {/* Thanh cảnh báo tổng quan SLA nếu có đơn bị trễ */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card-lg border border-error/30 bg-error-container/40 px-4 py-3 text-on-error-container">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-error text-on-error">
              <Timer size={17} strokeWidth={2.4} />
            </span>
            <div className="text-label-md">
              <strong>Cảnh báo trễ hạn (SLA Alert):</strong>{" "}
              <span>
                {criticalCount > 0 && (
                  <span className="font-bold text-error">
                    {criticalCount} đơn trễ hạn (&gt;20 phút){" "}
                  </span>
                )}
                {criticalCount > 0 && warningCount > 0 && "· "}
                {warningCount > 0 && (
                  <span className="font-semibold text-amber-700">
                    {warningCount} đơn sắp trễ (&gt;15 phút)
                  </span>
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTab("sla_overdue")}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-error px-3 text-label-sm font-bold text-on-error shadow-sm hover:opacity-90"
          >
            Xem các đơn trễ
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          let count = 0;
          if (t.key === "all") count = orders.length;
          else if (t.key === "sla_overdue") count = criticalCount + warningCount;
          else count = counts.get(t.key) ?? 0;

          const isSlaTab = t.key === "sla_overdue";

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-label-md font-semibold transition-all ${
                active
                  ? isSlaTab
                    ? "bg-error text-on-error shadow-cta"
                    : "bg-primary-container text-on-primary-container shadow-cta"
                  : isSlaTab && count > 0
                    ? "border border-error/50 bg-error-container/50 text-error hover:bg-error-container"
                    : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.2 text-label-xs ${
                  active
                    ? "bg-black/20 text-inherit"
                    : isSlaTab && count > 0
                      ? "bg-error text-on-error"
                      : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <AdminSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Tìm theo mã đơn, tên khách hoặc số điện thoại…"
      />

      {/* Lọc/gom nhóm theo toà nhà: chỉ Superadmin điều phối giao hàng theo khu vực toàn quán. */}
      {isAdmin && buildings.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card-lg bg-surface-container-lowest p-3 shadow-card">
          <Building2 size={16} strokeWidth={2.2} className="shrink-0 text-on-surface-variant" />
          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="min-h-[40px] rounded-card border border-outline-variant bg-surface-container-lowest px-2.5 text-label-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          >
            <option value="all">Tất cả toà nhà</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                Toà {b}
              </option>
            ))}
          </select>

          <button
            type="button"
            role="switch"
            aria-checked={groupByBuilding}
            onClick={() => setGroupByBuilding((v) => !v)}
            className={`ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-label-sm font-semibold transition-colors ${
              groupByBuilding
                ? "bg-primary-container text-on-primary-container"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <Layers size={14} strokeWidth={2.4} />
            Gom nhóm theo toà nhà
          </button>
        </div>
      )}

      {state.loading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
          <section className="flex min-w-0 flex-1 flex-col rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
            {visible.length === 0 ? (
              <EmptyState
                icon="🧾"
                title={
                  debouncedSearch.trim()
                    ? "Không tìm thấy đơn nào khớp"
                    : tab === "sla_overdue"
                      ? "Tuyệt vời! Không có đơn nào trễ hạn"
                      : "Không có đơn nào ở mục này"
                }
                description={
                  debouncedSearch.trim()
                    ? "Thử tìm với mã đơn, tên khách hoặc số điện thoại khác."
                    : tab === "sla_overdue"
                      ? "Mọi đơn hàng đều được xử lý và giao đúng hạn mức thời gian."
                      : "Đơn mới sẽ tự xuất hiện ngay khi khách đặt."
                }
              />
            ) : groupedByBuilding ? (
              <div className="flex flex-col gap-4">
                {groupedByBuilding.map(([building, buildingOrders]) => (
                  <div key={building}>
                    <div className="flex items-center gap-2 px-1 pb-1.5">
                      <Building2 size={14} strokeWidth={2.4} className="text-on-surface-variant" />
                      <p className="text-label-sm font-bold uppercase tracking-wide text-on-surface-variant">
                        Toà {building}
                      </p>
                      <span className="rounded-full bg-surface-container px-1.5 py-0.2 text-label-xs text-on-surface-variant">
                        {buildingOrders.length}
                      </span>
                    </div>
                    <ul className="flex flex-col divide-y divide-outline-variant">
                      {buildingOrders.map((order) => (
                        <OrderRow
                          key={order.id}
                          order={order}
                          now={now}
                          selected={order.id === selectedId}
                          onSelect={() => setSelectedId(order.id)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {visible.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    now={now}
                    selected={order.id === selectedId}
                    onSelect={() => setSelectedId(order.id)}
                  />
                ))}
              </ul>
            )}
          </section>

          <aside className="w-full shrink-0 xl:w-[420px]">
            {selected ? (
              <OrderPanel
                order={selected}
                now={now}
                onRun={run}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
                Chọn một đơn để xem chi tiết món, địa chỉ giao, thời gian SLA và chuyển trạng thái.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function OrderPanel({
  order,
  now,
  onRun,
  onClose,
}: {
  order: AdminOrder;
  now: number;
  onRun: (action: () => Promise<unknown>, okMessage: string) => Promise<void>;
  onClose: () => void;
}) {
  const { email, isAdmin, staffId } = useOutletContext<AdminOutletContext>();
  const [cancelling, setCancelling] = useState(false);
  const next = NEXT[order.status];
  // Đơn VietQR chỉ được đẩy tới khi webhook đã xác nhận tiền về — tránh làm đồ
  // cho đơn chưa trả rồi mới phát hiện khách bỏ ngang.
  const blockedUnpaidPayos = order.payment_method === "payos" && order.payment_status !== "paid";
  // "Thu tiền trước, Hoàn tất sau" — áp cho MỌI phương thức thanh toán, không
  // riêng payos. DB (orders_stamp_status) đã chặn cứng ở tầng trigger; disable
  // ở đây chỉ để khỏi bấm-rồi-toast-lỗi.
  const blockedUnpaidComplete = next?.status === "completed" && order.payment_status !== "paid";
  // "Người giao là người thu tiền" — đơn đã có người nhận giao (assigned_staff_id
  // set lúc chuyển sang 'delivering') thì chỉ đúng người đó hoặc admin mới bấm
  // "Đã thu tiền" được. Đơn chưa qua bước giao (assigned_staff_id còn null) thì
  // không chặn — DB cũng xử lý y hệt logic này.
  const blockedNotAssignedStaff =
    !isAdmin && order.assigned_staff_id !== null && order.assigned_staff_id !== staffId;
  const canCancel = order.status !== "completed" && order.status !== "cancelled";
  const sla = getOrderSla(order, now);
  const isFinished = order.status === "completed" || order.status === "cancelled";

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-2 border-b border-outline-variant/60 pb-3">
        <div>
          <p className="font-mono text-headline-sm font-bold text-on-surface">{order.order_code}</p>
          <p className="text-label-sm text-on-surface-variant">
            Đặt lúc: {formatTime(order.created_at)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Cảnh báo SLA chi tiết khi đơn bị chậm hoặc trễ */}
      {!isFinished && sla.level !== "normal" && (
        <div
          className={`flex items-start gap-2.5 rounded-card p-3 text-label-sm font-medium ${
            sla.level === "critical"
              ? "border border-error bg-error-container text-on-error-container"
              : "border border-amber-400 bg-amber-50 text-amber-900"
          }`}
        >
          <AlertTriangle
            size={18}
            className={`shrink-0 mt-0.5 ${
              sla.level === "critical" ? "text-error animate-bounce" : "text-amber-600"
            }`}
            strokeWidth={2.5}
          />
          <div>
            <p className="font-bold">
              {sla.level === "critical"
                ? `⚠️ Đơn đã trôi qua ${sla.elapsedMinutes} phút (Vượt ngưỡng SLA 20p)!`
                : `⏳ Đơn đã trôi qua ${sla.elapsedMinutes} phút (Ngưỡng cảnh báo 15p).`}
            </p>
            <p className="mt-0.5 text-label-xs opacity-90">
              Vui lòng ưu tiên làm đồ và giao ngay cho khách để tránh đánh giá tiêu cực.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-card bg-surface-container-low p-3">
        <p className="text-label-md font-bold text-on-surface">{order.customer_name}</p>
        <a
          href={`tel:${order.customer_phone}`}
          className="mt-0.5 inline-flex min-h-[44px] items-center gap-1.5 text-label-md font-semibold text-primary hover:underline"
        >
          <Phone size={14} strokeWidth={2.4} />
          {order.customer_phone}
        </a>
        <p className="text-body-sm text-on-surface-variant">
          Toà <strong className="text-on-surface">{order.building}</strong>
          {order.floor ? ` · Tầng ${order.floor}` : ""}
          {order.room ? ` · Phòng ${order.room}` : ""}
          {order.class_name ? ` · Lớp ${order.class_name}` : ""}
        </p>
        {order.delivery_note && (
          <p className="mt-1.5 rounded-card-sm bg-surface-container px-2.5 py-1.5 text-body-sm italic text-on-surface">
            “{order.delivery_note}”
          </p>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-outline-variant">
        {order.order_items.map((item) => {
          return (
            <li key={item.id} className="flex items-start gap-2 py-2">
              <span className="text-label-md font-bold text-on-surface">{item.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className="text-body-md font-semibold text-on-surface">{item.product_name}</p>
                {item.options.length > 0 && (
                  <p className="text-body-sm text-on-surface-variant">
                    {item.options.map((o) => o.option_name).join(", ")}
                  </p>
                )}
                {item.combo_items_snapshot.length > 0 && (
                  <p className="text-body-sm text-on-surface-variant">
                    {item.combo_items_snapshot.map((c) => `${c.quantity}× ${c.product_name}`).join(" · ")}
                  </p>
                )}
                {item.item_note && (
                  <p className="text-body-sm italic text-on-surface-variant">“{item.item_note}”</p>
                )}
              </div>
              <span className="shrink-0 text-label-md font-bold text-on-surface">
                {formatVnd(item.line_total)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1 border-t border-outline-variant pt-space-md text-body-sm">
        <Row label="Tạm tính" value={formatVnd(order.subtotal)} />
        {order.discount_amount > 0 && (
          <Row
            label={`Giảm giá${order.discount_code ? ` (${order.discount_code})` : ""}`}
            value={`−${formatVnd(order.discount_amount)}`}
          />
        )}
        <Row label="Phí giao" value={order.shipping_fee > 0 ? formatVnd(order.shipping_fee) : "Miễn phí"} />
        <div className="mt-1 flex items-center justify-between border-t border-outline-variant pt-2">
          <span className="text-label-lg font-bold text-on-surface">Tổng thu</span>
          <span className="text-headline-sm font-extrabold text-primary">{formatVnd(order.total_amount)}</span>
        </div>
        <p className="text-label-sm text-on-surface-variant">
          {order.payment_method === "cod" ? "Tiền mặt khi nhận (COD)" : "Chuyển khoản VietQR"} ·{" "}
          <strong className={order.payment_status === "paid" ? "text-secondary font-bold" : "text-on-surface"}>
            {order.payment_status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
          </strong>
        </p>
        {order.assigned_staff_id && (
          <p className="text-label-sm text-on-surface-variant">
            Người giao:{" "}
            <strong className="text-on-surface">{order.assigned_staff?.full_name ?? "—"}</strong>
          </p>
        )}
        {order.payment_method === "cod" && order.payment_status === "paid" && (
          <p className="text-label-sm text-on-surface-variant">
            Thu bởi:{" "}
            {/* collected_by_staff_id chỉ được trigger gắn khi người xác nhận có hồ sơ
                staff_profiles (xem 20260924090000_delivery_and_payment_lock.sql) — rỗng
                nghĩa là superadmin xác nhận, không phải thiếu dữ liệu. */}
            <strong className="text-on-surface">{order.collected_by_staff?.full_name ?? "Cô chủ nhỏ"}</strong>
          </p>
        )}
      </div>

      {order.status === "cancelled" && order.cancel_reason && (
        <p className="rounded-card bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          Lý do huỷ: {order.cancel_reason}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {next && (
          <>
            <button
              type="button"
              disabled={blockedUnpaidPayos || blockedUnpaidComplete}
              onClick={() =>
                void onRun(
                  () => setOrderStatus(order.id, next.status),
                  `Đơn ${order.order_code}: ${STATUS_LABEL[next.status]}.`,
                )
              }
              className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {next.label}
            </button>
            {blockedUnpaidPayos && (
              <p className="text-body-sm font-medium text-error">
                Đơn VietQR chưa nhận được tiền — chờ khách thanh toán xong mới duyệt được.
              </p>
            )}
            {!blockedUnpaidPayos && blockedUnpaidComplete && (
              <p className="text-body-sm font-medium text-error">
                Đơn chưa xác nhận thanh toán — thu tiền xong mới Hoàn tất được.
              </p>
            )}
          </>
        )}

        {/* Chỉ đơn COD mới cần nhân viên bấm tay — đơn PayOS được webhook tự đánh dấu paid. */}
        {/* Xác nhận gắn với danh tính phiên đăng nhập hiện tại — collected_by_staff_id
            do trigger DB tự gắn auth.uid() của người gọi, không đọc từ client, nhưng
            người bấm phải thấy rõ mình đang xác nhận DƯỚI TÊN AI trước khi chốt số
            tiền, tránh bấm nhầm hộ ca trước/ca sau. */}
        {order.payment_method === "cod" && order.payment_status !== "paid" && order.status !== "cancelled" && (
          <>
            <button
              type="button"
              disabled={blockedNotAssignedStaff}
              onClick={() => {
                const ok = window.confirm(
                  `Xác nhận đã nhận đủ ${formatVnd(order.total_amount)} tiền mặt cho đơn ${order.order_code}?\n\nGhi nhận dưới tài khoản: ${email}`,
                );
                if (!ok) return;
                void onRun(() => markOrderPaid(order.id), "Đã ghi nhận thanh toán.");
              }}
              className="min-h-[44px] rounded-card border border-outline-variant text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              Đã thu tiền
            </button>
            {blockedNotAssignedStaff && (
              <p className="text-body-sm font-medium text-error">
                Đơn này do {order.assigned_staff?.full_name ?? "nhân viên khác"} giao — chỉ người
                đó mới xác nhận thu tiền được.
              </p>
            )}
          </>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => setCancelling(true)}
            className="min-h-[44px] rounded-card border border-outline-variant text-label-md text-error transition-colors hover:bg-error-container"
          >
            Huỷ đơn
          </button>
        )}
      </div>

      {cancelling && (
        <CancelOrderModal
          order={order}
          onClose={() => setCancelling(false)}
          onConfirm={(reason) => {
            setCancelling(false);
            onClose();
            void onRun(() => cancelOrderAsAdmin(order.id, reason), "Đã huỷ đơn.");
          }}
        />
      )}
    </section>
  );
}

/**
 * Bắt buộc nhập lý do — không có lối tắt "OK trống" như prompt() cũ. Đơn đã
 * `payment_status='paid'` thì tiền THẬT đã vào tài khoản quán, huỷ xong khách
 * cần được hoàn tiền tay qua chuyển khoản/COD ngược lại, nên hiện cảnh báo
 * riêng để Admin không huỷ nhầm mà quên xử lý hoàn tiền.
 */
function CancelOrderModal({
  order,
  onClose,
  onConfirm,
}: {
  order: AdminOrder;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const wasPaid = order.payment_status === "paid";
  const trimmed = reason.trim();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-on-surface/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-card-lg bg-surface-container-lowest p-5 shadow-sheet">
        <h3 className="text-headline-sm font-bold text-on-surface">Huỷ đơn {order.order_code}</h3>

        {wasPaid && (
          <p className="mt-2 rounded-card bg-error-container px-3.5 py-2.5 text-body-sm font-medium text-on-error-container">
            Đơn này đã thu {formatVnd(order.total_amount)} — huỷ xong Admin cần chủ động hoàn tiền
            cho khách. Lý do huỷ sẽ hiện kèm số điện thoại hỗ trợ hoàn tiền trên trang đơn của khách.
          </p>
        )}

        <label className="mt-4 block text-label-sm font-semibold text-on-surface-variant" htmlFor="cancel-reason">
          Lý do huỷ (bắt buộc)
        </label>
        <textarea
          id="cancel-reason"
          autoFocus
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Vd: Hết nguyên liệu, khách yêu cầu huỷ, đặt nhầm..."
          className="mt-1.5 w-full rounded-card border border-outline-variant px-3.5 py-2.5 text-body-md text-on-surface outline-none focus:border-primary"
        />

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-card border border-outline-variant text-label-md font-semibold text-on-surface-variant"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={!trimmed}
            onClick={() => onConfirm(trimmed)}
            className="h-11 flex-1 rounded-card bg-error text-label-md font-bold text-on-error disabled:cursor-not-allowed disabled:opacity-40"
          >
            Xác nhận huỷ
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-medium text-on-surface">{value}</span>
    </div>
  );
}

/** 1 dòng đơn trong hàng đợi — tách khỏi AdminOrdersPage để dùng chung cho cả danh sách phẳng lẫn danh sách gom theo toà nhà. */
function OrderRow({
  order,
  now,
  selected,
  onSelect,
}: {
  order: AdminOrder;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const sla = getOrderSla(order, now);
  const isFinished = order.status === "completed" || order.status === "cancelled";

  // Định kiểu khung cảnh báo SLA cho từng thẻ đơn
  let alertCardClass = "hover:bg-surface-container-low";
  if (selected) {
    alertCardClass = "bg-surface-container ring-2 ring-primary/40";
  } else if (!isFinished) {
    if (sla.level === "critical") {
      alertCardClass = "border-l-4 border-l-error bg-error-container/30 hover:bg-error-container/50";
    } else if (sla.level === "warning") {
      alertCardClass = "border-l-4 border-l-amber-500 bg-amber-50/50 hover:bg-amber-100/50";
    }
  }

  return (
    <li className="py-1">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={`flex w-full min-h-[48px] flex-wrap items-center gap-x-3 gap-y-1.5 rounded-card px-3 py-3 text-left transition-all ${alertCardClass}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-label-md font-bold text-on-surface">{order.order_code}</span>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Huy hiệu bộ đếm thời gian SLA trực tiếp trên thẻ */}
        {!isFinished ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-xs font-bold ${
              sla.level === "critical"
                ? "bg-error text-on-error animate-pulse shadow-sm"
                : sla.level === "warning"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {sla.level === "critical" ? (
              <AlertTriangle size={12} strokeWidth={2.6} />
            ) : sla.level === "warning" ? (
              <Flame size={12} strokeWidth={2.4} />
            ) : (
              <Clock size={12} strokeWidth={2.2} />
            )}
            {sla.label}
          </span>
        ) : (
          <span className="text-label-xs text-on-surface-variant">{formatTime(order.created_at)}</span>
        )}

        <span className="min-w-0 flex-1 truncate text-body-sm text-on-surface-variant">
          {order.customer_name} · Toà {order.building}
          {order.room ? `-${order.room}` : ""}
        </span>

        <span className="text-label-md font-bold text-primary">{formatVnd(order.total_amount)}</span>
      </button>
    </li>
  );
}

