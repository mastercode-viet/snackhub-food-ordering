import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import OptionGroup from "@/components/product/OptionGroup";
import QuantityStepper from "@/components/product/QuantityStepper";
import { Skeleton } from "@/components/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { discountedPrice, formatVnd } from "@/lib/format";
import { fetchProductBySlug } from "@/lib/queries";
import {
  chosenOptions,
  initialSelections,
  missingRequired,
  toOptionGroups,
} from "@/lib/productOptions";
import { useCartStore } from "@/store/cart";
import { toast } from "@/store/toast";

/**
 * Chọn nhanh topping ngay từ lưới món, khỏi phải mở trang chi tiết.
 *
 * Mobile: trượt lên từ mép dưới. Từ md trở lên: hộp thoại giữa màn.
 * Lưới món chỉ có dữ liệu sản phẩm cơ bản nên nhóm option/topping được tải
 * khi mở sheet — trong lúc chờ hiện skeleton, không dùng spinner.
 */
export default function ToppingSheet({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: product, loading } = useAsync(() => fetchProductBySlug(slug), [slug]);

  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [touched, setTouched] = useState(false);

  const groups = useMemo(() => (product ? toOptionGroups(product) : []), [product]);
  const initialised = useMemo(() => initialSelections(groups), [groups]);
  const effective = { ...initialised, ...selections };

  const chosen = useMemo(
    () => chosenOptions(groups, effective),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, JSON.stringify(effective)],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    // Khoá cuộn nền để sheet không kéo theo trang phía sau.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, [loading]);

  if (!product && !loading) return null;

  const unitBase = product
    ? discountedPrice(product.base_price, product.discount_type, product.discount_value)
    : 0;
  const optionsPrice = chosen.reduce((s, o) => s + o.priceDelta, 0);
  const unitPrice = Math.max(0, unitBase + optionsPrice);
  const missing = missingRequired(groups, effective);
  const canAdd = Boolean(product?.is_available) && missing.length === 0;

  function handleAdd() {
    setTouched(true);
    if (!product || !canAdd) return;

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
      note: null,
    });

    toast.success(`Đã thêm ${quantity} ${product.name} vào giỏ`);
    onClose();
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-on-surface/40 backdrop-blur-sm"
      />

      <motion.div
        key="panel"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={product ? `Tuỳ chọn cho ${product.name}` : "Đang tải tuỳ chọn"}
        initial={{ y: "100%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="fixed inset-x-0 bottom-0 z-[71] flex max-h-[88dvh] flex-col rounded-t-sheet bg-surface-container-lowest shadow-sheet focus:outline-none md:inset-0 md:m-auto md:h-fit md:max-w-lg md:rounded-sheet"
      >
        <header className="flex items-start gap-3 border-b border-outline-variant px-5 py-4">
          <div className="min-w-0 flex-1">
            {loading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <>
                <h2 className="truncate text-headline-sm text-on-surface">{product!.name}</h2>
                <p className="text-label-sm text-on-surface-variant">
                  Chọn thêm topping rồi bỏ vào giỏ
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-outline-variant text-on-surface transition-colors hover:bg-surface-container"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full rounded-card" />
              <Skeleton className="h-24 w-full rounded-card" />
            </div>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-body-md text-on-surface-variant">
              Món này không có tuỳ chọn thêm.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((group) => (
                <OptionGroup
                  key={group.id}
                  group={group}
                  selected={effective[group.id] ?? []}
                  onChange={(ids) => setSelections((prev) => ({ ...prev, [group.id]: ids }))}
                />
              ))}
            </div>
          )}

          {touched && missing.length > 0 && (
            <p className="mt-3 rounded-card bg-error-container px-4 py-3 text-label-md text-on-error-container">
              Vui lòng chọn: {missing.map((g) => g.name).join(", ")}.
            </p>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-outline-variant px-5 py-4 pb-safe mb-10">
          <QuantityStepper value={quantity} onChange={setQuantity} />

          <button
            type="button"
            onClick={handleAdd}
            disabled={loading}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-inverse-surface px-5 text-label-lg text-inverse-on-surface shadow-cta transition-transform active:scale-95 disabled:opacity-50"
          >
            <span>Thêm vào giỏ</span>
            {!loading && <span className="font-bold">{formatVnd(unitPrice * quantity)}</span>}
          </button>
        </footer>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
