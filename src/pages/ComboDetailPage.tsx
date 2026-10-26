import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import OptionGroup from "@/components/product/OptionGroup";
import QuantityStepper from "@/components/product/QuantityStepper";
import { Skeleton } from "@/components/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useComboDetail } from "@/hooks/useMenu";
import { formatVnd } from "@/lib/format";
import {
  chosenOptions,
  initialSelections,
  missingRequired,
  toOptionGroups,
} from "@/lib/productOptions";
import { fetchProductById, fetchProductsByIds, type ProductDetail, type ComboChoiceGroup } from "@/lib/queries";
import { comboToCartItem, useCartStore, type ComboComponentSelection, type ComboChoiceSelection } from "@/store/cart";
import { toast } from "@/store/toast";

export default function ComboDetailPage({ slug: propSlug, onClose }: { slug?: string; onClose?: () => void } = {}) {
  const params = useParams();
  const slug = propSlug ?? params.slug;
  const navigate = useNavigate();
  const location = useLocation();
  const addItem = useCartStore((s) => s.addItem);

  const { data: combo, loading, error, reload } = useComboDetail(slug);

  const [quantity, setQuantity] = useState(1);
  const [productDetails, setProductDetails] = useState<Record<string, ProductDetail | null>>({});
  const [selections, setSelections] = useState<Record<string, Record<string, string[]>>>({});
  const [choiceSelections, setChoiceSelections] = useState<Record<string, string[]>>({});
  const [choiceProductDetails, setChoiceProductDetails] = useState<Record<string, ProductDetail | null>>({});
  const [choiceProductNames, setChoiceProductNames] = useState<Record<string, string>>({});
  const [choiceOptionSelections, setChoiceOptionSelections] = useState<Record<string, Record<string, string[]>>>({});

  const choiceGroups: ComboChoiceGroup[] = useMemo(
    () => (Array.isArray(combo?.choice_groups) ? (combo.choice_groups as ComboChoiceGroup[]) : []),
    [combo],
  );

  useEffect(() => {
    if (!combo) return;
    const ids = choiceGroups.flatMap((g) => g.items.map((it) => it.product_id));
    const missing = ids.filter((id) => !(id in choiceProductDetails));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => fetchProductById(id).then((d) => [id, d] as const))).then((results) => {
      if (cancelled) return;
      setChoiceProductDetails((prev) => {
        const next = { ...prev };
        for (const [id, d] of results) next[id] = d;
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [combo, choiceGroups, choiceProductDetails]);
  useEffect(() => {
    if (!combo) return;
    const ids = choiceGroups.flatMap((g) => g.items.map((it) => it.product_id));
    const missing = ids.filter((id) => !(id in choiceProductNames));
    if (missing.length === 0) return;
    let cancelled = false;
    fetchProductsByIds(missing).then((products) => {
      if (cancelled) return;
      setChoiceProductNames((prev) => {
        const next = { ...prev };
        for (const p of products) next[p.id] = p.name;
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [combo, choiceGroups, choiceProductNames]);

  useEffect(() => {
    const selectedIds = [...new Set(Object.values(choiceSelections).flat())];
    const missing = selectedIds.filter((id) => !(id in choiceProductDetails));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => fetchProductById(id).then((d) => [id, d] as const))).then((results) => {
      if (cancelled) return;
  // Tải chi tiết (tên + topping) cho mọi món trong lựa chọn thêm, để hiển thị đúng tên.
  useEffect(() => {
    if (!combo) return;
    const ids = choiceGroups.flatMap((g) => g.items.map((it) => it.product_id));
    const missing = ids.filter((id) => !(id in choiceProductDetails));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => fetchProductById(id).then((d) => [id, d] as const))).then((results) => {
      if (cancelled) return;
      setChoiceProductDetails((prev) => {
        const next = { ...prev };
        for (const [id, d] of results) next[id] = d;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [combo, choiceGroups, choiceProductDetails]);
      setChoiceProductDetails((prev) => {
        const next = { ...prev };
        for (const [id, d] of results) next[id] = d;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [choiceSelections, choiceProductDetails]);

  useEffect(() => {
    setChoiceOptionSelections((prev) => {
      const next = { ...prev };
      for (const pid of Object.keys(choiceProductDetails)) {
        const pd = choiceProductDetails[pid];
        if (pd && !next[pid]) {
          next[pid] = initialSelections(toOptionGroups(pd));
        }
      }
      return next;
    });
  }, [choiceProductDetails]);

  useEffect(() => {
    if (!combo) return;
    const ids = combo.combo_items
      .map((i) => i.products?.id)
      .filter((id): id is string => Boolean(id));
    let cancelled = false;
    Promise.all(ids.map((id) => fetchProductById(id).then((d) => [id, d] as const))).then((results) => {
      if (cancelled) return;
      const map: Record<string, ProductDetail | null> = {};
      for (const [id, d] of results) map[id] = d;
      setProductDetails(map);
    });
    return () => {
      cancelled = true;
    };
  }, [combo]);

  useEffect(() => {
    setSelections((prev) => {
      const next = { ...prev };
      for (const [pid, pd] of Object.entries(productDetails)) {
        if (pd && !next[pid]) {
          next[pid] = initialSelections(toOptionGroups(pd));
        }
      }
      return next;
    });
  }, [productDetails]);

  const items = useMemo(
    () =>
      (combo?.combo_items ?? [])
        .filter((i): i is typeof i & { products: NonNullable<typeof i.products> } => Boolean(i.products))
        .sort((a, b) => a.products.name.localeCompare(b.products.name)),
    [combo],
  );

  const itemsWorth = items.reduce((sum, i) => sum + i.products.base_price * i.quantity, 0);
  const savings = itemsWorth - Number(combo?.price ?? 0);

  const optionsTotal = useMemo(() => {
    if (!combo) return 0;
    let total = items.reduce((sum, ci) => {
      const pid = ci.products.id;
      const pd = productDetails[pid];
      if (!pd) return sum;
      const groups = toOptionGroups(pd);
      const eff = { ...initialSelections(groups), ...(selections[pid] ?? {}) };
      const chosen = chosenOptions(groups, eff);
      return sum + chosen.reduce((s, o) => s + o.priceDelta, 0) * ci.quantity;
    }, 0);
    // choice groups surcharges
    for (const pid of Object.values(choiceSelections).flat()) {
      const pd = choiceProductDetails[pid];
      if (!pd) continue;
      const groupItemQuantity = choiceGroups
        .flatMap((g) => g.items)
        .find((it) => it.product_id === pid)?.quantity ?? 1;
      const groups = toOptionGroups(pd);
      const eff = { ...initialSelections(groups), ...(choiceOptionSelections[pid] ?? {}) };
      const chosen = chosenOptions(groups, eff);
      total += chosen.reduce((s, o) => s + o.priceDelta, 0) * groupItemQuantity;
    }
    return total;
  }, [combo, items, productDetails, selections, choiceSelections, choiceProductDetails, choiceOptionSelections, choiceGroups]);

  const unitPrice = Number(combo?.price ?? 0) + optionsTotal;
  const total = unitPrice * quantity;

  const missingCount = useMemo(() => {
    let n = 0;
    for (const ci of items) {
      const pid = ci.products.id;
      const pd = productDetails[pid];
      if (!pd) continue;
      const groups = toOptionGroups(pd);
      const eff = { ...initialSelections(groups), ...(selections[pid] ?? {}) };
      if (missingRequired(groups, eff).length > 0) n += 1;
    }
    // Nhóm lựa chọn: chưa đủ min
    for (const g of choiceGroups) {
      const min = Math.max(0, Number(g.min_select) || 0);
      if ((choiceSelections[g.id]?.length ?? 0) < min) n += 1;
    }
    // Topping bắt buộc của món đã chọn
    for (const pid of Object.values(choiceSelections).flat()) {
      const pd = choiceProductDetails[pid];
      if (!pd) continue;
      const groups = toOptionGroups(pd);
      const eff = { ...initialSelections(groups), ...(choiceOptionSelections[pid] ?? {}) };
      if (missingRequired(groups, eff).length > 0) n += 1;
    }
    return n;
  }, [items, productDetails, selections, choiceGroups, choiceSelections, choiceProductDetails, choiceOptionSelections]);

  const allComponentsAvailable =
    items.every((ci) => {
      const pd = productDetails[ci.products.id];
      return !pd || pd.is_available;
    }) &&
    Object.values(choiceSelections)
      .flat()
      .every((pid) => {
        const pd = choiceProductDetails[pid];
        return !pd || pd.is_available;
      });

  const canAdd = Boolean(combo?.is_available) && allComponentsAvailable && missingCount === 0;

  function handleAdd() {
    if (!combo || !combo.is_available || !canAdd) return;
    const components: ComboComponentSelection[] = items.map((ci) => {
      const pid = ci.products.id;
      const pd = productDetails[pid];
      const groups = pd ? toOptionGroups(pd) : [];
      const eff = pd ? { ...initialSelections(groups), ...(selections[pid] ?? {}) } : {};
      const chosen = pd ? chosenOptions(groups, eff) : [];
      return {
        productId: pid,
        productName: ci.products.name,
        componentQuantity: ci.quantity,
        options: chosen,
        optionsPrice: chosen.reduce((s, o) => s + o.priceDelta, 0) * ci.quantity,
      };
    });

    const choices: ComboChoiceSelection[] = choiceGroups.flatMap((g) =>
      (choiceSelections[g.id] ?? []).map((pid) => {
        const pd = choiceProductDetails[pid];
        const groupItem = g.items.find((it) => it.product_id === pid);
        const qty = groupItem?.quantity ?? 1;
        const groups = pd ? toOptionGroups(pd) : [];
        const eff = pd ? { ...initialSelections(groups), ...(choiceOptionSelections[pid] ?? {}) } : {};
        const chosen = pd ? chosenOptions(groups, eff) : [];
        return {
          groupId: g.id,
          groupName: g.name,
          productId: pid,
          productName: pd?.name ?? pid,
          componentQuantity: qty,
          options: chosen,
          optionsPrice: chosen.reduce((s, o) => s + o.priceDelta, 0) * qty,
        };
      }),
    );

    addItem(comboToCartItem(combo, quantity, components, choices));
    toast.success(`Đã thêm ${quantity} "${combo.name}" vào giỏ`);
    goBack();
  }

  function goBack() {
    if (onClose) {
      onClose();
      return;
    }
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
              {items.map((item) => {
                const pid = item.products.id;
                const pd = productDetails[pid];
                const groups = pd ? toOptionGroups(pd) : [];
                const eff = pd ? { ...initialSelections(groups), ...(selections[pid] ?? {}) } : {};
                return (
                  <li key={pid} className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
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
                    </div>
                    {groups.length > 0 && (
                      <div className="flex flex-col gap-3 pl-0">
                        {groups.map((g) => (
                          <OptionGroup
                            key={g.id}
                            group={g}
                            selected={eff[g.id] ?? []}
                            onChange={(ids) =>
                              setSelections((prev) => ({
                                ...prev,
                                [pid]: { ...(prev[pid] ?? {}), [g.id]: ids },
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {choiceGroups.length > 0 && (
            <section className="flex flex-col gap-space-sm rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
              <h2 className="text-headline-sm font-bold text-on-surface">Chọn món trong combo</h2>
              {choiceGroups.map((group) => {
                const min = Math.max(0, Number(group.min_select) || 0);
                const max = Math.max(min || 1, Number(group.max_select) || 1);
                return (
                  <div key={group.id} className="flex flex-col gap-2">
                    <p className="text-label-sm font-bold text-on-surface">
                      {group.name}{" "}
                      <span className="text-on-surface-variant">
                        (chọn {min === max ? min : `${min}–${max}`})
                      </span>
                    </p>
                    <div className="flex flex-col gap-2">
                      {group.items.map((it) => {
                        const pd = choiceProductDetails[it.product_id];
                        const productName = it.product_name ?? choiceProductNames[it.product_id] ?? pd?.name ?? "Món ăn";
                        const isSelected = (choiceSelections[group.id] ?? []).includes(it.product_id);
                        const groups = pd ? toOptionGroups(pd) : [];
                        const eff = pd ? { ...initialSelections(groups), ...(choiceOptionSelections[it.product_id] ?? {}) } : {};
                        return (
                          <div key={it.product_id} className="flex flex-col gap-2 rounded-card border border-outline-variant/40 p-3">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!isSelected && (choiceSelections[group.id]?.length ?? 0) >= max}
                                onChange={() => {
                                  setChoiceSelections((prev) => {
                                    const cur = prev[group.id] ?? [];
                                    if (cur.includes(it.product_id)) {
                                      return { ...prev, [group.id]: cur.filter((id) => id !== it.product_id) };
                                    }
                                    if (cur.length >= max) return prev;
                                    return { ...prev, [group.id]: [...cur, it.product_id] };
                                  });
                                }}
                              />
                              <span className="text-body-md font-medium text-on-surface">
                                {productName}
                                {it.quantity > 1 && ` x${it.quantity}`}
                              </span>
                            </label>
                            {isSelected && groups.length > 0 && (
                              <div className="flex flex-col gap-2 pl-6">
                                {groups.map((g) => (
                                  <OptionGroup
                                    key={g.id}
                                    group={g}
                                    selected={eff[g.id] ?? []}
                                    onChange={(ids) =>
                                      setChoiceOptionSelections((prev) => ({
                                        ...prev,
                                        [it.product_id]: { ...(prev[it.product_id] ?? {}), [g.id]: ids },
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

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
                  disabled={!canAdd}
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
