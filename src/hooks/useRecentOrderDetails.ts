import { useMemo } from "react";
import { useAsync } from "@/hooks/useAsync";
import { fetchOrderByCode, type OrderView } from "@/lib/queries";

/** `null` = tra không ra. Thiếu khoá = chưa có câu trả lời cho mã đó. */
export type OrderDetailMap = Record<string, OrderView | null>;

/**
 * Đọc trạng thái hiện tại của các đơn đã lưu trên máy này.
 *
 * Gọi song song từng mã một vì không có cách nào lấy hàng loạt: khách không
 * đăng nhập, `orders` bị RLS chặn, và `get_order_by_code` chỉ nhận đúng một mã.
 * Danh sách đã giới hạn 10 mã nên số request vẫn nhỏ.
 *
 * Trả về map theo MÃ, không phải mảng theo thứ tự: `useAsync` giữ lại dữ liệu
 * của lần trước trong lúc gọi lại, nên nếu ghép theo chỉ số thì chỉ cần khách
 * bỏ một đơn giữa danh sách là các đơn còn lại hiện nhầm trạng thái của nhau.
 *
 * Mã tra không ra (đơn bị xoá, hoặc gõ tay sai) trả `null` thay vì ném lỗi —
 * một mã hỏng không được làm sập cả danh sách.
 */
export function useRecentOrderDetails(codes: string[]) {
  const key = codes.join(",");

  const fn = useMemo(
    () => async () => {
      const results = await Promise.all(
        codes.map((code) => fetchOrderByCode(code).catch(() => null)),
      );
      const map: OrderDetailMap = {};
      codes.forEach((code, index) => {
        map[code] = results[index];
      });
      return map;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return useAsync<OrderDetailMap>(fn, [key]);
}
