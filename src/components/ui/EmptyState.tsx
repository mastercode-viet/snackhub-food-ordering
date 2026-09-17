import type { ReactNode } from "react";

/**
 * Trạng thái rỗng. Icon nằm trong đĩa tròn để có điểm neo thị giác — nếu thả
 * emoji trần giữa khoảng trắng thì khối này trông như đang lỗi chứ không phải
 * "chưa có gì ở đây".
 */
export default function EmptyState({
  icon = "🍽️",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card-lg bg-surface-container-lowest px-6 py-10 text-center shadow-card">
      <span
        className="grid size-16 place-items-center rounded-full bg-surface-container text-3xl"
        aria-hidden="true"
      >
        {icon}
      </span>

      <p className="mt-4 text-headline-sm text-on-surface">{title}</p>

      {description && (
        <p className="mt-1.5 max-w-[36ch] text-body-md text-on-surface-variant">{description}</p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
