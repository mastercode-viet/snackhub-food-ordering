import { Plus, ShoppingBag } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductImage from "@/components/product/ProductImage";
import ErrorState from "@/components/ui/ErrorState";
import { ComboRailSkeleton } from "@/components/Skeleton";
import ComboSheet from "@/components/home/ComboSheet";
import { useAsync } from "@/hooks/useAsync";
import { formatVnd } from "@/lib/format";
import { fetchCombos, fetchProductsByIds, type ComboWithItems } from "@/lib/queries";

/** Số chip món con hiển thị tối đa trên 1 thẻ trước khi rút gọn thành "+N". */
const MAX_ITEM_CHIPS = 3;

/**
 * Section "Ăn thả ga không lo về giá" — liệt kê TOÀN BỘ combo đang bán.
 *
 * Ẩn hẳn nếu không có combo nào, cùng chính sách với BannerRail: một khối
 * quảng bá luôn rỗng còn tệ hơn không có khối đó — đúng lý do "Xem gần đây"
 * đã bị bỏ khỏi trang chủ trong đợt redesign trước.
 */
export default function ComboRail() {
  const { data, loading, error, reload } = useAsync<ComboWithItems[]>(fetchCombos, []);

  // Món nước trong combo có thể tạm hết — card ngoài cần biết trạng thái này để
  // không mời khách chọn một món đã hết. Gom id của MỌI combo rồi hỏi một lần.
  const choiceIds = useMemo(
    () => [
      ...new Set(
        (data ?? []).flatMap((combo) =>
          (combo.choice_groups ?? []).flatMap((g) => g.items.map((it) => it.product_id)),
        ),
      ),
    ],
    [data],
  );
  const { data: availability } = useAsync<Record<string, boolean>>(
    () =>
      choiceIds.length > 0
        ? fetchProductsByIds(choiceIds).then((products) =>
            Object.fromEntries(products.map((p) => [p.id, p.is_available])),
          )
        : Promise.resolve({}),
    [choiceIds.join(",")],
  );

  if (!loading && (!data || data.length === 0)) return null;

  const body = loading && !data ? (
    <ComboRailSkeleton />
  ) : error ? (
    <ErrorState onRetry={reload} />
  ) : (
    <ul className="no-scrollbar -mx-1 flex gap-3.5 overflow-x-auto px-1 pb-1.5 scroll-smooth">
      {data!.map((combo) => (
        <li key={combo.id} className="shrink-0">
          <ComboCard combo={combo} availability={availability ?? {}} />
        </li>
      ))}
    </ul>
  );

  return (
    <section className="mt-6 px-margin-mobile md:px-gutter">
      <div className="overflow-hidden rounded-card-lg bg-surface-container-lowest shadow-card border border-outline-variant/40">
        <header className="flex items-center gap-3 px-4 pb-2 pt-4 border-b border-outline-variant/40">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag size={18} strokeWidth={2.4} />
          </span>
          <h2 className="text-headline-sm font-extrabold tracking-tight text-on-surface">
            Ăn thả ga không lo về giá
          </h2>
        </header>

        <div className="p-3.5">{body}</div>
      </div>
    </section>
  );
}

function ComboCard({
  combo,
  availability,
}: {
  combo: ComboWithItems;
  availability: Record<string, boolean>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const chips = combo.combo_items
    .filter((i): i is typeof i & { products: NonNullable<typeof i.products> } => Boolean(i.products))
    .map((i) => (i.quantity > 1 ? `${i.products.name} x${i.quantity}` : i.products.name));
  const shownChips = chips.slice(0, MAX_ITEM_CHIPS);
  const extraCount = chips.length - shownChips.length;
  // Ngoài món chính, combo còn cho chọn món nước — card phải nói rõ chọn được gì.
  const choiceGroups = (combo.choice_groups ?? []).filter((g) => g.items.length > 0);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSheetOpen(true);
  }

  return (
    <>
      <Link
        to={`/combo/${combo.slug}`}
        className="flex w-72 items-start gap-3.5 rounded-card bg-surface-container-lowest p-2 border border-outline-variant/60 shadow-card transition-shadow hover:shadow-card-hover"
      >
        <ProductImage
          src={combo.image_url}
          alt={combo.name}
          fallbackIcon="🍱"
          className="size-20 shrink-0 rounded-card-sm"
        />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <h3 className="line-clamp-1 text-label-md font-semibold leading-tight text-on-surface">
            {combo.name}
          </h3>

          {shownChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {shownChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-secondary-fixed/60 px-2 py-0.5 text-label-xs font-semibold text-on-secondary-fixed"
                >
                  {chip}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="text-label-xs font-semibold text-on-surface-variant">+{extraCount}</span>
              )}
            </div>
          )}

          {choiceGroups.map((group) => (
            <p key={group.id} className="line-clamp-2 text-label-xs leading-snug text-on-surface-variant">
              <span className="font-bold text-secondary">
                {(group.name || "Chọn kèm").trim()}:
              </span>{" "}
              {group.items.map((it, idx) => {
                const soldOut = availability[it.product_id] === false;
                return (
                  <span
                    key={`${it.product_id}-${idx}`}
                    className={soldOut ? "text-error/80" : undefined}
                  >
                    {it.product_name ?? "Món trong combo"}
                    {soldOut ? " (tạm hết)" : ""}
                    {idx < group.items.length - 1 ? " · " : ""}
                  </span>
                );
              })}
            </p>
          ))}

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-label-lg font-extrabold text-primary">{formatVnd(Number(combo.price))}</span>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={handleAdd}
              aria-label={`Thêm "${combo.name}" vào giỏ`}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-on-primary shadow-cta transition-shadow hover:shadow-card-hover"
            >
              <Plus size={18} strokeWidth={2.8} />
            </motion.button>
          </div>
        </div>
      </Link>

      {sheetOpen && <ComboSheet slug={combo.slug} onClose={() => setSheetOpen(false)} />}
    </>
  );
}
