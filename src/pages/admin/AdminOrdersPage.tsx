import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Phone, RotateCw } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { supabase } from "@/lib/supabase";
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

const TABS: Array<{ key: OrderStatus | "all"; label: string }> = [
  { key: "pending_confirmation", label: "Chờ xác nhận" },
  { key: "preparing", label: "Đang làm" },
  { key: "delivering", label: "Đang giao" },
  { key: "completed", label: "Hoàn tất" },
  { key: "cancelled", label: "Đã huỷ" },
  { key: "all", label: "Tất cả" },
];

export default function AdminOrdersPage() {
  const state = useAsync(() => fetchAdminOrders(), []);
  const [tab, setTab] = useState<OrderStatus | "all">("pending_confirmation");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const visible = useMemo(
    () => (tab === "all" ? orders : orders.filter((o) => o.status === tab)),
    [orders, tab],
  );

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
          <h1 className="text-headline-sm text-on-surface">Hàng đợi đơn hàng</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Đơn mới tự hiện, không cần tải lại trang.
          </p>
        </div>

        <button
          type="button"
          onClick={state.reload}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container"
        >
          <RotateCw size={16} strokeWidth={2.2} />
          Tải lại
        </button>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          const count = t.key === "all" ? orders.length : (counts.get(t.key) ?? 0);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 text-label-md transition-colors ${
                active
                  ? "bg-primary-container text-on-primary-container"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {t.label}
              <span className={active ? "opacity-80" : "text-on-surface-variant"}>{count}</span>
            </button>
          );
        })}
      </div>

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
                title="Không có đơn nào ở mục này"
                description="Đơn mới sẽ tự xuất hiện ngay khi khách đặt."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {visible.map((order) => (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(order.id)}
                      aria-current={order.id === selectedId}
                      className={`flex w-full min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 rounded-card px-2 py-3 text-left transition-colors ${
                        order.id === selectedId
                          ? "bg-surface-container"
                          : "hover:bg-surface-container-low"
                      }`}
                    >
                      <span className="font-mono text-label-md text-on-surface">
                        {order.order_code}
                      </span>
                      <OrderStatusBadge status={order.status} />

                      <span className="min-w-0 flex-1 truncate text-body-sm text-on-surface-variant">
                        {order.customer_name} · {order.building}
                        {order.room ? `-${order.room}` : ""}
                      </span>

                      <span className="text-label-md text-primary">
                        {formatVnd(order.total_amount)}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        {formatTime(order.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="w-full shrink-0 xl:w-[400px]">
            {selected ? (
              <OrderPanel order={selected} onRun={run} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
                Chọn một đơn để xem món, địa chỉ giao và đổi trạng thái.
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
  onRun,
  onClose,
}: {
  order: AdminOrder;
  onRun: (action: () => Promise<unknown>, okMessage: string) => Promise<void>;
  onClose: () => void;
}) {
  const next = NEXT[order.status];
  const canCancel = order.status !== "completed" && order.status !== "cancelled";

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-label-lg text-on-surface">{order.order_code}</p>
          <p className="text-label-sm text-on-surface-variant">{formatTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="rounded-card bg-surface-container-low p-3">
        <p className="text-label-md text-on-surface">{order.customer_name}</p>
        <a
          href={`tel:${order.customer_phone}`}
          className="mt-0.5 inline-flex min-h-[44px] items-center gap-1.5 text-label-md text-primary"
        >
          <Phone size={14} strokeWidth={2.4} />
          {order.customer_phone}
        </a>
        <p className="text-body-sm text-on-surface-variant">
          Toà {order.building}
          {order.floor ? ` · Tầng ${order.floor}` : ""}
          {order.room ? ` · Phòng ${order.room}` : ""}
          {order.class_name ? ` · Lớp ${order.class_name}` : ""}
        </p>
        {order.delivery_note && (
          <p className="mt-1 text-body-sm italic text-on-surface-variant">{order.delivery_note}</p>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-outline-variant">
        {order.order_items.map((item) => {
          return (
            <li key={item.id} className="flex items-start gap-2 py-2">
              <span className="text-label-md text-on-surface">{item.quantity}×</span>
              <div className="min-w-0 flex-1">
                <p className="text-body-md text-on-surface">{item.product_name}</p>
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
              <span className="shrink-0 text-label-md text-on-surface">
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
          <span className="text-label-lg text-on-surface">Tổng thu</span>
          <span className="text-headline-sm text-primary">{formatVnd(order.total_amount)}</span>
        </div>
        <p className="text-label-sm text-on-surface-variant">
          {order.payment_method === "cod" ? "Tiền mặt khi nhận" : "Chuyển khoản VietQR"} ·{" "}
          {order.payment_status === "paid" ? "đã thanh toán" : "chưa thanh toán"}
        </p>
      </div>

      {order.status === "cancelled" && order.cancel_reason && (
        <p className="rounded-card bg-error-container px-3 py-2 text-body-sm text-on-error-container">
          Lý do huỷ: {order.cancel_reason}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {next && (
          <button
            type="button"
            onClick={() =>
              void onRun(
                () => setOrderStatus(order.id, next.status),
                `Đơn ${order.order_code}: ${STATUS_LABEL[next.status]}.`,
              )
            }
            className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg text-inverse-on-surface"
          >
            {next.label}
          </button>
        )}

        {order.payment_status !== "paid" && order.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => void onRun(() => markOrderPaid(order.id), "Đã ghi nhận thanh toán.")}
            className="min-h-[44px] rounded-card border border-outline-variant text-label-md text-on-surface transition-colors hover:bg-surface-container"
          >
            Đã thu tiền
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            onClick={() => {
              const reason = prompt(`Lý do huỷ đơn ${order.order_code}?`);
              if (reason === null) return;
              const trimmed = reason.trim();
              if (!trimmed) {
                toast.error("Cần ghi lý do huỷ để khách hiểu vì sao.");
                return;
              }
              onClose();
              void onRun(() => cancelOrderAsAdmin(order.id, trimmed), "Đã huỷ đơn.");
            }}
            className="min-h-[44px] rounded-card border border-outline-variant text-label-md text-error transition-colors hover:bg-error-container"
          >
            Huỷ đơn
          </button>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-on-surface">{value}</span>
    </div>
  );
}
