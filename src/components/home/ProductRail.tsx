import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import ErrorState from "@/components/ui/ErrorState";
import { ProductRailSkeleton } from "@/components/Skeleton";
import { discountedPrice, formatVnd } from "@/lib/format";
import type { ProductWithCategory } from "@/lib/queries";

export type RailLayout = "tile" | "wide";
export type RailTone = "plain" | "banner-primary" | "banner-info";

export default function ProductRail({
  title,
  products,
  loading,
  error = null,
  onRetry,
  href,
  layout = "tile",
  tone = "plain",
  subtitle,
  icon,
  headerRight,
  emptyText = "Chưa có món nào ở đây.",
}: {
  title: ReactNode;
  products: ProductWithCategory[] | null;
  loading: boolean;
  error?: Error | null;
  onRetry?: () => void;
  href?: string;
  layout?: RailLayout;
  tone?: RailTone;
  subtitle?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  emptyText?: string;
}) {
  const onBanner = tone !== "plain";
  const bandClass = tone === "banner-info" ? "bg-info" : "bg-primary-container";

  const body =
    loading && !products ? (
      <ProductRailSkeleton layout={layout} />
    ) : error ? (
      <ErrorState onRetry={onRetry} />
    ) : !products || products.length === 0 ? (
      <p
        className={`px-1 py-6 text-center text-body-sm ${
          onBanner
            ? "rounded-card bg-surface-container-lowest text-on-surface-variant"
            : "text-on-surface-variant"
        }`}
      >
        {emptyText}
      </p>
    ) : (
      <ul className="no-scrollbar -mx-1 flex gap-3.5 overflow-x-auto px-1 pb-1.5 scroll-smooth">
        {products.map((p) => (
          <li key={p.id} className="shrink-0">
            <RailCard product={p} layout={layout} onBanner={onBanner} />
          </li>
        ))}
      </ul>
    );

  return (
    <section className="mt-6 px-margin-mobile md:px-gutter">
      <div className="overflow-hidden rounded-card-lg bg-surface-container-lowest shadow-card border border-outline-variant/40">
        {onBanner ? (
          <>
            {/* Dải màu có mép phải bo cong với hiếu ứng gradient mềm */}
            <header className={`relative overflow-hidden px-4.5 pb-16 pt-4 ${bandClass}`}>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 top-1/2 size-56 -translate-y-1/2 rounded-full bg-surface-container-lowest/15 backdrop-blur-xl"
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  {icon && <span className="shrink-0 text-on-primary">{icon}</span>}
                  <h2 className="text-headline-sm font-black italic tracking-tight text-on-primary">
                    {title}
                  </h2>
                  {subtitle && (
                    <span className="rounded-full bg-sale px-2.5 py-0.5 text-label-xs font-bold text-on-sale shadow-badge">
                      {subtitle}
                    </span>
                  )}
                </div>

                {href && (
                  <Link
                    to={href}
                    className="flex shrink-0 items-center gap-0.5 text-label-sm font-bold text-on-primary transition-opacity hover:opacity-85"
                  >
                    Xem tất cả
                    <ChevronRight size={15} strokeWidth={2.5} />
                  </Link>
                )}
              </div>
            </header>

            {/* Kéo thẻ lên đè vào dải màu */}
            <div className="relative -mt-12 px-3 pb-3.5">{body}</div>
          </>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 px-4.5 pb-2 pt-4 border-b border-outline-variant/40">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                {icon && <span className="shrink-0 text-primary">{icon}</span>}
                <div className="flex items-center gap-2">
                  {title}
                  {headerRight}
                </div>
              </div>

              {href && (
                <Link
                  to={href}
                  className="flex shrink-0 items-center gap-0.5 text-label-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
                >
                  Xem thêm
                  <ChevronRight size={15} strokeWidth={2.5} />
                </Link>
              )}
            </header>

            <div className="p-3.5">{body}</div>
          </>
        )}
      </div>
    </section>
  );
}

function RailCard({
  product,
  layout,
  onBanner,
}: {
  product: ProductWithCategory;
  layout: RailLayout;
  onBanner: boolean;
}) {
  const hasDiscount = product.discount_percent > 0;
  const finalPrice = discountedPrice(product.base_price, product.discount_percent);
  const soldOut = !product.is_available;
  const categoryName = product.categories?.name ?? null;

  const priceBlock = (
    <div className="mt-1.5 flex flex-col">
      <span className={`text-label-lg font-extrabold ${soldOut ? "text-outline" : "text-primary"}`}>
        {formatVnd(finalPrice)}
      </span>
      {hasDiscount && (
        <span className="text-label-xs text-on-surface-variant line-through">
          {formatVnd(product.base_price)}
        </span>
      )}
    </div>
  );

  if (layout === "wide") {
    return (
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Link
          to={`/mon/${product.slug}`}
          className="group flex w-72 gap-3.5 rounded-card p-2 border border-outline-variant/60 bg-surface-container-lowest shadow-card transition-all hover:shadow-card-hover focus-visible:outline-none"
        >
          <ProductImage
            src={product.image_url}
            alt={product.name}
            fallbackIcon={product.categories?.icon}
            className={`size-20 shrink-0 rounded-card-sm ${soldOut ? "opacity-45 grayscale" : ""}`}
          />

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h3 className="line-clamp-2 text-label-md font-semibold leading-tight text-on-surface group-hover:text-primary transition-colors">
              {product.name}
            </h3>

            {categoryName && (
              <span className="mt-1 w-fit rounded-full bg-primary-fixed/80 px-2 py-0.5 text-label-xs font-semibold text-on-primary-fixed">
                {categoryName}
              </span>
            )}

            {priceBlock}
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.96 }}>
      <Link
        to={`/mon/${product.slug}`}
        className={`group flex w-36 flex-col rounded-card p-2 border border-outline-variant/50 transition-all focus-visible:outline-none ${
          onBanner ? "bg-surface-container-lowest shadow-card" : "bg-surface-container-lowest hover:shadow-card-hover"
        }`}
      >
        <div className="relative overflow-hidden rounded-card-sm bg-surface-container/70">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            fallbackIcon={product.categories?.icon}
            className={`aspect-square w-full ${soldOut ? "opacity-45 grayscale" : ""}`}
            imgClassName="transition-transform duration-500 ease-out group-hover:scale-108"
          />

          {hasDiscount && !soldOut && (
            <span className="absolute right-0 top-0 rounded-bl-card-sm bg-sale px-2 py-0.5 text-label-xs font-extrabold text-on-sale shadow-badge">
              -{product.discount_percent}%
            </span>
          )}

          {soldOut && (
            <span className="absolute left-2 top-2 rounded-full bg-on-surface/80 px-2 py-0.5 text-label-xs text-surface-container-lowest backdrop-blur-md">
              Tạm hết
            </span>
          )}
        </div>

        {categoryName && (
          <p className="mt-2 truncate text-label-xs font-medium text-on-surface-variant">{categoryName}</p>
        )}

        <h3 className="mt-0.5 line-clamp-2 text-label-md font-semibold leading-tight text-on-surface group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {priceBlock}
      </Link>
    </motion.div>
  );
}
