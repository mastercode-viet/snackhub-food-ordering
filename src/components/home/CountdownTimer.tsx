import { useEffect, useState } from "react";

/**
 * Đồng hồ đếm ngược HH:MM:SS cho khối Flash Sale.
 *
 * `endsAt` là ISO string mốc kết thúc. Hiện TRUYỀN NULL vì bảng `products` chưa
 * có cột thời gian khuyến mãi — schema chỉ có `discount_percent` vĩnh viễn,
 * không có `starts_at`/`ends_at`. Khi nào thêm cột đó thì truyền vào là chạy,
 * không phải sửa component.
 *
 * Null hoặc đã hết giờ thì KHÔNG render gì. Cố ý không bịa ra một mốc thời gian
 * giả để có đồng hồ chạy — đếm ngược tới một hạn không có thật là nói dối khách.
 *
 * Khuôn setInterval + clearInterval trong cleanup lấy theo OrderTrackingPage.
 */
function remainingMs(endsAt: string): number {
  return Math.max(0, new Date(endsAt).getTime() - Date.now());
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export default function CountdownTimer({ endsAt }: { endsAt: string | null }) {
  const [left, setLeft] = useState(() => (endsAt ? remainingMs(endsAt) : 0));

  useEffect(() => {
    if (!endsAt) return;

    setLeft(remainingMs(endsAt));

    const timer = setInterval(() => {
      const next = remainingMs(endsAt);
      setLeft(next);
      // Hết giờ thì dừng hẳn, không để interval chạy mãi trong nền
      if (next === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [endsAt]);

  if (!endsAt || left <= 0) return null;

  const totalSeconds = Math.floor(left / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <div
      className="flex items-center gap-1"
      role="timer"
      aria-label={`Còn ${hours} giờ ${minutes} phút ${seconds} giây`}
    >
      {[pad(hours), pad(minutes), pad(seconds)].map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-label-sm font-bold text-on-surface-variant">:</span>}
          <span className="rounded-md bg-inverse-surface px-1.5 py-0.5 text-label-sm font-bold tabular-nums text-inverse-on-surface">
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}
