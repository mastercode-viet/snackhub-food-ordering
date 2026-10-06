import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { useAsync } from "@/hooks/useAsync";
import { formatVnd } from "@/lib/format";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { useOutletContext } from "react-router-dom";
import type { AdminOutletContext } from "@/routes/AdminLayout";
import CustomerStatsCard from "@/components/admin/CustomerStatsCard";
import {
  bucketDailyStats,
  fetchDailyStats,
  fetchHeatmap,
  fetchTopCombos,
  fetchTopProducts,
  isoDay,
  type HeatmapCell,
  type RevenueBucket,
  type TopCombo,
  type TopProduct,
} from "@/lib/adminQueries";

type Granularity = "day" | "week" | "month";

const GRANULARITY_NOUN: Record<Granularity, string> = { day: "ngày", week: "tuần", month: "tháng" };

/** Khoảng càng dài thì gộp cột càng thô, tránh biểu đồ có hàng trăm cột ngày dí sát nhau. */
function autoGranularity(spanDays: number): Granularity {
  if (spanDays <= 31) return "day";
  if (spanDays <= 180) return "week";
  return "month";
}

function today(): string {
  return isoDay(new Date());
}

function mondayOfThisWeek(): string {
  const now = new Date();
  const dow = now.getDay(); // 0 = Chủ nhật
  now.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
  return isoDay(now);
}

function firstOfThisMonth(): string {
  const now = new Date();
  return isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
}

export default function AdminDashboardPage() {
  const { isAdmin } = useOutletContext<AdminOutletContext>();
  // Mặc định 14 ngày gần nhất — giữ đúng hành vi trước khi có Date Range Picker.
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return isoDay(d);
  });
  const [toDate, setToDate] = useState<string>(today);

  // Người dùng có thể gõ Từ ngày > Đến ngày — hoán lại thay vì query lỗi.
  const [rangeFrom, rangeTo] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate];

  const spanDays = useMemo(() => {
    const ms = new Date(`${rangeTo}T00:00:00`).getTime() - new Date(`${rangeFrom}T00:00:00`).getTime();
    return Math.round(ms / 86_400_000) + 1;
  }, [rangeFrom, rangeTo]);

  const granularity = useMemo(() => autoGranularity(spanDays), [spanDays]);

  const state = useAsync(
    async () => ({
      daily: await fetchDailyStats(rangeFrom, rangeTo),
      top: await fetchTopProducts(rangeFrom, rangeTo),
      combos: await fetchTopCombos(rangeFrom, rangeTo),
      heatmap: await fetchHeatmap(rangeFrom, rangeTo),
    }),
    [rangeFrom, rangeTo],
  );

  const daily = state.data?.daily ?? [];
  const buckets = useMemo(() => bucketDailyStats(daily, granularity), [daily, granularity]);

  const totals = useMemo(() => {
    return daily.reduce(
      (acc, d) => ({
        orders: acc.orders + d.total_orders,
        completed: acc.completed + d.completed_orders,
        cancelled: acc.cancelled + d.cancelled_orders,
        revenue: acc.revenue + d.revenue,
        codRevenue: acc.codRevenue + d.cod_revenue,
        payosRevenue: acc.payosRevenue + d.payos_revenue,
        slaBreached: acc.slaBreached + d.sla_breached_orders,
        deliveryOrders: acc.deliveryOrders + d.delivery_orders,
        inStoreOrders: acc.inStoreOrders + d.in_store_orders,
        deliveryRevenue: acc.deliveryRevenue + d.delivery_revenue,
        inStoreRevenue: acc.inStoreRevenue + d.in_store_revenue,
      }),
      {
        orders: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
        codRevenue: 0,
        payosRevenue: 0,
        slaBreached: 0,
        deliveryOrders: 0,
        inStoreOrders: 0,
        deliveryRevenue: 0,
        inStoreRevenue: 0,
      },
    );
  }, [daily]);

  const avgOrder = totals.completed > 0 ? Math.round(totals.revenue / totals.completed) : 0;
  // SLA chỉ đo đơn giao tận nơi (đơn tại quầy không có cảnh báo SLA).
  const slaRate = totals.deliveryOrders > 0 ? Math.round((totals.slaBreached / totals.deliveryOrders) * 100) : 0;

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

        <DateRangeControls
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />
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
          <div className="grid grid-cols-2 gap-gutter-mobile lg:grid-cols-5">
            <StatTile label="Doanh thu" value={formatVnd(totals.revenue)} />
            <StatTile label="Đơn đã nhận" value={String(totals.orders)} />
            <StatTile
              label="Đã hoàn tất"
              value={String(totals.completed)}
              hint={totals.cancelled > 0 ? `${totals.cancelled} đơn huỷ` : undefined}
            />
            <StatTile label="Trung bình mỗi đơn" value={formatVnd(avgOrder)} />
            <StatTile
              label="Tỷ lệ trễ SLA"
              value={`${slaRate}%`}
              hint={totals.slaBreached > 0 ? `${totals.slaBreached} đơn giao trễ` : "Không có đơn giao trễ"}
            />
          </div>

          <RevenueChart buckets={buckets} granularity={granularity} />

          <div className="grid gap-space-lg lg:grid-cols-2">
            <PaymentSplitDonut cod={totals.codRevenue} payos={totals.payosRevenue} />
            <DeliverySplitCard
              orders={{ delivery: totals.deliveryOrders, inStore: totals.inStoreOrders }}
              revenue={{ delivery: totals.deliveryRevenue, inStore: totals.inStoreRevenue }}
            />
          </div>

          <BestSellersCard products={state.data!.top} combos={state.data!.combos} />

          {/* Thống kê khách chỉ superadmin xem được (RPC tự chặn) — staff không thấy thẻ này. */}
          {isAdmin && <CustomerStatsCard from={rangeFrom} to={rangeTo} />}

          <HeatmapCard cells={state.data!.heatmap} />
        </>
      )}
    </div>
  );
}

