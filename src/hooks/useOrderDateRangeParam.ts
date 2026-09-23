import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { OrderDateRange } from "@/lib/queries";

/**
 * Lưu bộ lọc khoảng ngày của trang tra cứu đơn qua URL Search Params
 * (?range=all hoặc ?from=...&to=...) — reload/chia sẻ link vẫn giữ đúng
 * bộ lọc đang xem, không cần Zustand cho một giá trị đơn giản, dùng ở đúng 1 trang.
 *
 * Trả về `undefined` khi URL chưa có tham số nào — trang gọi hook tự quyết
 * định giá trị mặc định (vd "hôm nay") thay vì hook áp đặt sẵn.
 */
export function useOrderDateRangeParam(): [OrderDateRange | undefined, (next: OrderDateRange) => void] {
  const [params, setParams] = useSearchParams();

  const value = useMemo<OrderDateRange | undefined>(() => {
    if (params.get("range") === "all") return "all";
    const from = params.get("from");
    const to = params.get("to");
    return from && to ? { from, to } : undefined;
  }, [params]);

  const setValue = useCallback(
    (next: OrderDateRange) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete("range");
          p.delete("from");
          p.delete("to");
          if (next === "all") {
            p.set("range", "all");
          } else {
            p.set("from", next.from);
            p.set("to", next.to);
          }
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [value, setValue];
}
