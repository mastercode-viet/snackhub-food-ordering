import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  Clock,
  Copy,
  MapPin,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import ProductImage from "@/components/product/ProductImage";
import { OrderStatusBadge, OrderTimeline } from "@/components/order/OrderStatus";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import {
  OrderNotFoundError,
  cancelOrderByCode,
  fetchOrderByCode,
  type OrderView,
} from "@/lib/queries";
import { buildReorder } from "@/lib/reorder";
import { copyText } from "@/lib/clipboard";
import { formatClock, formatDate, formatVnd } from "@/lib/format";
import { useCartStore } from "@/store/cart";
import { useRecentOrders } from "@/store/recentOrders";
import { toast } from "@/store/toast";

/** Đơn còn đang chạy thì mới cần hỏi lại server. */
const POLL_MS = 20_000;
const ACTIVE = new Set(["pending_confirmation", "preparing", "delivering"]);

export default function OrderTrackingPage() {
  const { orderCode } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);
  const remember = useRecentOrders((s) => s.remember);

  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!orderCode) return;
      if (!silent) setLoading(true);
      try {
        const data = await fetchOrderByCode(orderCode);
        setOrder(data);
        setNotFound(false);
        setError(null);
        remember(data.order_code);
      } catch (e) {
        if (e instanceof OrderNotFoundError) setNotFound(true);
        else setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setLoading(false);
      }
    },
    [orderCode, remember],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Khách không đọc được bảng orders nên Realtime không gửi gì cho họ —
  // phải tự hỏi lại, và chỉ hỏi khi đơn còn đang chạy.
  useEffect(() => {
    if (!order || !ACTIVE.has(order.status)) return;
    const timer = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(timer);
  }, [order, load]);

  async function handleCancel() {
    if (!order || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await cancelOrderByCode(order.order_code);
      setConfirmCancel(false);
      toast.success("Đã huỷ đơn hàng");
      await load(true);
    } catch {
      // DB từ chối khi đơn đã sang trạng thái khác — tải lại cho khách thấy
      setActionError("Không huỷ được — quán có thể đã bắt đầu làm đơn. Đang cập nhật lại…");
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleReorder() {
    if (!order || busy) return;
    setBusy(true);
    setActionError(null);
    setSkipped([]);
    try {
      const result = await buildReorder(order.items);
      if (result.items.length === 0) {
        setActionError("Rất tiếc, không món nào trong đơn này còn phục vụ.");
        setSkipped(result.skipped);
        return;
      }
      for (const item of result.items) addItem(item);
      if (result.skipped.length > 0) {
        setSkipped(result.skipped);
      } else {
        toast.success("Đã thêm lại các món vào giỏ");
        navigate("/gio-hang");
      }
    } catch {
      setActionError("Không mua lại được, vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!order) return;
    if (await copyText(order.order_code)) {
      setCopied(true);
      toast.success("Đã sao chép mã đơn");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Không sao chép được, bạn giữ để bôi đen mã nhé.");
    }
  }

  if (loading) return <TrackingSkeleton />;

  if (notFound) {
    return (
      <Shell>
        <EmptyState
          icon="🔍"
          title="Không tìm thấy đơn này"
          description="Kiểm tra lại mã đơn giúp nhé — mã có dạng SH-XXXXXXXXXX."
          action={
            <Link
              to="/don-hang"
              className="inline-flex h-11 items-center rounded-full bg-inverse-surface px-6 text-label-lg text-inverse-on-surface shadow-cta"
            >
              Tra mã khác
            </Link>
          }
        />
      </Shell>
    );
  }

  if (error || !order) {
    return (
      <Shell>
        <ErrorState onRetry={() => void load()} />
      </Shell>
    );
  }

  const address = [
    order.building,
    order.floor && `Tầng ${order.floor}`,
    order.room,
    order.class_name,
  ]
    .filter(Boolean)
    .join(" · ");

  const waitingPayment = order.payment_method === "payos" && order.payment_status === "pending";

  return (
    <div className="min-h-dvh bg-background pb-12 pt-safe">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-outline-variant/40">
        <div className="mx-auto flex w-full max-w-content items-center gap-3 px-margin-mobile py-3 md:px-gutter">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Link
              to="/don-hang"
              aria-label="Quay lại"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest text-on-surface border border-outline-variant shadow-card"
            >
              <ArrowLeft size={20} strokeWidth={2.2} />
            </Link>
          </motion.div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.08 }}
            type="button"
            onClick={async () => {
              await load(true);
              toast.success("Đã làm mới thông tin đơn hàng");
            }}
            aria-label="Cập nhật"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant shadow-card hover:text-on-surface transition-colors active:rotate-180"
          >
            <RefreshCw size={17} strokeWidth={2.2} />
          </motion.button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-margin-mobile pt-4 md:px-gutter">
        <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-label-xs uppercase tracking-wider font-bold text-on-surface-variant">
                Mã đơn hàng
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                <p className="select-all text-headline-md font-black tracking-wide text-primary">
                  {order.order_code}
                </p>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  type="button"
                  onClick={() => void handleCopy()}
                  aria-label="Sao chép mã đơn"
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
                    copied
                      ? "bg-secondary text-on-secondary shadow-badge"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  {copied ? <Check size={15} strokeWidth={3} /> : <Copy size={14} strokeWidth={2.5} />}
                </motion.button>
              </div>

              <div className="mt-3.5 flex gap-3">
                <Stat icon={<CalendarDays size={13} strokeWidth={2.4} />} label="Ngày đặt">
                  {formatDate(order.created_at)}
                </Stat>
                <Stat icon={<Clock size={13} strokeWidth={2.4} />} label="Giờ đặt">
                  {formatClock(order.created_at)}
                </Stat>
              </div>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

        </section>

        {waitingPayment && (
          <motion.div whileTap={{ scale: 0.98 }}>
            <Link
              to={`/thanh-toan/${order.order_code}`}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-inverse-surface text-label-lg font-bold text-inverse-on-surface shadow-cta"
            >
              <QrCode size={18} strokeWidth={2.4} />
              Thanh toán ngay · {formatVnd(order.total_amount)}
            </Link>
          </motion.div>
        )}

        <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
          <h2 className="mb-4 text-headline-sm font-bold text-on-surface">Hành trình đơn hàng</h2>
          <OrderTimeline
            status={order.status}
            createdAt={order.created_at}
            completedAt={order.completed_at}
            cancelledAt={order.cancelled_at}
            cancelReason={order.cancel_reason}
          />
        </section>

        <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
          <div className="mb-3 flex items-center gap-2">
            <MapPin size={18} className="text-secondary" strokeWidth={2.4} />
            <h2 className="text-headline-sm font-bold text-on-surface">Giao đến</h2>
          </div>
          <p className="text-label-lg font-bold text-on-surface">{address}</p>
          <p className="mt-0.5 text-body-md text-on-surface-variant font-medium">
            {order.customer_name} · {order.customer_phone}
          </p>
          {order.delivery_note && (
            <p className="mt-2.5 rounded-card bg-surface-container-low/80 px-3.5 py-2.5 text-body-sm text-on-surface-variant border border-outline-variant/40">
              {order.delivery_note}
            </p>
          )}
        </section>

        <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
          <h2 className="mb-3 text-headline-sm font-bold text-on-surface">
            Món đã đặt ({order.items.length})
          </h2>

          <ul className="flex flex-col gap-3.5">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-3.5">
                <ProductImage
                  src={item.product_image_url}
                  alt={item.product_name}
                  className="size-14 shrink-0 rounded-card-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-lg font-bold text-on-surface">
                    {item.product_name}{" "}
                    <span className="text-on-surface-variant font-semibold">×{item.quantity}</span>
                  </p>
                  {item.options.length > 0 && (
                    <p className="truncate text-body-sm text-on-surface-variant">
                      {item.options.map((o) => o.option_name).join(", ")}
                    </p>
                  )}
                  {item.item_note && (
                    <p className="truncate text-body-sm italic text-on-surface-variant/80">
                      {item.item_note}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-label-md font-extrabold text-primary">
                  {formatVnd(item.line_total)}
                </span>
              </li>
            ))}
          </ul>

          <div className="my-4 h-px bg-outline-variant/60" />

          <Row label="Tạm tính" value={formatVnd(order.subtotal)} />
          <Row
            label="Phí giao nội khu"
            value={order.shipping_fee === 0 ? "Miễn phí" : formatVnd(order.shipping_fee)}
          />
          {order.discount_amount > 0 && (
            <Row
              label={`Giảm giá${order.discount_code ? ` (${order.discount_code})` : ""}`}
              value={`-${formatVnd(order.discount_amount)}`}
              accent
            />
          )}

          <div className="mt-3.5 flex items-center justify-between border-t border-outline-variant/60 pt-3">
            <span className="text-headline-sm font-bold text-on-surface">Tổng cộng</span>
            <span className="text-headline-md font-black text-primary">
              {formatVnd(order.total_amount)}
            </span>
          </div>

          <p className="mt-2 text-body-sm font-medium text-on-surface-variant">
            {order.payment_method === "cod" ? "Thanh toán khi nhận hàng" : "Chuyển khoản VietQR"}
          </p>
        </section>

        {actionError && (
          <p className="rounded-card bg-error-container px-4 py-3 text-center text-label-sm font-bold text-on-error-container shadow-card">
            {actionError}
          </p>
        )}

        {skipped.length > 0 && (
          <p className="rounded-card bg-tertiary-fixed/80 px-4 py-3 text-body-sm font-medium text-on-tertiary-fixed border border-tertiary-fixed">
            Không thêm lại được: <strong>{skipped.join(", ")}</strong> — món đã hết hoặc không còn
            trong thực đơn. Các món còn lại đã vào giỏ.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            type="button"
            onClick={handleReorder}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-inverse-surface text-label-lg font-bold text-inverse-on-surface shadow-cta transition-all disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
          >
            <RotateCcw size={18} strokeWidth={2.4} />
            {busy ? "Đang xử lý…" : "Mua lại đơn này"}
          </motion.button>

          {order.can_cancel &&
            (confirmCancel ? (
              <div className="flex gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleCancel}
                  disabled={busy}
                  className="h-12 flex-1 rounded-full bg-error text-label-lg font-bold text-on-error shadow-badge disabled:opacity-60"
                >
                  Xác nhận huỷ
                </motion.button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="h-12 flex-1 rounded-full bg-surface-container-high text-label-lg font-semibold text-on-surface-variant"
                >
                  Giữ đơn
                </button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-container-lowest text-label-lg font-bold text-error border border-outline-variant shadow-card transition-colors hover:bg-error-container/40"
              >
                <Ban size={18} strokeWidth={2.4} />
                Huỷ đơn
              </motion.button>
            ))}
        </div>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-body-sm font-medium text-on-surface-variant">
          <ShieldCheck size={16} className="text-secondary" strokeWidth={2.4} />
          {order.can_cancel
            ? "Chỉ huỷ được khi đơn còn Chờ xác nhận"
            : order.payment_status === "paid"
              ? "Đơn đã thanh toán — nhắn quán nếu bạn cần hoàn tiền"
              : "Đơn đã qua bước xác nhận nên không tự huỷ được"}
        </p>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background px-margin-mobile pt-safe">
      <div className="flex items-center gap-3 py-4">
        <Link
          to="/don-hang"
          aria-label="Quay lại"
          className="grid size-10 place-items-center rounded-full bg-surface-container-lowest text-on-surface border border-outline-variant shadow-card"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </Link>
        <h1 className="text-headline-sm text-on-surface">Theo dõi đơn</h1>
      </div>
      {children}
    </div>
  );
}

/** Ô thông tin nhỏ có nhãn — giá trị màu xanh để tách khỏi mã đơn màu cam. */
function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 rounded-2xl bg-surface-container-low/70 px-3 py-2">
      <p className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-label-lg text-secondary">{children}</p>
    </div>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-0.5 text-body-md ${
        accent ? "text-primary" : "text-on-surface-variant"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className={`shrink-0 font-semibold ${accent ? "" : "text-on-surface"}`}>{value}</span>
    </div>
  );
}

function TrackingSkeleton() {
  return (
    <div className="min-h-dvh bg-background px-margin-mobile pt-safe">
      <div className="flex items-center gap-3 py-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 rounded-card-lg" />
        <Skeleton className="h-64 rounded-card-lg" />
        <Skeleton className="h-40 rounded-card-lg" />
      </div>
    </div>
  );
}
