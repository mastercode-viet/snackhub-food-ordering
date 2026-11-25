import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import OptionGroup, { type OptionGroupData } from "@/components/product/OptionGroup";
import ToppingQuantityGroup from "@/components/product/ToppingQuantityGroup";
import QuantityStepper from "@/components/product/QuantityStepper";
import { Skeleton } from "@/components/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { formatVnd } from "@/lib/format";
import { fetchProductBySlug } from "@/lib/queries";
import {
  computeProductPrice,
  initialSelections,
  missingRequired,
  toOptionGroups,
} from "@/lib/productOptions";
import { useCartStore } from "@/store/cart";
import { toast } from "@/store/toast";

/**
 * Chọn biến thể / kích thước / topping rồi thêm vào giỏ — dùng cho nút "Nhanh
 * thêm" trên lưới món trang chủ (và thẻ món lưới). Tính toán giá dùng chung
 * `computeProductPrice` với trang chi tiết, không tính giá lại ở thành phần này.
 *
 * Mobile: trượt lên từ mép dưới. Từ md trở lên: hộp thoại giữa màn.
 */
export default function ProductOptionSheet({
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
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [productQuantity, setProductQuantity] = useState(1);
  const [touched, setTouched] = useState(false);

  // Không return sớm ở đây: phía dưới còn nhiều hook, return trước hook sẽ gây
  // "Rendered fewer hooks than expected". Chờ hết hook rồi mới chốt.
  const groups: OptionGroupData[] = useMemo(
    () => (product ? toOptionGroups(product) : []),
    [product],
  );
  const initialised = useMemo(() => initialSelections(groups), [groups]);
  const effective: Record<string, string[]> = { ...initialised, ...selections };

  // Số lượng mặc định của từng topping (tuỳ chọn mặc định = 0).
  // Chỉ seed MỘT lần cho mỗi sản phẩm: dữ liệu tự làm mới không được xoá số
  // lượng topping khách đang chọn dở.
  const seededProductId = useRef<string | null>(null);
  useEffect(() => {
    if (!product || seededProductId.current === product.id) return;
    seededProductId.current = product.id;
    const q: Record<string, number> = {};
    for (const group of groups) {
      if (group.source === "topping") {
        for (const opt of group.product_options) {
          q[opt.id] = Number(opt.default_quantity ?? 0);
        }
      }
    }
    setQuantities(q);
  }, [product, groups]);

  // Chỉ tính giá khi product đã load xong — nếu chưa load thì loading state
  // đã render ra Skeleton/placeholder, không nên tính giá ở đây.
  const { unitBase, optionsPrice, unitPrice, chosen } = useMemo(
    () => (product ? computeProductPrice({ product, groups, selected: effective, quantities }) : { unitBase: 0, optionsPrice: 0, unitPrice: 0, chosen: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product, groups, initialised, selections, quantities],
  );
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
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

  const missing = missingRequired(groups, effective);
  const canAdd = Boolean(product?.is_available) && missing.length === 0;
  const lineTotal = unitPrice * productQuantity;

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
      quantity: productQuantity,
      note: null,
    });

    toast.success(`Đã thêm ${productQuantity} ${product.name} vào giỏ`);
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
                <h2 className="truncate text-headline-sm text-on-surface">
                  {product!.name}
                </h2>
                <p className="text-label-sm text-on-surface-variant">
                  Chọn biến thể/kích thước và topping rồi bỏ vào giỏ
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
              {groups.map((group) =>
                group.source === "topping" ? (
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
                    onChange={(ids) =>
                      setSelections((prev) => ({ ...prev, [group.id]: ids }))
                    }
                  />
                ),
              )}
            </div>
          )}

          {touched && missing.length > 0 && (
            <p className="mt-3 rounded-card bg-error-container px-4 py-3 text-label-md text-on-error-container">
              Vui lòng chọn: {missing.map((g) => g.name).join(", ")}.
            </p>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-outline-variant px-5 py-4 pb-safe mb-10">
          <QuantityStepper value={productQuantity} onChange={setProductQuantity} />

          <button
            type="button"
            onClick={handleAdd}
            disabled={loading || !canAdd}
            data-guide="sheet-add"
            className="guide-pulse flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-inverse-surface px-5 text-label-lg text-inverse-on-surface shadow-cta transition-transform active:scale-95 disabled:opacity-50"
          >
            <span>Thêm vào giỏ</span>
            {!loading && <span className="font-bold">{formatVnd(lineTotal)}</span>}
          </button>
        </footer>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
