/** 25000 -> "25.000đ" */
export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

/** Giá sau khi trừ % giảm của món (làm tròn về đồng). */
export function discountedPrice(basePrice: number, discountPercent: number): number {
  return Math.round(basePrice * (1 - discountPercent / 100));
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
