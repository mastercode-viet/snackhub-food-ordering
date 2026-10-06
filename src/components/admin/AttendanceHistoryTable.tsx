import { useEffect, useState } from "react";
import { ImageOff, MapPin, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { useOrderDateRangeParam } from "@/hooks/useOrderDateRangeParam";
import { formatClock, formatDate, toIsoDate } from "@/lib/format";
import { fetchAttendanceHistory, fetchAttendanceImageUrls, type OpenTimeLog } from "@/lib/staffQueries";
import OrderDateRangeFilter, { describeOrderDateRange } from "@/components/order/OrderDateRangeFilter";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";

/**
 * Lịch sử điểm danh cho superadmin: giờ vào/ra, toạ độ, ảnh selfie lúc check-in.
 * Ảnh nằm trong bucket private → đổi path sang signed URL sau khi tải danh sách.
 * Ảnh + toạ độ quá 30 ngày đã bị job purge-attendance-media xoá — dòng vẫn còn
 * (giờ công tính lương), chỉ hiện "Đã xoá sau 30 ngày".
 */
export default function AttendanceHistoryTable() {
  const today = toIsoDate(new Date());
  const [rangeParam, setRange] = useOrderDateRangeParam();
  const range = rangeParam ?? { from: today, to: today };
  const rangeKey = range === "all" ? "all" : `${range.from}_${range.to}`;

  const logs = useAsync(() => fetchAttendanceHistory(range), [rangeKey]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ url: string; log: OpenTimeLog } | null>(null);

  useEffect(() => {
    const paths = (logs.data ?? []).map((l) => l.image_url).filter((p): p is string => !!p);
    let cancelled = false;
    fetchAttendanceImageUrls(paths)
      .then((urls) => {
        if (!cancelled) setImageUrls(urls);
      })
      .catch(() => {
        // Ảnh không tải được thì vẫn hiện bảng — ô ảnh tự rơi về trạng thái "không có ảnh".
      });
    return () => {
      cancelled = true;
    };
  }, [logs.data]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const rows = logs.data ?? [];

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-headline-sm text-on-surface">Lịch sử điểm danh</h2>
        <p className="text-body-sm text-on-surface-variant">
          Ảnh và toạ độ được giữ 30 ngày, giờ công giữ vĩnh viễn để tính lương.
        </p>
      </div>

      <OrderDateRangeFilter value={range} onChange={setRange} />

      {logs.loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      ) : logs.error ? (
        <ErrorState onRetry={logs.reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon="🕒" title="Chưa có lượt điểm danh" description={`Không có check-in nào trong: ${describeOrderDateRange(range)}.`} />
      ) : (
        <>
          {/* Mobile: dạng thẻ */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((log) => (
              <li key={log.id} className="flex items-center gap-3 rounded-card border border-outline-variant p-3">
                <Photo log={log} url={log.image_url ? imageUrls[log.image_url] : undefined} onOpen={setPreview} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-lg font-semibold text-on-surface">{log.staff?.full_name ?? "—"}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {formatDate(log.check_in_at)} · {formatClock(log.check_in_at)}
                    {" → "}
                    {log.check_out_at ? formatClock(log.check_out_at) : "đang làm"}
                  </p>
                  <Coordinates log={log} />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: dạng bảng */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-outline-variant text-label-sm text-on-surface-variant">
                  <th className="py-2 pr-3 font-semibold">Ảnh</th>
                  <th className="py-2 pr-3 font-semibold">Nhân viên</th>
                  <th className="py-2 pr-3 font-semibold">Ngày</th>
                  <th className="py-2 pr-3 font-semibold">Vào</th>
                  <th className="py-2 pr-3 font-semibold">Ra</th>
                  <th className="py-2 font-semibold">Toạ độ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id} className="border-b border-outline-variant last:border-0">
                    <td className="py-2 pr-3">
                      <Photo log={log} url={log.image_url ? imageUrls[log.image_url] : undefined} onOpen={setPreview} />
                    </td>
                    <td className="py-2 pr-3 text-label-lg font-semibold text-on-surface">{log.staff?.full_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-on-surface">{formatDate(log.check_in_at)}</td>
                    <td className="py-2 pr-3 text-on-surface">{formatClock(log.check_in_at)}</td>
                    <td className="py-2 pr-3 text-on-surface">
                      {log.check_out_at ? formatClock(log.check_out_at) : <span className="text-secondary">Đang làm</span>}
                    </td>
                    <td className="py-2">
                      <Coordinates log={log} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh check-in của ${preview.log.staff?.full_name ?? "nhân viên"}`}
          className="fixed inset-0 z-50 grid place-items-center bg-inverse-surface/70 p-4"
          onClick={() => setPreview(null)}
        >
          <figure
            className="relative w-full max-w-md overflow-hidden rounded-sheet bg-surface-container-lowest shadow-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={preview.url} alt="" className="aspect-[3/4] w-full object-cover" />
            <figcaption className="p-4 text-body-sm text-on-surface">
              <strong>{preview.log.staff?.full_name ?? "—"}</strong> · {formatDate(preview.log.check_in_at)}{" "}
              {formatClock(preview.log.check_in_at)}
            </figcaption>
            <button
              type="button"
              onClick={() => setPreview(null)}
              aria-label="Đóng"
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          </figure>
        </div>
      )}
    </section>
  );
}

function Photo({
  log,
  url,
  onOpen,
}: {
  log: OpenTimeLog;
  url: string | undefined;
  onOpen: (p: { url: string; log: OpenTimeLog }) => void;
}) {
  if (!url) {
    return (
      <span
        className="grid size-12 shrink-0 place-items-center rounded-card-sm bg-surface-container text-on-surface-variant"
        title={log.image_url ? "Đang tải ảnh" : "Không có ảnh (check-in cũ hoặc đã xoá sau 30 ngày)"}
      >
        <ImageOff size={18} strokeWidth={2} />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen({ url, log })}
      aria-label={`Xem ảnh check-in của ${log.staff?.full_name ?? "nhân viên"}`}
      className="size-12 shrink-0 overflow-hidden rounded-card-sm border border-outline-variant"
    >
      <img src={url} alt="" loading="lazy" className="size-full object-cover" />
    </button>
  );
}

function Coordinates({ log }: { log: OpenTimeLog }) {
  if (log.latitude == null || log.longitude == null) {
    return <span className="text-label-sm text-on-surface-variant">Không có toạ độ</span>;
  }
  const label = `${log.latitude.toFixed(5)}, ${log.longitude.toFixed(5)}`;
  return (
    <a
      href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-label-sm text-on-surface underline decoration-outline-variant underline-offset-2"
    >
      <MapPin size={12} strokeWidth={2.2} className="shrink-0" />
      {label}
    </a>
  );
}
