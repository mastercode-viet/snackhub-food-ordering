import { Ban, Check, ChefHat, Bike, PackageCheck, Clock } from "lucide-react";
import { formatTime } from "@/lib/format";
import type { Tables } from "@/types/database";

type Status = Tables<"orders">["status"];

/** Nhãn tiếng Việt của 5 trạng thái trong enum order_status. */
export const STATUS_LABEL: Record<Status, string> = {
  pending_confirmation: "Chờ xác nhận",
  preparing: "Đang làm đồ",
  delivering: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

/** 4 bước của một đơn chạy trơn tru; "cancelled" nằm ngoài luồng này. */
const FLOW: Array<{ status: Status; label: string; detail: string; icon: typeof Clock }> = [
  {
    status: "pending_confirmation",
    label: "Chờ xác nhận",
    detail: "Quán đã nhận đơn, đang chờ xác nhận",
    icon: Clock,
  },
  { status: "preparing", label: "Đang làm đồ", detail: "Bếp đang chuẩn bị món của bạn", icon: ChefHat },
  { status: "delivering", label: "Đang giao", detail: "Món đang trên đường tới chỗ bạn", icon: Bike },
  { status: "completed", label: "Hoàn tất", detail: "Đơn đã giao xong. Chúc bạn ngon miệng!", icon: PackageCheck },
];

export function OrderStatusBadge({ status }: { status: Status }) {
  const tone =
    status === "cancelled"
      ? "bg-error-container text-on-error-container"
      : status === "completed"
        ? "bg-secondary-container text-on-secondary-container"
        : "bg-primary-fixed text-on-primary-fixed";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-label-md ${tone}`}>
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${
          status === "cancelled"
            ? "bg-error"
            : status === "completed"
              ? "bg-secondary"
              : "animate-pulse bg-primary"
        }`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Hành trình đơn hàng.
 *
 * Bản Stitch có tài xế, khoảng cách GPS, vòng tiến độ % và thời gian dự kiến —
 * đã bỏ hết: SnackHub chỉ có một vai trò Admin, không có shipper riêng và
 * backend không lưu toạ độ hay ETA nào. Chỉ giữ đúng 4 trạng thái có thật.
 */
export function OrderTimeline({
  status,
  createdAt,
  completedAt,
  cancelledAt,
  cancelReason,
}: {
  status: Status;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}) {
  if (status === "cancelled") {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-error-container p-4">
        <Ban size={20} className="mt-0.5 shrink-0 text-on-error-container" strokeWidth={2.2} />
        <div>
          <p className="text-label-lg text-on-error-container">Đơn đã huỷ</p>
          <p className="mt-0.5 text-body-sm text-on-error-container/85">
            {cancelReason || "Không có lý do được ghi nhận."}
          </p>
          {cancelledAt && (
            <p className="mt-1 text-body-sm text-on-error-container/70">{formatTime(cancelledAt)}</p>
          )}
        </div>
      </div>
    );
  }

  const currentIndex = FLOW.findIndex((s) => s.status === status);

  return (
    <ol className="flex flex-col">
      {FLOW.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const Icon = step.icon;
        const last = index === FLOW.length - 1;

        // Chỉ có 2 mốc thời gian thật trong DB: lúc tạo đơn và lúc hoàn tất.
        const time =
          index === 0 ? createdAt : last && status === "completed" ? completedAt : null;

        return (
          <li key={step.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
                  done
                    ? "bg-secondary text-on-secondary"
                    : active
                      ? "bg-inverse-surface text-inverse-on-surface shadow-cta"
                      : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {done ? <Check size={16} strokeWidth={3} /> : <Icon size={16} strokeWidth={2.4} />}
              </span>
              {!last && (
                <span
                  className={`w-0.5 flex-1 ${done ? "bg-secondary" : "bg-surface-container-high"}`}
                />
              )}
            </div>

            <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-5"}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={`text-label-lg ${
                    active ? "text-primary" : done ? "text-on-surface" : "text-on-surface-variant"
                  }`}
                >
                  {step.label}
                </p>
                {time && (
                  <span className="shrink-0 text-body-sm text-on-surface-variant">
                    {formatTime(time)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">{step.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