/**
 * Date Range Picker + nút chọn nhanh. Thay cho cặp nút Ngày/Tuần/Tháng +
 * 7/14/30 ngày cũ — 2 bộ nút đó dễ gây nhầm giữa "gộp dữ liệu theo gì" và
 * "xem khoảng nào", còn granularity biểu đồ giờ tự suy ra từ độ dài khoảng
 * đã chọn (xem `autoGranularity`).
 */
function DateRangeControls({
  fromDate,
  toDate,
  onFromChange,
  onToChange,
}: {
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  const isToday = fromDate === today() && toDate === today();
  const isThisWeek = fromDate === mondayOfThisWeek() && toDate === today();
  const isThisMonth = fromDate === firstOfThisMonth() && toDate === today();

  function quickSelect(from: string, to: string) {
    onFromChange(from);
    onToChange(to);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-1.5">
        <QuickRangeButton active={isToday} onClick={() => quickSelect(today(), today())}>
          Hôm nay
        </QuickRangeButton>
        <QuickRangeButton active={isThisWeek} onClick={() => quickSelect(mondayOfThisWeek(), today())}>
          Tuần này
        </QuickRangeButton>
        <QuickRangeButton active={isThisMonth} onClick={() => quickSelect(firstOfThisMonth(), today())}>
          Tháng này
        </QuickRangeButton>
      </div>

      <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
        <CalendarDays size={15} strokeWidth={2.2} className="shrink-0" />
        <input
          type="date"
          value={fromDate}
          max={toDate}
          onChange={(e) => onFromChange(e.target.value)}
          aria-label="Từ ngày"
          className="min-h-[36px] rounded-card-sm border border-outline-variant bg-surface-container-lowest px-2 text-label-sm text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
        <span>—</span>
        <input
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(e) => onToChange(e.target.value)}
          aria-label="Đến ngày"
          className="min-h-[36px] rounded-card-sm border border-outline-variant bg-surface-container-lowest px-2 text-label-sm text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
      </div>
    </div>
  );
}

function QuickRangeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-card-sm px-2.5 text-label-sm transition-colors ${
        active
          ? "bg-inverse-surface text-inverse-on-surface"
          : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
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

/** "2026-09-11" + tháng -> "11/09"; "2026-09" + tháng -> "09/2026". */
function formatBucketLabel(key: string, granularity: Granularity): string {
  if (granularity === "month") {
    const [y, m] = key.split("-");
    return `${m}/${y}`;
  }
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

function RevenueChart({
  buckets,
  granularity,
}: {
  buckets: RevenueBucket[];
  granularity: Granularity;
}) {
  const max = Math.max(...buckets.map((b) => b.revenue), 0);
  const noun = GRANULARITY_NOUN[granularity];

  if (buckets.length === 0 || max === 0) {
    return (
      <EmptyState
        icon="📊"
        title="Chưa có doanh thu trong khoảng này"
        description="Doanh thu chỉ cộng khi đơn chuyển sang trạng thái hoàn tất."
      />
    );
  }

  const chartData = buckets.map((b) => ({ ...b, label: formatBucketLabel(b.key, granularity) }));

  return (
    <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="text-label-lg text-on-surface">Doanh thu theo {noun}</h2>
      <p className="mt-0.5 text-label-sm text-on-surface-variant">Cao nhất {formatVnd(max)}</p>

      <div className="mt-space-lg h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgb(var(--color-outline-variant))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "rgb(var(--color-on-surface-variant))" }}
              axisLine={{ stroke: "rgb(var(--color-outline-variant))" }}
              tickLine={false}
              interval={chartData.length > 14 ? Math.ceil(chartData.length / 10) : 0}
            />
            <YAxis hide domain={[0, "dataMax"]} />
            <Tooltip cursor={{ fill: "rgb(var(--color-primary) / 0.08)" }} content={RevenueTooltip} />
            <Bar dataKey="revenue" fill="rgb(var(--color-primary) / 0.85)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function RevenueTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as RevenueBucket & { label: string };

  return (
    <div className="rounded-card-sm bg-inverse-surface px-3 py-2 text-label-sm text-inverse-on-surface shadow-card">
      <p>{d.label}</p>
      <p className="mt-0.5 font-medium">{formatVnd(d.revenue)}</p>
      <p className="text-inverse-on-surface/80">{d.completed_orders} đơn hoàn tất</p>
    </div>
  );
}

const DELIVERY_COLORS = {
  delivery: "rgb(var(--color-secondary))",
  inStore: "rgb(var(--color-tertiary))",
};

/** Tỷ trọng "Giao tận nơi" / "Tại quầy" — xem theo doanh thu hoặc theo số đơn hoàn tất. */
function DeliverySplitCard({
  orders,
  revenue,
}: {
  orders: { delivery: number; inStore: number };
  revenue: { delivery: number; inStore: number };
}) {
  const [metric, setMetric] = useState<"revenue" | "orders">("revenue");
  const src = metric === "revenue" ? revenue : orders;
  const total = src.delivery + src.inStore;
  const fmt = (v: number) => (metric === "revenue" ? formatVnd(v) : `${v} đơn`);
  const data = [
    { name: "Giao tận nơi", value: src.delivery, color: DELIVERY_COLORS.delivery },
    { name: "Tại quầy", value: src.inStore, color: DELIVERY_COLORS.inStore },
  ];

  return (
    <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-label-lg text-on-surface">Giao tận nơi / Tại quầy</h2>
        <div className="flex gap-1 rounded-card bg-surface-container p-1">
          {(["revenue", "orders"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`min-h-[36px] rounded-card-sm px-3 text-label-sm transition-colors ${
                metric === m ? "bg-surface-container-lowest text-on-surface shadow-card" : "text-on-surface-variant"
              }`}
            >
              {m === "revenue" ? "Doanh thu" : "Số đơn"}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <EmptyState icon="🛵" title="Chưa có đơn hoàn tất" description="Chưa có đơn hoàn tất trong khoảng đang xem." />
      ) : (
        <div className="mt-space-md flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="100%" paddingAngle={2} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => fmt(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    backgroundColor: "rgb(var(--color-inverse-surface))",
                    color: "rgb(var(--color-inverse-on-surface))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-label-sm text-on-surface-variant">Tổng</p>
              <p className="text-label-md text-on-surface">{fmt(total)}</p>
            </div>
          </div>

          <ul className="w-full flex-1 space-y-2">
            {data.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2 text-body-sm">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="shrink-0 text-on-surface">
                  {fmt(d.value)} · {Math.round((d.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

const PAYMENT_COLORS = {
  cod: "rgb(var(--color-secondary))",
  payos: "rgb(var(--color-primary))",
};

function PaymentSplitDonut({ cod, payos }: { cod: number; payos: number }) {
  const total = cod + payos;
  const data = [
    { name: "Tiền mặt (COD)", value: cod, color: PAYMENT_COLORS.cod },
    { name: "Chuyển khoản (PayOS)", value: payos, color: PAYMENT_COLORS.payos },
  ];

  return (
    <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="text-label-lg text-on-surface">Tỷ trọng thanh toán</h2>

      {total === 0 ? (
        <EmptyState
          icon="💳"
          title="Chưa có doanh thu"
          description="Chưa có đơn hoàn tất trong khoảng đang xem."
        />
      ) : (
        <div className="mt-space-md flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-44 w-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="65%"
                  outerRadius="100%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatVnd(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    backgroundColor: "rgb(var(--color-inverse-surface))",
                    color: "rgb(var(--color-inverse-on-surface))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-label-sm text-on-surface-variant">Tổng</p>
              <p className="text-label-md text-on-surface">{formatVnd(total)}</p>
            </div>
          </div>

          <ul className="w-full flex-1 space-y-2">
            {data.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2 text-body-sm">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="shrink-0 text-on-surface">
                  {formatVnd(d.value)} · {Math.round((d.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BestSellersCard({ products, combos }: { products: TopProduct[]; combos: TopCombo[] }) {
  const [tab, setTab] = useState<"products" | "combos">("products");

  return (
    <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-label-lg text-on-surface">Bán chạy</h2>

        <div className="flex gap-1 rounded-card bg-surface-container p-1">
          {(["products", "combos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-[36px] rounded-card-sm px-3 text-label-sm transition-colors ${
                tab === t
                  ? "bg-surface-container-lowest text-on-surface shadow-card"
                  : "text-on-surface-variant"
              }`}
            >
              {t === "products" ? "Sản phẩm" : "Combo"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-space-md">
        {tab === "products" ? <TopProductTable rows={products} /> : <TopComboTable rows={combos} />}
      </div>
    </section>
  );
}

function TopProductTable({ rows }: { rows: TopProduct[] }) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-on-surface-variant">Chưa có món nào bán trong khoảng này.</p>;
  }

  return (
    <table className="w-full text-body-md">
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
  );
}

function TopComboTable({ rows }: { rows: TopCombo[] }) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-on-surface-variant">Chưa có combo nào bán trong khoảng này.</p>;
  }

  return (
    <table className="w-full text-body-md">
      <thead>
        <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant">
          <th scope="col" className="py-2 text-left font-normal">Combo</th>
          <th scope="col" className="py-2 text-right font-normal">Đã bán</th>
          <th scope="col" className="py-2 text-right font-normal">Doanh thu</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.combo_id} className="border-b border-outline-variant last:border-0">
            <td className="py-2.5 text-on-surface">{r.combo_name}</td>
            <td className="py-2.5 text-right text-on-surface-variant">{r.quantity}</td>
            <td className="py-2.5 text-right text-on-surface">{formatVnd(r.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Thứ tự Date#getDay(): 0 = Chủ nhật. Xoay lại để tuần bắt đầu Thứ 2 cho quen mắt.
const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DOW_ROW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOUR_TICKS = new Set([0, 3, 6, 9, 12, 15, 18, 21]);

function HeatmapCard({ cells }: { cells: HeatmapCell[] }) {
  const max = Math.max(...cells.map((c) => c.total_orders), 0);
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cells) map.set(`${c.dow}-${c.hour}`, c.total_orders);
    return map;
  }, [cells]);

  if (max === 0) {
    return (
      <EmptyState
        icon="🕒"
        title="Chưa đủ dữ liệu khung giờ"
        description="Heatmap cần có đơn hàng phát sinh trong khoảng đang xem."
      />
    );
  }

  return (
    <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <h2 className="text-label-lg text-on-surface">Khung giờ cao điểm</h2>
      <p className="mt-0.5 text-label-sm text-on-surface-variant">Số đơn theo thứ và giờ trong ngày</p>

      <div className="mt-space-lg overflow-x-auto">
        <div className="inline-flex min-w-full flex-col gap-1">
          <div className="flex gap-1 pl-9">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="w-5 shrink-0 text-center text-label-xs text-on-surface-variant">
                {HOUR_TICKS.has(hour) ? hour : ""}
              </div>
            ))}
          </div>

          {DOW_ROW_ORDER.map((dow) => (
            <div key={dow} className="flex items-center gap-1">
              <div className="w-8 shrink-0 text-label-xs text-on-surface-variant">{DOW_LABELS[dow]}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const count = countMap.get(`${dow}-${hour}`) ?? 0;
                const opacity = count === 0 ? 0 : Math.max(0.12, count / max);
                const label = `${DOW_LABELS[dow]} ${hour}h: ${count} đơn`;
                return (
                  <div
                    key={hour}
                    role="img"
                    aria-label={label}
                    title={label}
                    tabIndex={0}
                    className="h-5 w-5 shrink-0 rounded-card-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
                    style={{ backgroundColor: `rgb(var(--color-primary) / ${opacity})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
