import { useMemo } from "react";
import { useAsync } from "@/hooks/useAsync";
import { fetchOrderByCode, type OrderView } from "@/lib/queries";

/**
 * Đọc trạng thái hiện tại của các đơn đã lưu trên máy này.
 *
 * Gọi song song từng mã một vì không có cách nào lấy hàng loạt: khách không
 * đăng nhập, `orders` bị RLS chặn, và `get_order_by_code` chỉ nhận đúng một mã.
 * Danh sách đã giới hạn 10 mã nên số request vẫn nhỏ.
 *
 * Mã tra không ra (đơn bị xoá, hoặc gõ tay sai) trả `null` thay vì ném lỗi —
 * một mã hỏng không được làm sập cả danh sách.
 */
export function useRecentOrderDetails(codes: string[]) {
  const key = codes.join(",");

  const fn = useMemo(
    () => () =>
      Promise.all(
        codes.map((code) =>
          fetchOrderByCode(code).catch(() => null),
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return useAsync<Array<OrderView | null>>(fn, [key]);
}
