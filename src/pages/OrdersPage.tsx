import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Copy,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { OrderStatusBadge, STATUS_LABEL } from "@/components/order/OrderStatus";
import OrderStatusFilter, { type StatusFilter } from "@/components/order/OrderStatusFilter";
import OrderDateRangeFilter, { describeOrderDateRange } from "@/components/order/OrderDateRangeFilter";
import type { Tables } from "@/types/database";
import { useRecentOrderDetails } from "@/hooks/useRecentOrderDetails";
import { useOrderDateRangeParam } from "@/hooks/useOrderDateRangeParam";
import { copyText } from "@/lib/clipboard";
import { formatClock, formatDate, formatVnd, toIsoDate } from "@/lib/format";
import { isWithinOrderDateRange } from "@/lib/queries";
import { useRecentOrders } from "@/store/recentOrders";
import { toast } from "@/store/toast";

/**
 * Tra cứu đơn.
 *
 * Khách không đăng nhập nên server không biết "đơn của ai" — mã đơn ngẫu nhiên
 * là thứ duy nhất để tra. Danh sách bên dưới là bộ nhớ của riêng máy này (mã
 * được lưu ngay lúc đặt hàng thành công), nên ô nhập mã thủ công vẫn luôn phải
 * có: đổi máy hoặc xoá dữ liệu trình duyệt là mất danh sách.
 */
