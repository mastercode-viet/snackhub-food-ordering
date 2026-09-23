/** 25000 -> "25.000đ" */
export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

/** Giá sau khi trừ giảm giá của món (theo % hoặc theo số tiền cố định), làm tròn về đồng, không âm. */
export function discountedPrice(
  basePrice: number,
  discountType: "percent" | "fixed",
  discountValue: number,
): number {
  const cut = discountType === "percent" ? basePrice * (discountValue / 100) : discountValue;
  return Math.max(0, Math.round(basePrice - cut));
}

/**
 * Tỷ lệ giảm giá thực tế (0-1), quy đổi cả 2 kiểu giảm về cùng 1 thang để so
 * sánh công bằng "giảm sâu nhất" giữa món giảm theo % và món giảm theo tiền.
 */
export function effectiveDiscountRatio(
  basePrice: number,
  discountType: "percent" | "fixed",
  discountValue: number,
): number {
  if (basePrice <= 0) return 0;
  return (basePrice - discountedPrice(basePrice, discountType, discountValue)) / basePrice;
}

/** "20%" hoặc "5.000đ" tuỳ kiểu giảm — không có dấu trừ, để ghép sau chữ "Giảm". */
export function discountAmountLabel(discountType: "percent" | "fixed", discountValue: number): string {
  return discountType === "percent" ? `${discountValue}%` : formatVnd(discountValue);
}

/** Nhãn badge giảm giá: "-20%" hoặc "-5.000đ" tuỳ kiểu giảm — dùng chung để badge không lệch nhau giữa các nơi hiển thị. */
export function discountBadgeLabel(discountType: "percent" | "fixed", discountValue: number): string {
  return `-${discountAmountLabel(discountType, discountValue)}`;
}

/** "2026-09-11T08:44:55Z" -> "11/09/2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "2026-09-11T08:44:55Z" -> "15:44" */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/** "15:44 · 11/09" — dùng cho mốc thời gian trong timeline */
export function formatTime(iso: string): string {
  return `${formatClock(iso)} · ${new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  })}`;
}

/** 125 -> "2h05" — tổng phút chấm công/giờ công ra dạng giờ-phút gọn cho bảng lương. */
export function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h > 0 ? `${h}h${String(rest).padStart(2, "0")}` : `${rest}p`;
}

/** Date -> "2026-09-20" theo giờ ĐỊA PHƯƠNG (không dùng toISOString — lệch ngày quanh nửa đêm do UTC). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "06:00:00" -> "06:00" (bỏ giây, dùng cho input type=time và hiển thị ca làm). */
export function formatTimeOfDay(time: string): string {
  return time.slice(0, 5);
}

/** ISO timestamp -> "2026-09-20T08:30" theo giờ ĐỊA PHƯƠNG, đúng định dạng input type="datetime-local". */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Giá trị input type="datetime-local" (giờ địa phương, không timezone) -> ISO timestamp để gửi lên Supabase. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}
