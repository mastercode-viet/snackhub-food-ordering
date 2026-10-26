import { Minus, Plus, X } from "lucide-react";
import { motion } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import { formatVnd } from "@/lib/format";
import type { LineCheck } from "@/hooks/useCartSync";
import type { CartItem } from "@/store/cart";

export default function CartLine({
  item,
  check,
  onQuantityChange,
  onRemove,
  onAcceptPrice,
}: {
  item: CartItem;
  check?: LineCheck;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onAcceptPrice: () => void;
}) {
  const issue = check?.issue ?? null;
  const blocked = check?.blocking ?? false;

  // Combo không có option tuỳ biến — dòng tóm tắt thay bằng danh sách món con.
  // Sản phẩm lẻ thì tách topping ra dòng riêng có nhãn, vì topping là thứ
  // khách chủ động thêm và trả tiền thêm, không nên lẫn với option như size.
  // Combo: hiển thị tóm tắt món con + lựa chọn của từng thành phần (nếu có).
  const optionSummary =
    item.kind === "combo"
      ? [
          item.items.map((i) => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name)).join(" · "),
          ...item.components
            .filter((c) => c.options.length > 0)
            .map(
              (c) =>
                `${c.productName}: ${c.options.map((o) => o.optionName).join(", ")}`,
            ),
          ...item.choices.map((c) =>
            c.options.length > 0
              ? `${c.groupName} - ${c.productName}: ${c.options.map((o) => o.optionName).join(", ")}`
              : `${c.groupName}: ${c.productName}`,
          ),
        ]
          .filter(Boolean)
          .join(" · ")
      : item.options
          .filter((o) => o.source !== "topping")
          .map((o) => o.optionName)
          .join(", ");

  const toppingSummary =
    item.kind === "combo"
      ? ""
      : item.options
          .filter((o) => o.source === "topping")
          .map((o) => o.optionName)
          .join(", ");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`relative flex flex-col gap-3 rounded-card bg-surface-container-lowest p-3.5 shadow-card border border-outline-variant/40 ${
        blocked ? "ring-1 ring-error/60" : ""
      }`}
    >
      <div className="flex items-center gap-3.5">
        <ProductImage
          src={item.imageUrl}
          alt={item.name}
          fallbackIcon={item.kind === "combo" ? "🍱" : item.categoryIcon}
          className={`size-20 shrink-0 rounded-card-sm ${blocked ? "opacity-45 grayscale" : ""}`}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-1">
            <h3 className="truncate text-label-lg font-bold text-on-surface">{item.name}</h3>
            <motion.button
              whileTap={{ scale: 0.8 }}
              type="button"
              onClick={onRemove}
              aria-label={`Xoá ${item.name}`}
              className="-m-1.5 p-1.5 text-on-surface-variant transition-colors hover:text-error"
            >
              <X size={18} strokeWidth={2.4} />
            </motion.button>
          </div>

          {optionSummary && (
            <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">{optionSummary}</p>
          )}
          {toppingSummary && (
            <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">
              <span className="font-bold text-secondary">Topping:</span> {toppingSummary}
            </p>
          )}
          {item.note && (
            <p className="mt-0.5 truncate text-body-sm italic text-on-surface-variant/80">
              “{item.note}”
            </p>
          )}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="text-label-lg font-extrabold text-primary">
              {formatVnd(item.unitPrice * item.quantity)}
            </span>

            <div className="flex items-center gap-2 rounded-full bg-surface-container-high/80 p-1 shadow-inner">
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                onClick={() => onQuantityChange(item.quantity - 1)}
                aria-label="Giảm số lượng"
                className="grid size-7 place-items-center rounded-full bg-surface-container-lowest text-on-surface shadow-card transition-colors hover:bg-surface-container-high"
              >
                <Minus size={13} strokeWidth={3} />
              </motion.button>
              <span className="min-w-[14px] px-1 text-center text-label-md font-bold text-on-surface">
                {item.quantity}
              </span>
              <motion.button
                whileTap={{ scale: 0.85 }}
                type="button"
                onClick={() => onQuantityChange(item.quantity + 1)}
                disabled={item.quantity >= 99}
                aria-label="Tăng số lượng"
                className="grid size-7 place-items-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-cta transition-colors hover:opacity-90 disabled:opacity-40"
              >
                <Plus size={13} strokeWidth={3} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {issue && <IssueNote issue={issue} onRemove={onRemove} onAcceptPrice={onAcceptPrice} />}
    </motion.div>
  );
}

function IssueNote({
  issue,
  onRemove,
  onAcceptPrice,
}: {
  issue: NonNullable<LineCheck["issue"]>;
  onRemove: () => void;
  onAcceptPrice: () => void;
}) {
  if (issue.kind === "price_changed") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-card bg-tertiary-fixed/60 px-3.5 py-2.5 border border-tertiary-fixed">
        <p className="text-body-sm text-on-tertiary-fixed">
          Món này đã đổi giá, nay còn <strong>{formatVnd(issue.unitPrice)}</strong>/phần.
        </p>
        <button
          type="button"
          onClick={onAcceptPrice}
          className="shrink-0 rounded-full bg-on-tertiary-fixed px-3.5 py-1.5 text-label-sm font-bold text-tertiary-fixed"
        >
          Cập nhật
        </button>
      </div>
    );
  }

  const message =
    issue.kind === "removed"
      ? "Món này không còn trong thực đơn."
      : issue.kind === "sold_out"
        ? "Món này đang tạm hết hàng."
        : `Đã hết: ${issue.names.join(", ")}.`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-card bg-error-container px-3.5 py-2.5 border border-error-container">
      <p className="text-body-sm font-medium text-on-error-container">{message}</p>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full bg-on-error-container px-3.5 py-1.5 text-label-sm font-bold text-error-container"
      >
        Xoá món
      </button>
    </div>
  );
}
