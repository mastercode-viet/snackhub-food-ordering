import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import QuantityStepper from "@/components/product/QuantityStepper";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useComboDetail } from "@/hooks/useMenu";
import { formatVnd } from "@/lib/format";
import { comboToCartItem, useCartStore } from "@/store/cart";
import { toast } from "@/store/toast";

export default function ComboDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const addItem = useCartStore((s) => s.addItem);

  const { data: combo, loading, error, reload } = useComboDetail(slug);

  const [quantity, setQuantity] = useState(1);

  function goBack() {
    if (location.key !== "default") navigate(-1);
    else navigate("/");
  }

  if (loading) return <DetailSkeleton onBack={goBack} />;

  if (error) {
    return (
      <Shell onBack={goBack} title="Chi tiết combo">
        <ErrorState onRetry={reload} />
      </Shell>
    );
  }

  if (!combo) {
    return (
      <Shell onBack={goBack} title="Chi tiết combo">
        <EmptyState
          icon="🍱"
          title="Không tìm thấy combo này"
          description="Có thể combo đã được gỡ khỏi thực đơn."
        />
      </Shell>
    );
  }

  const items = combo.combo_items
    .filter((i): i is typeof i & { products: NonNullable<(typeof combo.combo_items)[number]["products"]> } =>
      Boolean(i.products),
    )
    .sort((a, b) => a.products.name.localeCompare(b.products.name));

  const itemsWorth = items.reduce((sum, i) => sum + i.products.base_price * i.quantity, 0);
  const savings = itemsWorth - Number(combo.price);
  const total = Number(combo.price) * quantity;

  function handleAdd() {
    if (!combo || !combo.is_available) return;
    addItem(comboToCartItem(combo, quantity));
    toast.success(`Đã thêm ${quantity} "${combo.name}" vào giỏ`);
    goBack();
  }

  return (
    <div className="min-h-dvh bg-background pb-36 md:pb-12 pt-safe">
      <div className="mx-auto w-full max-w-content md:grid md:grid-cols-2 md:items-start md:gap-gutter md:px-gutter md:pt-8">
        <div className="relative md:sticky md:top-8">
          <div className="overflow-hidden rounded-b-sheet bg-surface-container md:rounded-sheet shadow-card">
            <ProductImage
              src={combo.image_url}
              alt={combo.name}
              fallbackIcon="🍱"
              className={`h-72 w-full md:h-[26rem] ${combo.is_available ? "" : "grayscale"}`}
            />
          </div>

          <div className="absolute inset-x-0 top-0 flex items-center px-margin-mobile pt-safe">
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={goBack}
              aria-label="Quay lại"
              className="mt-3 grid size-10 place-items-center rounded-full bg-surface-container-lowest/90 text-on-surface border border-outline-variant shadow-card backdrop-blur-md"
            >
              <ArrowLeft size={20} strokeWidth={2.4} />
            </motion.button>
          </div>

          {savings > 0 && combo.is_available && (
            <span className="absolute bottom-6 left-margin-mobile rounded-full bg-primary px-3.5 py-1 text-label-md font-black text-on-primary shadow-badge">
              Tiết kiệm {formatVnd(savings)}
            </span>
          )}
        </div>

        <div className="relative -mt-6 flex flex-col gap-4 px-margin-mobile md:mt-0 md:px-0">
          <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
            <p className="text-label-sm uppercase tracking-wider font-bold text-secondary">🍱 Combo</p>

            <div className="mt-1.5 flex items-start justify-between gap-4">
              <h1 className="min-w-0 flex-1 text-headline-lg font-bold leading-tight tracking-tight text-on-surface">
                {combo.name}
              </h1>

              <div className="flex shrink-0 flex-col items-end">
                <span className="text-label-xs uppercase tracking-wider text-on-surface-variant/80">Giá</span>
                <span className="text-headline-lg font-extrabold leading-tight text-primary">
                  {formatVnd(Number(combo.price))}
                </span>
              </div>
            </div>

            {savings > 0 && (
              <div className="mt-space-sm flex flex-wrap items-center gap-2">
                <span className="text-body-md text-on-surface-variant line-through">
                  {formatVnd(itemsWorth)}
                </span>
                <span className="rounded-full bg-secondary-fixed px-3 py-0.5 text-label-sm font-bold text-on-secondary-fixed">
                  Tiết kiệm {formatVnd(savings)}
                </span>
              </div>
            )}

            {combo.description && (
              <p className="pt-3 text-body-md leading-relaxed text-on-surface-variant">
                {combo.description}
              </p>
            )}

            {!combo.is_available && (
              <p className="mt-4 rounded-card bg-error-container px-4 py-3 text-label-md font-bold text-on-error-container">
                Combo này đang tạm hết hàng. Bạn quay lại sau nhé!
              </p>
            )}
          </section>

          <section className="flex flex-col gap-space-sm rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
            <h2 className="text-headline-sm font-bold text-on-surface">Gồm những món</h2>

            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.products.id} className="flex items-center gap-3">
                  <ProductImage
                    src={item.products.image_url}
                    alt={item.products.name}
                    className="size-12 shrink-0 rounded-card-sm"
                  />
                  <p className="min-w-0 flex-1 text-body-md font-semibold text-on-surface">
                    {item.products.name}
                    {item.quantity > 1 && (
                      <span className="text-on-surface-variant"> x{item.quantity}</span>
                    )}
                  </p>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">
                    {formatVnd(item.products.base_price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Sticky add to cart bar */}
          <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:static md:p-0">
            <div className="mx-auto max-w-md md:max-w-none">
              <div className="flex items-center justify-between gap-3 rounded-sheet glass-nav p-3 shadow-sheet border border-white/60 md:bg-surface-container-lowest md:backdrop-blur-none">
                <QuantityStepper value={quantity} onChange={setQuantity} />

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={handleAdd}
                  disabled={!combo.is_available}
                  className="flex h-12 flex-1 items-center justify-between rounded-full bg-inverse-surface px-5 text-label-lg font-bold text-inverse-on-surface shadow-cta transition-all disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <ShoppingBag size={19} strokeWidth={2.4} />
                    {combo.is_available ? "Thêm giỏ hàng" : "Tạm hết hàng"}
                  </span>
                  {combo.is_available && (
                    <span className="font-extrabold tracking-wide text-primary-fixed">{formatVnd(total)}</span>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({
  onBack,
  title,
  children,
}: {
  onBack: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background px-margin-mobile pt-safe">
      <div className="flex items-center gap-3 py-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Quay lại"
          className="grid size-10 place-items-center rounded-full bg-surface-container-lowest text-on-surface border border-outline-variant shadow-card"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <h1 className="text-headline-sm font-bold text-on-surface">{title}</h1>
      </div>
      {children}
    </div>
  );
}

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-dvh bg-background pb-36">
      <div className="relative">
        <Skeleton className="h-72 w-full rounded-b-sheet" />
        <div className="absolute inset-x-0 top-0 px-margin-mobile pt-safe">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quay lại"
            className="mt-3 grid size-10 place-items-center rounded-full bg-surface-container-lowest/90 text-on-surface border border-outline-variant shadow-card backdrop-blur-md"
          >
            <ArrowLeft size={20} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="-mt-6 flex flex-col gap-3 px-margin-mobile">
        <div className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-3/4" />
          <Skeleton className="mt-3 h-9 w-32" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
        </div>
        <div className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-12 w-full rounded-card-sm" />
            <Skeleton className="h-12 w-full rounded-card-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
