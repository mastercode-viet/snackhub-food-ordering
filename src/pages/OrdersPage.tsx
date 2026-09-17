import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, Check, Clock, Copy, RefreshCw, Search, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { OrderStatusBadge } from "@/components/order/OrderStatus";
import { useRecentOrderDetails } from "@/hooks/useRecentOrderDetails";
import { copyText } from "@/lib/clipboard";
import { formatClock, formatDate, formatVnd } from "@/lib/format";
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

  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const codes = orders.map((o) => o.code);
  const details = useRecentOrderDetails(codes);

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
          Đơn gần đây
        </h2>
        {orders.length > 0 && (
          <button
            type="button"
            onClick={details.reload}
            className="flex items-center gap-1 text-label-sm font-bold text-secondary"
          >
            <RefreshCw size={13} strokeWidth={2.6} />
            Cập nhật
          </button>
        )}
      </div>

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
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((saved, index) => {
            const order = details.data?.[index] ?? null;
            const loading = details.loading && !details.data;
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