export default function OrdersPage() {
  const navigate = useNavigate();
  const orders = useRecentOrders((s) => s.orders);
  const forget = useRecentOrders((s) => s.forget);

  const todayIso = toIsoDate(new Date());

  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  // Bộ lọc khoảng ngày lưu trên URL (?range=all hoặc ?from=...&to=...) để
  // reload/chia sẻ link vẫn giữ đúng bộ lọc. Chưa có gì trên URL -> mặc định
  // "hôm nay", không hiện dồn hết mọi ngày như trước.
  const [rangeParam, setRange] = useOrderDateRangeParam();
  const range = rangeParam ?? { from: todayIso, to: todayIso };

  const codes = orders.map((o) => o.code);
  const details = useRecentOrderDetails(codes);

  /**
   * Ghép mã đã lưu với trạng thái vừa tra được.
   * `undefined` = chưa tra xong (hiện skeleton), `null` = tra không ra.
   */
  const rows = orders.map((saved) => ({ saved, order: details.data?.[saved.code] }));

  const counts = useMemo(() => {
    const next: Partial<Record<Tables<"orders">["status"], number>> = {};
    for (const { order } of rows) {
      if (order) next[order.status] = (next[order.status] ?? 0) + 1;
    }
    return next;
    // rows dựng lại mỗi lần render; chỉ cần tính lại khi dữ liệu đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details.data, orders]);

  /**
   * Đơn cuối cùng của một trạng thái có thể biến mất giữa chừng (bấm Cập nhật
   * thấy đơn đã sang trạng thái khác, hoặc bấm X bỏ khỏi danh sách). Lúc đó
   * pill đang chọn không còn, phải rơi về "Tất cả" thay vì hiện danh sách rỗng.
   */
  useEffect(() => {
    if (filter !== "all" && details.data && !counts[filter]) setFilter("all");
  }, [filter, counts, details.data]);

  const matched = rows.filter(({ order, saved }) => {
    if (filter !== "all" && order?.status !== filter) return false;
    const when = order?.created_at ?? saved.savedAt;
    return isWithinOrderDateRange(when, range);
  });
  const filterLabel = filter === "all" ? null : STATUS_LABEL[filter];

  function lookup() {
    const value = code.trim().toUpperCase();
    if (!value) return;
    navigate(`/don-hang/${encodeURIComponent(value)}`);
  }

  async function handleCopy(orderCode: string) {
    const ok = await copyText(orderCode);
    if (ok) {
      setCopied(orderCode);
      toast.success(`Đã sao chép mã ${orderCode}`);
      setTimeout(() => setCopied((c) => (c === orderCode ? null : c)), 2000);
    } else {
      toast.error("Không sao chép được, bạn giữ để bôi đen mã nhé.");
    }
  }

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await details.reload();
      toast.success("Đã cập nhật trạng thái đơn hàng");
    } finally {
      setTimeout(() => setRefreshing(false), 650);
    }
  }

  return (
    <div className="px-margin-mobile pt-safe md:px-gutter">
      <h1 className="pb-1 pt-5 text-headline-lg tracking-tight text-on-surface">
        Đơn của thượng đế
      </h1>
      <p className="text-body-sm text-on-surface-variant">
        Đơn bạn đặt hiện ở đây. Nhập mã nếu muốn tra đơn đặt từ máy khác.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex h-12 flex-1 items-center gap-2.5 rounded-full bg-surface-container-lowest px-4 border border-outline-variant shadow-card transition-all focus-within:ring-2 focus-within:ring-on-surface">
          <Search size={18} className="shrink-0 text-outline" strokeWidth={2.4} />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="SH-XXXXXXXXXX"
            aria-label="Mã đơn hàng"
            maxLength={20}
            className="w-full bg-transparent text-body-md uppercase tracking-wide text-on-surface outline-none placeholder:tracking-normal placeholder:text-outline-variant"
          />
        </div>
        <button
          type="button"
          onClick={lookup}
          disabled={!code.trim()}
          className="h-12 shrink-0 rounded-full bg-inverse-surface px-5 text-label-md text-inverse-on-surface shadow-cta transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none disabled:active:scale-100"
        >
          Tra cứu
        </button>
      </div>

      <div className="mb-2 mt-7 flex items-center justify-between">
        <h2 className="text-label-md uppercase tracking-wider text-on-surface-variant">
          Đơn {describeOrderDateRange(range).toLowerCase()}
          {matched.length > 0 && ` (${matched.length})`}
        </h2>
        {orders.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-label-sm font-bold text-on-secondary-container shadow-sm transition-colors hover:bg-secondary-container/80 active:opacity-90 disabled:opacity-75"
          >
            <motion.span
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.65, ease: "easeInOut" }}
              className="grid place-items-center"
            >
              <RefreshCw size={13} strokeWidth={2.6} />
            </motion.span>
            Cập nhật
          </motion.button>
        )}
      </div>

      {orders.length > 0 && (
        <div className="mb-3">
          <OrderDateRangeFilter value={range} onChange={setRange} />
        </div>
      )}

      {orders.length > 0 && (
        <div className="mb-3">
          <OrderStatusFilter
            counts={counts}
            total={rows.length}
            value={filter}
            onChange={setFilter}
          />
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Chưa có đơn nào"
          description="Đơn bạn đặt sẽ tự xuất hiện ở đây."
          action={
            <Link
              to="/thuc-don"
              className="inline-flex h-11 items-center rounded-full bg-inverse-surface px-6 text-label-lg text-inverse-on-surface shadow-cta"
            >
              Xem thực đơn
            </Link>
          }
        />
      ) : matched.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={
            filterLabel
              ? `Không có đơn ${filterLabel.toLowerCase()} ${describeOrderDateRange(range).toLowerCase()}`
              : `Không có đơn ${describeOrderDateRange(range).toLowerCase()}`
          }
          description={
            filterLabel
              ? "Bấm Tất cả để xem lại mọi trạng thái, hoặc đổi khoảng ngày ở trên."
              : "Đổi khoảng ngày ở trên, hoặc bấm Tất cả để xem lại toàn bộ đơn."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {matched.map(({ saved, order }) => {
            // Mã vừa thêm mà lần tra chưa trả về: chưa biết gì, cứ hiện skeleton.
            const loading = order === undefined;
            const when = order?.created_at ?? saved.savedAt;
            const justCopied = copied === saved.code;

            return (
              <li
                key={saved.code}
                className="relative rounded-card bg-surface-container-lowest p-4 shadow-card"
              >
                {/* Nút bỏ khỏi danh sách — nằm ngoài Link để không bấm nhầm */}
                <button
                  type="button"
                  onClick={() => forget(saved.code)}
                  aria-label={`Bỏ ${saved.code} khỏi danh sách`}
                  className="absolute right-2.5 top-2.5 z-10 rounded-full p-1.5 text-on-surface-variant transition-colors hover:text-error"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>

                <div className="flex items-start justify-between gap-2 pr-7">
                  <div className="min-w-0">
                    <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">
                      Mã đơn hàng
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="select-all truncate text-headline-sm font-extrabold tracking-wide text-primary">
                        {saved.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(saved.code)}
                        aria-label={`Sao chép mã ${saved.code}`}
                        className={`grid size-7 shrink-0 place-items-center rounded-full transition-colors ${
                          justCopied
                            ? "bg-secondary text-on-secondary"
                            : "bg-surface-container-high text-on-surface-variant hover:bg-inverse-surface hover:text-inverse-on-surface"
                        }`}
                      >
                        {justCopied ? (
                          <Check size={14} strokeWidth={3} />
                        ) : (
                          <Copy size={13} strokeWidth={2.5} />
                        )}
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
                  ) : order ? (
                    <OrderStatusBadge status={order.status} />
                  ) : (
                    <span className="shrink-0 rounded-full bg-surface-container-high px-3 py-1 text-label-sm text-on-surface-variant">
                      Không tra được
                    </span>
                  )}
                </div>

                <div className="mt-3 flex gap-3">
                  <Stat icon={<CalendarDays size={13} strokeWidth={2.4} />} label="Ngày đặt">
                    {formatDate(when)}
                  </Stat>
                  <Stat icon={<Clock size={13} strokeWidth={2.4} />} label="Giờ đặt">
                    {formatClock(when)}
                  </Stat>
                </div>

                {loading ? (
                  <Skeleton className="mt-3 h-4 w-3/4" />
                ) : order ? (
                  <Link
                    to={`/don-hang/${saved.code}`}
                    className="mt-3 flex items-end justify-between gap-2 border-t border-surface-container-high pt-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-body-sm text-on-surface-variant">
                      {order.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-label-lg font-bold text-primary">
                      {formatVnd(order.total_amount)}
                      <ArrowRight size={15} strokeWidth={2.4} className="text-on-surface-variant" />
                    </span>
                  </Link>
                ) : (
                  <p className="mt-3 border-t border-surface-container-high pt-3 text-body-sm text-on-surface-variant">
                    Đơn này có thể đã bị xoá khỏi hệ thống.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Ô thông tin nhỏ có nhãn — giá trị dùng màu xanh để tách khỏi mã đơn màu cam. */
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
