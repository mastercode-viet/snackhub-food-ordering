import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Copy, Store } from "lucide-react";
import { fetchOrderByCode, type OrderView } from "@/lib/queries";
import { copyText } from "@/lib/clipboard";
import { formatVnd } from "@/lib/format";
import { Skeleton } from "@/components/Skeleton";

/**
 * Màn kết quả của đơn "Đặt tại quầy" (QR ở quầy): CHỈ hiện mã đơn thật to để
 * khách đưa cho nhân viên — không có hành trình giao hàng như /don-hang/:code.
 * Tra lại đơn để hiện tổng tiền + tình trạng thanh toán; tra lỗi vẫn hiện mã.
 */
export default function InStoreOrderPage() {
  const { orderCode = "" } = useParams();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchOrderByCode(orderCode)
      .then((o) => alive && setOrder(o))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orderCode]);

  async function handleCopy() {
    if (await copyText(orderCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const paid = order?.payment_status === "paid";

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-margin-mobile py-10 pt-safe">
      <section className="flex w-full max-w-sm flex-col items-center gap-4 rounded-card-lg bg-surface-container-lowest p-6 text-center shadow-card">
        <span className="grid size-14 place-items-center rounded-full bg-secondary-fixed text-on-secondary-fixed">
          <Store size={26} strokeWidth={2.4} />
        </span>
        <div>
          <h1 className="text-headline-md text-on-surface">Đặt món thành công!</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Đưa mã này cho nhân viên tại quầy</p>
        </div>

        <div className="w-full rounded-card border-2 border-inverse-surface px-4 py-5">
          <p className="text-label-sm uppercase text-on-surface-variant">Mã đơn</p>
          <p className="mt-1 select-all break-all font-mono text-[2rem] font-extrabold leading-tight tracking-wider text-on-surface">
            {orderCode}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-outline-variant px-4 text-label-md font-semibold text-on-surface"
        >
          {copied ? <Check size={16} strokeWidth={2.6} /> : <Copy size={16} strokeWidth={2.4} />}
          {copied ? "Đã sao chép" : "Sao chép mã"}
        </button>

        {loading ? (
          <Skeleton className="h-10 w-full rounded-card" />
        ) : (
          order && (
            <p
              className={`w-full rounded-card px-3 py-2 text-label-md ${
                paid ? "bg-secondary-fixed text-on-secondary-fixed" : "bg-tertiary-fixed text-on-tertiary-fixed"
              }`}
            >
              {formatVnd(order.total_amount)} ·{" "}
              {paid ? "Đã thanh toán online" : "Thanh toán tiền mặt tại quầy"}
            </p>
          )
        )}

        <Link
          to="/"
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-inverse-surface px-6 text-label-lg text-inverse-on-surface shadow-cta"
        >
          Đặt thêm món
        </Link>
      </section>
    </div>
  );
}
