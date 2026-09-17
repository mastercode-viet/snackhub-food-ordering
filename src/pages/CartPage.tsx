import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, PlusCircle, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import CartLine from "@/components/cart/CartLine";
import SuggestionRow from "@/components/cart/SuggestionRow";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useCartSync } from "@/hooks/useCartSync";
import { useStoreOpen, useStoreSettings } from "@/hooks/useMenu";
import { formatVnd } from "@/lib/format";
import { useCartStore } from "@/store/cart";

export default function CartPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const updateItem = useCartStore((s) => s.updateItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const [confirmClear, setConfirmClear] = useState(false);

  const settings = useStoreSettings();
  const storeOpen = useStoreOpen();
  const sync = useCartSync(items);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const shippingFee = Number(settings.data?.shipping_fee ?? 0);
  const minOrder = Number(settings.data?.min_order_amount ?? 0);
  const total = subtotal + shippingFee;

  const belowMin = subtotal > 0 && subtotal < minOrder;
  const closed = storeOpen.data === false;
  const canCheckout = count > 0 && !sync.hasBlocking && !belowMin && !closed;

  const blockReason = sync.hasBlocking
    ? "Vui lòng xoá các món không còn phục vụ ở trên."
    : belowMin
      ? `Đơn tối thiểu ${formatVnd(minOrder)} — bạn cần thêm ${formatVnd(minOrder - subtotal)} nữa.`
      : closed
        ? "Ngoài giờ nhận đơn (6:00–18:00). Bạn quay lại sau nhé!"
        : null;

  if (items.length === 0) {
    return (
      <div className="px-margin-mobile pt-safe md:px-gutter">
        <h1 className="pb-4 pt-5 text-headline-lg font-bold tracking-tight text-on-surface">Giỏ hàng</h1>
        <EmptyState
          icon="🛍️"
          title="Giỏ hàng đang trống"
          description="Chọn vài món ăn vặt rồi quay lại đây nhé!"
          action={
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/thuc-don"
                className="inline-flex h-11 items-center rounded-full bg-inverse-surface px-6 text-label-lg font-bold text-inverse-on-surface shadow-cta"
              >
                Xem thực đơn
              </Link>
            </motion.div>
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-36 md:pb-0 pt-safe">
      <div className="px-margin-mobile md:px-gutter">
        <div className="flex items-end justify-between gap-3 pb-4 pt-5">
          <div>
            <h1 className="text-headline-lg font-extrabold tracking-tight text-on-surface">Giỏ hàng</h1>
            <p className="mt-0.5 text-body-sm text-on-surface-variant font-medium">
              {count} món đang chờ được thưởng thức
            </p>
          </div>

          {confirmClear ? (
            <div className="flex shrink-0 items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  clear();
                  setConfirmClear(false);
                }}
                className="rounded-full bg-error px-3.5 py-1.5 text-label-sm font-bold text-on-error shadow-badge"
              >
                Xoá hết
              </motion.button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-full bg-surface-container-high px-3.5 py-1.5 text-label-sm font-semibold text-on-surface-variant"
              >
                Huỷ
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="shrink-0 text-label-md font-semibold text-on-surface-variant transition-colors hover:text-error"
            >
              Xoá hết
            </button>
          )}
        </div>
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-gutter md:px-gutter">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 px-margin-mobile md:px-0">
            <div className="flex items-center justify-between px-1">
              <span className="text-label-xs uppercase tracking-wider font-bold text-on-surface-variant">
                Món đã chọn
              </span>
              <Link
                to="/thuc-don"
                className="flex items-center gap-1 text-label-sm font-bold text-primary transition-opacity hover:opacity-85"
              >
                <PlusCircle size={15} strokeWidth={2.4} />
                Thêm món khác
              </Link>
            </div>

            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <CartLine
                  key={item.lineId}
                  item={item}
                  check={sync.checks[item.lineId]}
                  onQuantityChange={(q) => setQuantity(item.lineId, q)}
                  onRemove={() => removeItem(item.lineId)}
                  onAcceptPrice={() => {
                    const issue = sync.checks[item.lineId]?.issue;
                    if (issue?.kind === "price_changed") {
                      updateItem(item.lineId, {
                        unitBase: issue.unitBase,
                        optionsPrice: issue.optionsPrice,
                        unitPrice: issue.unitPrice,
                      });
                    }
                  }}
                />
              ))}
            </AnimatePresence>
          </div>

          <SuggestionRow items={items} />
        </div>

        <div className="md:sticky md:top-24">
          <div className="mt-5 px-margin-mobile md:mt-0 md:px-0">
            <div className="flex flex-col gap-3 rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
              <h2 className="text-headline-sm font-bold text-on-surface">Chi tiết thanh toán</h2>

              <div className="flex flex-col gap-2">
                <Row label={`Tạm tính (${count} món)`} value={formatVnd(subtotal)} />
                <Row
                  label="Phí giao nội khu"
                  value={
                    settings.loading ? null : shippingFee === 0 ? "Miễn phí" : formatVnd(shippingFee)
                  }
                />
              </div>

              <div className="my-1 h-px w-full bg-outline-variant/60" />

              <div className="flex items-end justify-between gap-3 pt-0.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-label-sm font-semibold text-on-surface-variant">Tổng tạm tính</span>
                  <span className="mt-0.5 text-label-xs text-on-surface-variant/80">
                    Mã giảm giá áp ở bước đặt hàng
                  </span>
                </div>
                <span className="shrink-0 text-right text-headline-lg font-black text-primary">
                  {formatVnd(total)}
                </span>
              </div>
            </div>

            <p className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-body-sm font-medium text-on-surface-variant">
              <ShieldCheck size={16} className="text-secondary" strokeWidth={2.4} />
              Giao tận lớp trong khuôn viên trường
            </p>
          </div>

          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 px-margin-mobile md:pointer-events-auto md:static md:mt-4 md:px-0">
            <div className="pointer-events-auto mx-auto max-w-md md:max-w-none">
              <AnimatePresence>
                {blockReason && (
                  <motion.p
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 8, opacity: 0 }}
                    className="mb-2 rounded-full bg-error-container px-4 py-2.5 text-center text-label-sm font-bold text-on-error-container shadow-card"
                  >
                    {blockReason}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                disabled={!canCheckout}
                onClick={() => navigate("/dat-hang")}
                className="flex h-14 w-full items-center justify-between rounded-full bg-inverse-surface px-6 text-inverse-on-surface shadow-cta transition-all disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
              >
                <span className="flex items-center gap-2 text-label-lg font-bold">
                  Đặt hàng ngay
                  <ArrowRight size={18} strokeWidth={2.6} />
                </span>
                <span className="text-headline-sm font-black text-primary-fixed">{formatVnd(total)}</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-body-md text-on-surface-variant">
      <span className="shrink-0">{label}</span>
      {value === null ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        <span className="shrink-0 text-right font-bold text-on-surface">{value}</span>
      )}
    </div>
  );
}
