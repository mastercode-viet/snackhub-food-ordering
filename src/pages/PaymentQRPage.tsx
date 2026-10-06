import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Clock, QrCode, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { cancelPayment, cancelPaymentOnUnload } from "@/lib/api";
import { fetchOrderByCode, type OrderView } from "@/lib/queries";
import { buildReorder } from "@/lib/reorder";
import { formatVnd } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useCartStore } from "@/store/cart";
import { toast } from "@/store/toast";

/** Poll dự phòng cho Broadcast — socket rớt giữa chừng vẫn không kẹt đơn. */
const POLL_MS = 5000;

export default function PaymentQRPage() {
  const { orderCode = "" } = useParams();
  const navigate = useNavigate();
  const addItem = useCartStore((s) => s.addItem);

  const [order, setOrder] = useState<OrderView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [leaving, setLeaving] = useState(false);

  /**
   * Chặn huỷ đơn sau khi đã chốt (đã trả tiền, hoặc chính ta đang chủ động rời
   * trang). Dùng ref chứ không dùng state vì các handler thoát trang đọc giá
   * trị này ngoài chu kỳ render.
   */
  const settled = useRef(false);
  // Đơn tại quầy (QR ở quầy): trả xong chỉ cần hiện mã đơn, không theo dõi giao hàng.
  const inStoreRef = useRef(false);

  const goPaid = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    toast.success("Đã nhận được thanh toán!");
    navigate(inStoreRef.current ? `/tai-quay/${orderCode}` : `/don-hang/${orderCode}`, { replace: true });
  }, [navigate, orderCode]);

  // ── Tải đơn + chặn vào nhầm trạng thái ────────────────────────────────────
  useEffect(() => {
    let alive = true;

    fetchOrderByCode(orderCode)
      .then((o) => {
        if (!alive) return;
        inStoreRef.current = o.delivery_method === "in_store";
        if (o.payment_method !== "payos" || o.payment_status !== "pending") {
          // Đã trả xong / đơn COD / đơn đã huỷ: trang QR không còn nghĩa lý gì.
          settled.current = true;
          const paidInStore = inStoreRef.current && o.status !== "cancelled";
          navigate(paidInStore ? `/tai-quay/${orderCode}` : `/don-hang/${orderCode}`, { replace: true });
          return;
        }
        setOrder(o);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [orderCode, navigate]);

  // ── Realtime: webhook phát broadcast trên kênh order:<mã đơn> ─────────────
  useEffect(() => {
    if (!order) return;

    const channel = supabase
      .channel(`order:${orderCode}`)
      .on("broadcast", { event: "paid" }, () => goPaid())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [order, orderCode, goPaid]);

  // ── Poll dự phòng ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!order) return;

    const timer = setInterval(() => {
      void fetchOrderByCode(orderCode)
        .then((o) => {
          if (o.payment_status === "paid") goPaid();
          else if (o.status === "cancelled") {
            settled.current = true;
            navigate(`/don-hang/${orderCode}`, { replace: true });
          }
        })
        .catch(() => {});
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [order, orderCode, goPaid, navigate]);

  // ── Rời trang = bỏ thanh toán ─────────────────────────────────────────────
  // Bắt tín hiệu thoát TƯỜNG MINH (popstate, đóng tab, nút trong trang) thay vì
  // cleanup unmount trần: StrictMode ở dev mount/unmount hai lần trong cùng một
  // tick, không có cách nào phân biệt "unmount thật" với "unmount ảo của
  // StrictMode" chỉ dựa vào timing — cleanup trần sẽ huỷ đơn ngay khi vừa mở
  // trang. Tín hiệu thoát tường minh không có nhập nhằng đó.
  //
  // KHÔNG dùng pushState để "bẫy" nút back. Từng làm vậy và gây đúng lỗi đang
  // sửa: bẫy tạo ra một entry lịch sử THỨ HAI cùng URL /thanh-toan/:code; khi
  // trả tiền thành công, goPaid() chỉ replace được entry bẫy (entry trên cùng),
  // còn entry GỐC (do CheckoutPage.navigate(replace:true) tạo ra lúc vào trang
  // này) vẫn nằm nguyên bên dưới — bấm Back sau khi đã trả tiền vẫn rơi về đúng
  // entry gốc đó, tức lại thấy trang QR. Bỏ hẳn pushState thì trang QR chỉ còn
  // ĐÚNG MỘT entry trong lịch sử, goPaid() replace là xoá sạch, Back không còn
  // đường nào quay lại được trang này nữa.
  //
  // Hệ quả: khi khách bấm back thật, trình duyệt ĐÃ điều hướng đi trước khi
  // handler dưới đây chạy — không còn gì để "chặn". Việc còn lại chỉ là báo
  // cho server biết để nhả mã QR sớm, chạy nền, không điều hướng thêm (khách
  // đã ở trang khác, tự ý kéo họ tới /dat-hang lúc này là hành vi bất ngờ).
  const cancelInBackground = useCallback(async () => {
    if (settled.current || !order) return;

    // Đọc lại đơn từ server NGAY TRƯỚC khi quyết định huỷ — state `order` trong
    // closure có thể đã cũ vài giây so với lúc khách bấm back, và webhook có thể
    // vừa ghi 'paid' đúng trong khoảng đó. Không dựa vào state cũ để quyết định
    // có gọi cancelPayment hay không.
    try {
      const fresh = await fetchOrderByCode(orderCode);
      if (fresh.payment_status === "paid") {
        settled.current = true; // component đã unmount (đã back) nên không gọi goPaid() điều hướng
        return;
      }
    } catch {
      // Đọc lại thất bại thì vẫn thử huỷ bên dưới — cancel-payment tự đọc lại
      // trạng thái mới nhất trên server trước khi làm bất cứ điều gì.
    }

    if (settled.current) return; // goPaid() có thể đã chạy trong lúc đang await ở trên
    settled.current = true;

    try {
      await cancelPayment(orderCode);
    } catch {
      // Không huỷ được ở server thì pg_cron vẫn dọn đơn treo sau ít phút.
    }
  }, [order, orderCode]);

  // Khách chủ động bấm "Đổi phương thức thanh toán" — CÒN đang ở trang này nên
  // (khác cancelInBackground) cần điều hướng + dựng lại giỏ cho khách chọn tiếp.
  const abandonAndReturn = useCallback(async () => {
    if (settled.current || !order) return;
    setLeaving(true);

    try {
      const fresh = await fetchOrderByCode(orderCode);
      if (fresh.payment_status === "paid") {
        goPaid();
        return;
      }
    } catch {
      // Đọc lại thất bại thì vẫn thử huỷ bên dưới.
    }

    if (settled.current) return;
    settled.current = true;

    try {
      const result = await cancelPayment(orderCode);

      // Khách vừa chuyển tiền xong đúng lúc bấm nút — tiền đã vào, giữ đơn.
      if (!result.cancelled && result.reason === "PAID") {
        goPaid();
        return;
      }
    } catch {
      // Không huỷ được ở server thì pg_cron vẫn dọn đơn treo sau ít phút.
    }

    // Trả món về giỏ để khách chọn lại phương thức thanh toán.
    try {
      const rebuilt = await buildReorder(order.items);
      for (const item of rebuilt.items) addItem(item);
    } catch {
      // Giỏ không dựng lại được thì vẫn cho khách về trang đặt hàng.
    }

    toast.info("Đã huỷ thanh toán, bạn chọn lại phương thức nhé.");
    navigate("/dat-hang", { replace: true });
  }, [order, orderCode, addItem, navigate, goPaid]);

  useEffect(() => {
    if (!order) return;

    const onPopState = () => void cancelInBackground();
    const onBeforeUnload = () => {
      if (settled.current) return;
      cancelPaymentOnUnload(orderCode);
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [order, orderCode, cancelInBackground]);

  if (loading) {
    return (
      <Shell>
        <Skeleton className="h-64 w-full rounded-card-lg" />
      </Shell>
    );
  }

  if (error || !order) {
    return (
      <Shell>
        <ErrorState onRetry={() => window.location.reload()} />
      </Shell>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-12 pt-safe">
      <header className="sticky top-0 z-30 border-b border-outline-variant/40 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-content items-center gap-3 px-margin-mobile py-3 md:px-gutter">
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={() => void abandonAndReturn()}
            aria-label="Huỷ thanh toán và quay lại"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface shadow-card"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </motion.button>
          <h1 className="text-headline-sm font-bold text-on-surface">Thanh toán VietQR</h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-margin-mobile pt-4 md:px-gutter">
        <section className="rounded-card-lg border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-card">
          <p className="text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Số tiền cần chuyển
          </p>
          <p className="mt-0.5 text-headline-lg font-black text-primary">
            {formatVnd(order.total_amount)}
          </p>

          {order.payos_qr_code && (
            <div className="mt-4 grid place-items-center rounded-card border border-outline-variant/60 bg-white p-4">
              <QRCodeSVG value={order.payos_qr_code} size={208} level="M" marginSize={2} />
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-body-sm font-medium text-on-surface-variant">
              Nội dung chuyển khoản
            </span>
            <span className="font-mono text-label-lg font-bold text-on-surface">
              {order.order_code}
            </span>
          </div>

          <p className="mt-3 rounded-card border border-outline-variant/40 bg-surface-container-low/80 px-3.5 py-2.5 text-body-sm text-on-surface-variant">
            Mở app ngân hàng và quét mã trên — số tiền cùng nội dung{" "}
            <b className="text-on-surface">{order.order_code}</b> đã nằm sẵn trong mã, không cần
            nhập tay.
          </p>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-body-sm font-medium text-on-surface-variant">
            <Clock size={16} className="text-secondary" strokeWidth={2.4} />
            Trang tự chuyển ngay khi quán nhận được tiền
          </p>
        </section>

        {order.payos_checkout_url && (
          <motion.a
            whileTap={{ scale: 0.96 }}
            href={order.payos_checkout_url}
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-outline-variant text-label-lg font-bold text-on-surface"
          >
            <QrCode size={18} strokeWidth={2.4} />
            Mở trang thanh toán PayOS
          </motion.a>
        )}

        <button
          type="button"
          disabled={leaving}
          onClick={() => void abandonAndReturn()}
          className="h-12 rounded-full text-label-lg font-bold text-on-surface-variant disabled:opacity-60"
        >
          {leaving ? "Đang huỷ…" : "Đổi phương thức thanh toán"}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-center text-body-sm font-medium text-on-surface-variant">
          <ShieldCheck size={16} className="text-secondary" strokeWidth={2.4} />
          Rời trang này sẽ huỷ mã QR hiện tại
        </p>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background pt-safe">
      <div className="mx-auto w-full max-w-content px-margin-mobile pt-6 md:px-gutter">
        <Link to="/don-hang" className="text-label-md font-semibold text-on-surface-variant">
          ← Đơn hàng của tôi
        </Link>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
