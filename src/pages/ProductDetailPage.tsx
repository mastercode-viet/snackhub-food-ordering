import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, NotebookPen, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import OptionGroup, { type OptionGroupData } from "@/components/product/OptionGroup";
import ToppingQuantityGroup from "@/components/product/ToppingQuantityGroup";
import SizeGroup, { isSizeGroup } from "@/components/product/SizeGroup";
import QuantityStepper from "@/components/product/QuantityStepper";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useProductDetail } from "@/hooks/useMenu";
import { discountAmountLabel, discountedPrice, formatVnd } from "@/lib/format";
import {
  computeProductPrice,
  initialSelections,
  missingRequired,
  toOptionGroups,
} from "@/lib/productOptions";
import { useCartStore } from "@/store/cart";
import { toast } from "@/store/toast";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const addItem = useCartStore((s) => s.addItem);

  const { data: product, loading, error, reload } = useProductDetail(slug);

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const groups: OptionGroupData[] = useMemo(
    () => (product ? toOptionGroups(product) : []),
    [product],
  );

  const defaultQuantities = useMemo(() => {
    const q: Record<string, number> = {};
    for (const group of groups) {
      if (group.source === "topping") {
        for (const opt of group.product_options) {
          q[opt.id] = Number(opt.default_quantity ?? 0);
        }
      }
    }
    return q;
  }, [groups]);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    () => defaultQuantities,
  );

  // `useState` chỉ lấy giá trị khởi tạo ở lần render đầu, mà lúc đó sản phẩm
  // chưa tải xong nên `groups` còn rỗng. Phải đồng bộ lại khi nhóm topping
  // xuất hiện; nếu không, topping có `default_quantity` bị coi là 0 và rơi
  // khỏi đơn dù quán đã đặt mặc định chọn sẵn.
  const seededProductId = useRef<string | null>(null);
  useEffect(() => {
    if (!product || seededProductId.current === product.id) return;
    seededProductId.current = product.id;
    const next: Record<string, number> = {};
    for (const group of groups) {
      if (group.source !== "topping") continue;
      for (const opt of group.product_options) {
        next[opt.id] = Number(opt.default_quantity ?? 0);
      }
    }
    // Chỉ seed MỘT lần cho mỗi sản phẩm: dữ liệu tự làm mới không được xoá
    // số lượng topping khách đang chọn dở.
    setQuantities(next);
  }, [product, groups]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const initialised = useMemo(() => initialSelections(groups), [groups]);

  const effective: Record<string, string[]> = { ...initialised, ...selections };

  // Chỉ tính giá khi product đã có dữ liệu — nếu đang loading hoặc error đã trả về EmptyState/ErrorState ở trên rồi.
  const { unitBase, optionsPrice, unitPrice, chosen } = product
    ? computeProductPrice({ product, groups, selected: effective, quantities })
    : { unitBase: discountedPrice(0, "percent", 0), optionsPrice: 0, unitPrice: 0, chosen: [] };

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

  // Computing total and savings here is safe because we've already returned early
  // if loading, error, or !product (lines 69, 71, 79). At this point product is guaranteed truthy.
  const total = unitPrice * quantity;
  const savings = product?.base_price != null ? product.base_price - unitBase : 0;

  const missingGroups = missingRequired(groups, effective);
  const canAdd = product.is_available && missingGroups.length === 0;

  function handleAdd() {
    setTouched(true);
    if (!canAdd || !product) return;

    addItem({
      kind: "product",
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.image_url,
      categoryId: product.category_id,
      categoryIcon: product.categories?.icon ?? null,
      basePrice: product.base_price,
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
              imgClassName="object-contain"
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

          {product.discount_value > 0 && product.is_available && (
            <span className="absolute bottom-6 left-margin-mobile rounded-full bg-primary px-3.5 py-1 text-label-md font-black text-on-primary shadow-badge">
              Giảm {discountAmountLabel(product.discount_type, product.discount_value)}
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

          {groups.map((group) =>
            isSizeGroup(group) ? (
              <SizeGroup
                key={group.id}
                group={group}
                selected={effective[group.id]}
                quantities={quantities}
                onSelect={(optionId) => {
                  setSelections((prev) => ({
                    ...prev,
                    [group.id]: optionId ? [optionId] : [],
                  }));
                  setQuantities((prev) => {
                    const next = { ...prev };
                    for (const opt of group.product_options) {
                      next[opt.id] = opt.id === optionId ? 1 : 0;
                    }
                    return next;
                  });
                }}
              />
            ) : group.source === "topping" ? (
              <ToppingQuantityGroup
                key={group.id}
                group={group}
                quantities={quantities}
                onChange={(optionId, qty) => {
                  setQuantities((prev) => ({ ...prev, [optionId]: qty }));
                  setSelections((prev) => {
                    const cur = prev[group.id] ?? [];
                    if (qty > 0 && !cur.includes(optionId)) {
                      return { ...prev, [group.id]: [...cur, optionId] };
                    }
                    if (qty === 0) {
                      return { ...prev, [group.id]: cur.filter((id) => id !== optionId) };
                    }
                    return prev;
                  });
                }}
              />
            ) : (
              <OptionGroup
                key={group.id}
                group={group}
                selected={effective[group.id] ?? []}
                onChange={(ids) => setSelections((prev) => ({ ...prev, [group.id]: ids }))}
              />
            ),
          )}

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
