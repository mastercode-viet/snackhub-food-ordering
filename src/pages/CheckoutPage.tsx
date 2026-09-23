import { useEffect, useRef, useState } from "react";
import { closedMessage } from "@/components/home/StoreStatus";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, MapPin, NotebookPen, Receipt, Ticket, User } from "lucide-react";
import Field from "@/components/checkout/Field";
import Select from "@/components/checkout/Select";
import PaymentMethods from "@/components/checkout/PaymentMethods";
import DiscountBox from "@/components/checkout/DiscountBox";
import { Skeleton } from "@/components/Skeleton";
import { useStoreOpen, useStoreSettings } from "@/hooks/useMenu";
import { ApiError, createOrder, type DiscountPreview } from "@/lib/api";
import {
  BUILDINGS,
  DELIVERY_POINT_NOTE,
  checkoutSchema,
  composeDeliveryNote,
  type CheckoutForm,
} from "@/lib/checkoutSchema";
import { formatVnd } from "@/lib/format";
import { useCartStore } from "@/store/cart";
import { useProfileStore } from "@/store/profile";
import { useRecentOrders } from "@/store/recentOrders";
import { toast } from "@/store/toast";

const PAYOS_ENABLED = true;

export default function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
  const savedProfile = useProfileStore((s) => s.profile);
  const saveProfile = useProfileStore((s) => s.save);
  const rememberOrder = useRecentOrders((s) => s.remember);

  const settings = useStoreSettings();
  const storeOpen = useStoreOpen();

  const [form, setForm] = useState<CheckoutForm>({
    ...savedProfile,
    building: savedProfile.building as CheckoutForm["building"],
    payment_method: PAYOS_ENABLED ? "payos" : "cod",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({});
  const [discount, setDiscount] = useState<DiscountPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  /**
   * Đặt xong thì giỏ bị dọn sạch, nhưng lúc đó KHÔNG được coi là "giỏ rỗng"
   * nữa — đích đến là màn Đơn & Tôi, không phải giỏ hàng.
   */
  const placed = useRef(false);

  // Vào thẳng màn đặt hàng với giỏ rỗng thì không có gì để đặt — quay về giỏ.
  useEffect(() => {
    if (items.length === 0 && !placed.current) navigate("/gio-hang", { replace: true });
  }, [items.length, navigate]);

  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const shippingFee = Number(settings.data?.shipping_fee ?? 0);
  const discountAmount = discount?.discount_amount ?? 0;
  const total = Math.max(0, subtotal - discountAmount + shippingFee);

  function set<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setApiError(null);
  }

  async function submit() {
    if (submitting) return;
    setApiError(null);

    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<keyof CheckoutForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CheckoutForm;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createOrder({
        customer_name: parsed.data.customer_name,
        customer_phone: parsed.data.customer_phone,
        building: parsed.data.building,
        delivery_note: composeDeliveryNote(parsed.data),
        payment_method: parsed.data.payment_method,
        discount_code: discount?.code,
        items: items.map((i) =>
          i.kind === "combo"
            ? { kind: "combo" as const, combo_id: i.comboId, quantity: i.quantity, item_note: i.note ?? undefined }
            : {
                kind: "product" as const,
                product_id: i.productId,
                quantity: i.quantity,
                option_ids: i.options.map((o) => o.optionId),
                item_note: i.note ?? undefined,
              },
        ),
      });

      // Khoá effect "giỏ rỗng" TRƯỚC khi dọn giỏ
      placed.current = true;

      // Nhớ địa chỉ cho lần sau, rồi dọn giỏ
      saveProfile({
        customer_name: parsed.data.customer_name,
        customer_phone: parsed.data.customer_phone,
        building: parsed.data.building,
        address_detail: parsed.data.address_detail ?? "",
      });
      clearCart();

      // Lưu mã ngay tại đây, KHÔNG đợi trang theo dõi tải xong — nếu không,
      // chuyển thẳng về danh sách sẽ thấy trống.
      rememberOrder(result.order_code);

      // PayOS: sang trang QR trong app, không đá sang trang PayOS nữa.
      if (result.payment_method === "payos") {
        navigate(`/thanh-toan/${result.order_code}`, { replace: true });
        return;
      }

      toast.success(`Đặt hàng thành công! Mã đơn ${result.order_code}`);
      navigate("/don-hang", { replace: true });
    } catch (e) {
      setApiError(
        e instanceof ApiError ? e.message : "Đặt hàng không thành công, vui lòng thử lại.",
      );
      // Mã giảm giá có thể vừa hết lượt giữa chừng — buộc khách áp lại.
      if (e instanceof ApiError && e.code === "DISCOUNT_INVALID") setDiscount(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) return null;

  const closed = storeOpen.data === false;

  return (
    <div className="min-h-dvh bg-background pb-40 md:pb-12">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl pt-safe">
        <div className="mx-auto flex w-full max-w-content items-center gap-3 px-margin-mobile py-3 md:px-gutter">
          <Link
            to="/gio-hang"
            aria-label="Quay lại giỏ hàng"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest text-on-surface border border-outline-variant shadow-card"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </Link>
          <h1 className="text-headline-sm text-on-surface">Đặt hàng</h1>
        </div>
      </header>

      {/* Desktop: form bên trái, tóm tắt tiền và nút đặt hàng bên phải dạng sticky */}
      <div className="mx-auto w-full max-w-content px-margin-mobile pt-1 md:grid md:grid-cols-[minmax(0,1fr)_380px] md:items-start md:gap-gutter md:px-gutter">
        <div className="flex min-w-0 flex-col gap-3">
        <Card icon={<MapPin size={18} />} title="Giao đến">
          <Select
            label="Toà"
            required
            value={form.building ?? ""}
            options={BUILDINGS}
            placeholder="Chọn toà"
            error={errors.building}
            onChange={(v) => set("building", v as CheckoutForm["building"])}
          />

          <p className="flex items-start gap-1.5 text-label-sm text-on-surface-variant">
            <Info size={14} strokeWidth={2.2} aria-hidden="true" className="mt-px shrink-0" />
            <span>{DELIVERY_POINT_NOTE}</span>
          </p>

          <Field
            label="Chi tiết địa chỉ"
            placeholder="Đứng ở sảnh cạnh cầu thang bộ, mặc áo khoác xanh..."
            value={form.address_detail ?? ""}
            error={errors.address_detail}
            hint="Giúp quán tìm đúng chỗ nhanh hơn"
            maxLength={200}
            onChange={(e) => set("address_detail", e.target.value)}
          />
        </Card>

        <Card icon={<User size={18} />} title="Người nhận">
          <Field
            label="Tên"
            required
            placeholder="Nguyễn Văn A"
            value={form.customer_name}
            error={errors.customer_name}
            onChange={(e) => set("customer_name", e.target.value)}
          />
          <Field
            label="Số điện thoại"
            required
            type="tel"
            inputMode="numeric"
            placeholder="0912345678"
            maxLength={10}
            value={form.customer_phone}
            error={errors.customer_phone}
            // Khách hay gõ "0912 345 678" hoặc "0912.345.678" — lọc luôn cho đỡ báo lỗi oan
            onChange={(e) => set("customer_phone", e.target.value.replace(/\D/g, ""))}
          />
        </Card>

        <Card icon={<NotebookPen size={18} />} title="Ghi chú cho quán">
          <Field
            label="Ghi chú"
            placeholder="Gọi trước khi giao, để riêng ớt..."
            value={form.shop_note ?? ""}
            error={errors.shop_note}
            maxLength={200}
            onChange={(e) => set("shop_note", e.target.value)}
          />
        </Card>

        <Card icon={<Ticket size={18} />} title="Mã giảm giá">
          <DiscountBox
            subtotal={subtotal}
            applied={discount}
            onApplied={setDiscount}
            onCleared={() => setDiscount(null)}
          />
        </Card>

        <Card icon={<Receipt size={18} />} title="Phương thức thanh toán">
          <PaymentMethods
            value={form.payment_method}
            onChange={(v) => set("payment_method", v)}
            payosEnabled={PAYOS_ENABLED}
          />
        </Card>
        </div>

        <div className="md:sticky md:top-24">
        <section className="mt-3 flex flex-col gap-2.5 rounded-card bg-surface-container-lowest p-space-md shadow-card md:mt-0">
          <h2 className="mb-1 text-label-lg text-on-surface">Chi tiết thanh toán</h2>
          <Row label={`Tạm tính (${count} món)`} value={formatVnd(subtotal)} />
          <Row
            label="Phí giao nội khu"
            value={settings.loading ? null : shippingFee === 0 ? "Miễn phí" : formatVnd(shippingFee)}
          />
          {discount && (
            <Row
              label={`Giảm giá (${discount.code})`}
              value={`-${formatVnd(discountAmount)}`}
              accent
            />
          )}

          <div className="my-2 h-px w-full bg-surface-container-highest" />

          <div className="flex items-end justify-between gap-3">
            <span className="text-label-sm text-on-surface-variant">Tổng thanh toán</span>
            <span className="text-headline-lg font-extrabold text-primary">{formatVnd(total)}</span>
          </div>
        </section>

        {/* Mobile: ghim mép dưới. Desktop: nằm trong cột phải, bỏ fixed. */}
        <div className="fixed inset-x-0 bottom-0 z-40 px-margin-mobile pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:static md:mt-space-md md:p-0">
          <div className="mx-auto max-w-md md:max-w-none">
            {(apiError || closed) && (
              <p className="mb-2 rounded-2xl bg-error-container px-4 py-2.5 text-center text-label-sm text-on-error-container shadow-card">
                {apiError ?? closedMessage(settings.data)}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={submitting || closed}
              className="flex h-14 w-full items-center justify-between rounded-full bg-primary px-5 text-on-primary shadow-cta-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none disabled:active:scale-100"
            >
              <span className="text-label-lg font-bold">
                {submitting ? "Đang gửi đơn…" : "Đặt hàng ngay"}
              </span>
              <span className="text-headline-sm font-extrabold">{formatVnd(total)}</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-space-sm rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="text-secondary">{icon}</span>
        <h2 className="text-headline-sm text-on-surface">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-0.5 text-body-md ${
        accent ? "text-primary" : "text-on-surface-variant"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      {value === null ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        <span className={`shrink-0 text-right font-semibold ${accent ? "" : "text-on-surface"}`}>
          {value}
        </span>
      )}
    </div>
  );
}
