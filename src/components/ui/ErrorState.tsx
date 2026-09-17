import { RotateCw, WifiOff } from "lucide-react";

/**
 * Lỗi mạng / lỗi truy vấn. Cố ý KHÔNG hiển thị message kỹ thuật của Supabase
 * cho khách — chỉ ghi ra console để lập trình viên đọc.
 *
 * Dùng chung nhịp bố cục với EmptyState (đĩa icon 64px, cùng thang chữ, cùng
 * khoảng cách) để hai trạng thái không đá nhau khi xuất hiện cùng một chỗ.
 */
export default function ErrorState({
  title = "Không tải được dữ liệu",
  description = "Kiểm tra kết nối mạng rồi thử lại nhé.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-card-lg bg-error-container px-6 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-on-error-container/10 text-on-error-container">
        <WifiOff size={28} strokeWidth={2} />
      </span>

      <p className="mt-4 text-headline-sm text-on-error-container">{title}</p>
      <p className="mt-1.5 max-w-[36ch] text-body-md text-on-error-container/80">{description}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-inverse-surface px-6 text-label-md text-inverse-on-surface shadow-cta transition-transform active:scale-95"
        >
          <RotateCw size={16} strokeWidth={2.5} />
          Thử lại
        </button>
      )}
    </div>
  );
}
