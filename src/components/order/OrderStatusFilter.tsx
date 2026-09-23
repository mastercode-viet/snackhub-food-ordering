import { STATUS_LABEL, STATUS_ORDER, statusDotClass } from "@/components/order/OrderStatus";
import type { Tables } from "@/types/database";

type Status = Tables<"orders">["status"];

/** `"all"` = không lọc. Các giá trị còn lại là chính enum `order_status`. */
export type StatusFilter = "all" | Status;

/**
 * Pill lọc đơn theo trạng thái, cuộn ngang như dải danh mục ở Trang chủ.
 *
 * Chỉ hiện pill của những trạng thái CÓ đơn thật — bày đủ 5 pill rồi bấm vào
 * ra danh sách rỗng thì chẳng để làm gì, mà trên màn điện thoại lại chiếm hết
 * một hàng. Vì vậy số pill thay đổi theo dữ liệu, `total` luôn đứng đầu.
 */
export default function OrderStatusFilter({
  counts,
  total,
  value,
  onChange,
}: {
  counts: Partial<Record<Status, number>>;
  total: number;
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  const present = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0);

  // Một trạng thái duy nhất thì "Tất cả" và pill đó ra cùng một danh sách.
  if (present.length < 2) return null;

  return (
    <div
      role="tablist"
      aria-label="Lọc đơn theo trạng thái"
      className="no-scrollbar -mx-margin-mobile flex items-center gap-2 overflow-x-auto px-margin-mobile py-1 md:-mx-gutter md:px-gutter"
    >
      <Pill
        label="Tất cả"
        count={total}
        active={value === "all"}
        onClick={() => onChange("all")}
      />
      {present.map((status) => (
        <Pill
          key={status}
          label={STATUS_LABEL[status]}
          count={counts[status] ?? 0}
          dot={statusDotClass(status)}
          active={value === status}
          onClick={() => onChange(status)}
        />
      ))}
    </div>
  );
}

function Pill({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-label-md transition-colors active:scale-95 ${
        active
          ? "bg-inverse-surface font-semibold text-inverse-on-surface shadow-cta"
          : "border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-card hover:bg-surface-container-low"
      }`}
    >
      {dot && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />}
      <span>{label}</span>
      <span className={active ? "text-inverse-on-surface/70" : "text-outline"}>{count}</span>
    </button>
  );
}
