import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, NotebookPen, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import OptionGroup from "@/components/product/OptionGroup";
import QuantityStepper from "@/components/product/QuantityStepper";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useProductDetail } from "@/hooks/useMenu";
import { discountedPrice, formatVnd } from "@/lib/format";
import { useCartStore, type CartOption } from "@/store/cart";
import { toast } from "@/store/toast";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const addItem = useCartStore((s) => s.addItem);

  const { data: product, loading, error, reload } = useProductDetail(slug);

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const initialised = useMemo(() => {
    if (!product) return null;
    const initial: Record<string, string[]> = {};
    for (const group of product.product_option_groups) {
      if (group.is_required && group.max_select === 1) {
        const first = group.product_options.find((o) => o.is_available);
        if (first) initial[group.id] = [first.id];
      }
    }
    return initial;
  }, [product]);

  const effective: Record<string, string[]> = { ...(initialised ?? {}), ...selections };

  const chosen: CartOption[] = useMemo(() => {
    if (!product) return [];
    const result: CartOption[] = [];
    for (const group of product.product_option_groups) {
      for (const id of effective[group.id] ?? []) {
        const opt = group.product_options.find((o) => o.id === id);
        if (opt) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceDelta: Number(opt.price_delta),
          });
        }
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, JSON.stringify(effective)]);

  function goBack() {
    if (location.key !== "default") navigate(-1);
    else navigate("/thuc-don");
  }

  if (loading) return <DetailSkeleton onBack={goBack} />;

  if (error) {
    return (
      <Shell onBack={goBack} title="Chi tiết món">
        <ErrorState onRetry={reload} />
      </Shell>
    );
  }

  if (!product) {
    return (
      <Shell onBack={goBack} title="Chi tiết món">
        <EmptyState
          icon="🤔"
          title="Không tìm thấy món này"
          description="Có thể món đã được gỡ khỏi thực đơn."
        />
      </Shell>
    );
  }

  const unitBase = discountedPrice(product.base_price, product.discount_percent);
  const optionsPrice = chosen.reduce((s, o) => s + o.priceDelta, 0);
  const unitPrice = Math.max(0, unitBase + optionsPrice);
  const total = unitPrice * quantity;
  const savings = product.base_price - unitBase;

  const missingGroups = product.product_option_groups.filter(
    (g) => g.is_required && (effective[g.id]?.length ?? 0) < Math.max(1, g.min_select),
  );
  const canAdd = product.is_available && missingGroups.length === 0;

  function handleAdd() {
    setTouched(true);
    if (!canAdd || !product) return;

    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image_url,
      categoryId: product.category_id,
      categoryIcon: product.categories?.icon ?? null,
      basePrice: product.base_price,
      discountPercent: product.discount_percent,
      unitBase,
      options: chosen,
      optionsPrice,
      unitPrice,
      quantity,
      note: note.trim() || null,
    });

    toast.success(`Đã thêm ${quantity} ${product.name} vào giỏ`);
    goBack();
  }

  return (
    <div className="min-h-dvh bg-background pb-36 md:pb-12 pt-safe">
      <div className="mx-auto w-full max-w-content md:grid md:grid-cols-2 md:items-start md:gap-gutter md:px-gutter md:pt-8">
        <div className="relative md:sticky md:top-8">
          <div className="overflow-hidden rounded-b-sheet bg-surface-container md:rounded-sheet shadow-card">
            <ProductImage
              src={product.image_url}
              alt={product.name}
              fallbackIcon={product.categories?.icon}
              className={`h-72 w-full md:h-[26rem] ${product.is_available ? "" : "grayscale"}`}
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

          {product.discount_percent > 0 && product.is_available && (
            <span className="absolute bottom-6 left-margin-mobile rounded-full bg-primary px-3.5 py-1 text-label-md font-black text-on-primary shadow-badge">
              Giảm {product.discount_percent}%
            </span>
          )}
        </div>

        <div className="relative -mt-6 flex flex-col gap-4 px-margin-mobile md:mt-0 md:px-0">
          <section className="rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
            {product.categories && (
              <p className="text-label-sm uppercase tracking-wider font-bold text-secondary">
                {product.categories.icon} {product.categories.name}
              </p>
            )}

            <div className="mt-1.5 flex items-start justify-between gap-4">
              <h1 className="min-w-0 flex-1 text-headline-lg font-bold leading-tight tracking-tight text-on-surface">
                {product.name}
              </h1>

              <div className="flex shrink-0 flex-col items-end">
                <span className="text-label-xs uppercase tracking-wider text-on-surface-variant/80">Giá</span>
                <span className="text-headline-lg font-extrabold leading-tight text-primary">
                  {formatVnd(unitBase)}
                </span>
              </div>
            </div>

            {savings > 0 && (
              <div className="mt-space-sm flex flex-wrap items-center gap-2">
                <span className="text-body-md text-on-surface-variant line-through">
                  {formatVnd(product.base_price)}
                </span>
                <span className="rounded-full bg-secondary-fixed px-3 py-0.5 text-label-sm font-bold text-on-secondary-fixed">
                  Tiết kiệm {formatVnd(savings)}
                </span>
              </div>
            )}

            {product.description && (
              <p className="pt-3 text-body-md leading-relaxed text-on-surface-variant">
                {product.description}
              </p>
            )}

            {!product.is_available && (
              <p className="mt-4 rounded-card bg-error-container px-4 py-3 text-label-md font-bold text-on-error-container">
                Món này đang tạm hết hàng. Bạn quay lại sau nhé!
              </p>
            )}
          </section>

          {product.product_option_groups.map((group) => (
            <OptionGroup
              key={group.id}
              group={group}
              selected={effective[group.id] ?? []}
              onChange={(ids) => setSelections((prev) => ({ ...prev, [group.id]: ids }))}
            />
          ))}

          <section className="flex flex-col gap-space-sm rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
            <div className="flex items-center gap-2">
              <NotebookPen size={18} className="text-secondary" strokeWidth={2.4} />
              <h2 className="text-headline-sm font-bold text-on-surface">Ghi chú cho quán</h2>
            </div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Ví dụ: để riêng ớt, lấy thêm muỗng nĩa..."
              className="w-full rounded-card bg-surface-container-low/70 px-4 py-3 text-body-md text-on-surface transition-all placeholder:text-on-surface-variant/50 focus:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </section>

          {/* Sticky add to cart bar */}
          <div className="fixed inset-x-0 bottom-0 z-40 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:static md:p-0">
            <div className="mx-auto max-w-md md:max-w-none">
              <AnimatePresence>
                {touched && missingGroups.length > 0 && (
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    className="mb-2 rounded-full bg-error-container px-4 py-2 text-center text-label-sm font-bold text-on-error-container shadow-card"
                  >
                    Vui lòng chọn {missingGroups.map((g) => g.name).join(", ")}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between gap-3 rounded-sheet glass-nav p-3 shadow-sheet border border-white/60 md:bg-surface-container-lowest md:backdrop-blur-none">
                <QuantityStepper value={quantity} onChange={setQuantity} />

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={handleAdd}
                  disabled={!product.is_available}
                  className="flex h-12 flex-1 items-center justify-between rounded-full bg-inverse-surface px-5 text-label-lg font-bold text-inverse-on-surface shadow-cta transition-all disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <ShoppingBag size={19} strokeWidth={2.4} />
                    {product.is_available ? "Thêm giỏ hàng" : "Tạm hết hàng"}
                  </span>
                  {product.is_available && (
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
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
