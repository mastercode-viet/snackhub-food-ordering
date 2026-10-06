import { useState } from "react";
import { Users } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatVnd } from "@/lib/format";
import { formatPhone } from "@/lib/contact";
import { fetchCustomerRetention, fetchTopCustomers, type CustomerSort } from "@/lib/adminQueries";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";

/**
 * Thống kê khách cho /admin/thong-ke — khách nhận diện theo số điện thoại,
 * chỉ tính đơn hoàn tất (RPC get_top_customers / get_customer_retention, chỉ superadmin).
 * Tự tải dữ liệu riêng để đổi kiểu xếp không phải tải lại cả trang thống kê.
 */
export default function CustomerStatsCard({ from, to }: { from: string; to: string }) {
  const [sort, setSort] = useState<CustomerSort>("orders");
  const retention = useAsync(() => fetchCustomerRetention(from, to), [from, to]);
  const top = useAsync(() => fetchTopCustomers(from, to, sort), [from, to, sort]);

  const r = retention.data;
  const repeatRate = r && r.customers > 0 ? Math.round((r.repeat_customers / r.customers) * 100) : 0;

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Users size={18} strokeWidth={2.2} className="text-on-surface-variant" />
        <h2 className="text-label-lg text-on-surface">Khách hàng</h2>
      </div>
      <p className="-mt-2 text-body-sm text-on-surface-variant">
        Nhận diện khách theo số điện thoại. Chỉ tính đơn đã hoàn tất.
      </p>

      {retention.loading ? (
        <Skeleton className="h-20 w-full rounded-card" />
      ) : retention.error ? (
        <ErrorState onRetry={retention.reload} />
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Khách mua trong kỳ" value={String(r!.customers)} />
          <Metric
            label="Tỉ lệ mua từ 2 đơn"
            value={`${repeatRate}%`}
            hint={`${r!.repeat_customers}/${r!.customers} khách`}
          />
          <Metric label="Khách mới" value={String(r!.new_customers)} hint="Mua lần đầu trong kỳ" />
          <Metric label="Khách cũ quay lại" value={String(r!.returning_customers)} hint="Đã mua trước kỳ này" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-space-md">
        <h3 className="text-label-lg text-on-surface">Top khách mua nhiều</h3>
        <div className="flex gap-1 rounded-card bg-surface-container p-1">
          {(["orders", "spent"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`min-h-[36px] rounded-card-sm px-3 text-label-sm transition-colors ${
                sort === s ? "bg-surface-container-lowest text-on-surface shadow-card" : "text-on-surface-variant"
              }`}
            >
              {s === "orders" ? "Theo số đơn" : "Theo tiền"}
            </button>
          ))}
        </div>
      </div>

      {top.loading ? (
        <Skeleton className="h-40 w-full rounded-card" />
      ) : top.error ? (
        <ErrorState onRetry={top.reload} />
      ) : (top.data ?? []).length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Chưa có khách nào hoàn tất đơn trong khoảng này.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-body-md">
            <thead>
              <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant">
                <th scope="col" className="py-2 pr-2 text-left font-normal">#</th>
                <th scope="col" className="py-2 pr-2 text-left font-normal">Khách</th>
                <th scope="col" className="py-2 pr-2 text-left font-normal">Số điện thoại</th>
                <th scope="col" className="py-2 pr-2 text-right font-normal">Đơn hoàn tất</th>
                <th scope="col" className="py-2 pr-2 text-right font-normal">Tổng chi</th>
                <th scope="col" className="py-2 text-right font-normal">Mua gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {top.data!.map((c, i) => (
                <tr key={c.customer_phone} className="border-b border-outline-variant last:border-0">
                  <td className="py-2.5 pr-2 text-on-surface-variant">{i + 1}</td>
                  <td className="max-w-[12rem] truncate py-2.5 pr-2 text-on-surface">{c.customer_name}</td>
                  <td className="whitespace-nowrap py-2.5 pr-2">
                    <a href={`tel:${c.customer_phone}`} className="text-on-surface underline decoration-outline-variant underline-offset-2">
                      {formatPhone(c.customer_phone)}
                    </a>
                  </td>
                  <td className={`py-2.5 pr-2 text-right ${sort === "orders" ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>
                    {c.completed_orders}
                  </td>
                  <td className={`whitespace-nowrap py-2.5 pr-2 text-right ${sort === "spent" ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>
                    {formatVnd(c.total_spent)}
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right text-on-surface-variant">{formatDate(c.last_order_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card bg-surface-container-low px-3 py-2.5">
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="mt-0.5 text-headline-sm text-on-surface">{value}</p>
      {hint && <p className="text-label-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}
