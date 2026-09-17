import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatVnd } from "@/lib/format";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  fetchDailyStats,
  fetchTopProducts,
  type DailyStat,
  type TopProduct,
} from "@/lib/adminQueries";

const RANGES = [7, 14, 30] as const;

export default function AdminDashboardPage() {
  const [days, setDays] = useState<number>(14);

  const state = useAsync(
    async () => ({
      daily: await fetchDailyStats(days),
      top: await fetchTopProducts(days),
    }),
    [days],
  );

  const daily = state.data?.daily ?? [];

  const totals = useMemo(() => {
    return daily.reduce(
      (acc, d) => ({
        orders: acc.orders + d.total_orders,
        completed: acc.completed + d.completed_orders,
        cancelled: acc.cancelled + d.cancelled_orders,
        revenue: acc.revenue + d.revenue,
      }),
      { orders: 0, completed: 0, cancelled: 0, revenue: 0 },
    );
  }, [daily]);

  const avgOrder = totals.completed > 0 ? Math.round(totals.revenue / totals.completed) : 0;

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Thống kê</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="min-w-0">
          <h1 className="text-headline-sm text-on-surface">Thống kê bán hàng</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Doanh thu chỉ tính đơn đã hoàn tất. Đơn huỷ và đơn đang chạy không vào doanh thu.
          </p>
        </div>

        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={`min-h-[44px] rounded-card px-3 text-label-md transition-colors ${
                r === days
                  ? "bg-primary-container text-on-primary-container"
                  : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {r} ngày
            </button>
          ))}
        </div>
      </header>

      {state.loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-gutter-mobile lg:grid-cols-4">
            <StatTile label="Doanh thu" value={formatVnd(totals.revenue)} />
            <StatTile label="Đơn đã nhận" value={String(totals.orders)} />
            <StatTile
              label="Đã hoàn tất"
              value={String(totals.completed)}
              hint={totals.cancelled > 0 ? `${totals.cancelled} đơn huỷ` : undefined}
            />
            <StatTile label="Trung bình mỗi đơn" value={formatVnd(avgOrder)} />
          </div>

          <RevenueChart data={daily} />

          <TopProductTable rows={state.data!.top} />
        </>
      )}
    </div>
  );
}

/**
 * Ô số liệu: nhãn nhỏ ở trên, giá trị đậm ở dưới — đúng mẫu "nhãn trên, giá
 * trị dưới" dùng xuyên suốt app.
 */
function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 text-headline-md text-on-surface">{value}</p>
      {hint && <p className="mt-0.5 text-label-sm text-on-surface-variant">{hint}</p>}
    </div>
  );
}

/**
 * Doanh thu theo ngày — MỘT chuỗi duy nhất nên không cần chú giải, tiêu đề
 * đã nói rõ đang đo gì. Chỉ gắn nhãn số lên cột cao nhất thay vì mọi cột.
 * Cột dùng div thay vì SVG để rê chuột và focus bàn phím hoạt động tự nhiên.
 */
function RevenueChart({ data }: { data: DailyStat[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 0);
  const peakDay = data.find((d) => d.revenue === max && max > 0)?.day;

  if (data.length === 0 || max === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Chưa có doanh thu trong khoảng này"
        description="Doanh thu chỉ cộng khi đơn chuyển sang trạng thái hoàn tất."
      />
    );
  }

  return (
    <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="text-label-lg text-on-surface">Doanh thu theo ngày</h2>
      <p className="mt-0.5 text-label-sm text-on-surface-variant">
        Cao nhất {formatVnd(max)}
      </p>

      <div className="mt-space-lg flex h-48 items-end gap-0.5">
        {data.map((d) => {
          const heightPct = max > 0 ? Math.max((d.revenue / max) * 100, d.revenue > 0 ? 2 : 0) : 0;
          const label = `${formatDay(d.day)}: ${formatVnd(d.revenue)}, ${d.completed_orders} đơn hoàn tất`;

          return (
            <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
              {d.day === peakDay && (
                <span className="mb-1 text-center text-label-xs text-on-surface-variant">
                  {Math.round(d.revenue / 1000)}k
                </span>
              )}

              <div
                tabIndex={0}
                role="img"
                aria-label={label}
                title={label}
                style={{ height: `${heightPct}%` }}
                className="w-full rounded-t-card-sm bg-primary/85 transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
              />
            </div>
          );
        })}
      </div>

      {/* Nhãn trục thưa dần theo độ dài dải ngày — 30 nhãn sát nhau thì chữ
          chồng lên nhau, không đọc được. Ngày cuối luôn có nhãn. */}
      <div className="mt-2 flex gap-0.5 border-t border-outline-variant pt-1.5">
        {data.map((d, i) => {
          const step = Math.ceil(data.length / 7);
          const show = i === data.length - 1 || (data.length - 1 - i) % step === 0;
          return (
            <span
              key={d.day}
              className="flex-1 overflow-hidden text-center text-label-xs text-on-surface-variant"
            >
              {show ? formatDay(d.day) : ""}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** Nhãn trục ngắn gọn: chỉ ngày/tháng, năm không đổi trong khoảng đang xem. */
function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

function TopProductTable({ rows }: { rows: TopProduct[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="text-label-lg text-on-surface">Món bán chạy</h2>

      <table className="mt-space-md w-full text-body-md">
        <thead>
          <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant">
            <th scope="col" className="py-2 text-left font-normal">Món</th>
            <th scope="col" className="py-2 text-right font-normal">Đã bán</th>
            <th scope="col" className="py-2 text-right font-normal">Doanh thu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product_name} className="border-b border-outline-variant last:border-0">
              <td className="py-2.5 text-on-surface">{r.product_name}</td>
              <td className="py-2.5 text-right text-on-surface-variant">{r.quantity}</td>
              <td className="py-2.5 text-right text-on-surface">{formatVnd(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
