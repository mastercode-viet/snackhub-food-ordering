import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import { discountedPrice, formatVnd } from "@/lib/format";
import type { ProductWithCategory } from "@/lib/queries";

export default function ProductCard({ product }: { product: ProductWithCategory }) {
  const hasDiscount = product.discount_percent > 0;
  const finalPrice = discountedPrice(product.base_price, product.discount_percent);
  const soldOut = !product.is_available;

  const inner = (
    <>
      {hasDiscount && !soldOut && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-primary-container px-2.5 py-0.5 text-label-xs font-black text-on-primary shadow-badge tracking-wide">
          -{product.discount_percent}%
        </span>
      )}

      {soldOut && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-on-surface/80 px-2.5 py-0.5 text-label-xs font-bold text-surface-container-lowest backdrop-blur-md">
          Tạm hết
        </span>
      )}

      {/* Nền tô nhạt sau ảnh để món nổi lên khỏi thẻ trắng với soft ambient contrast */}
      <div className="relative overflow-hidden rounded-card-sm bg-surface-container/70 transition-colors duration-300 group-hover:bg-surface-container">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          fallbackIcon={product.categories?.icon}
          className={`h-32 w-full md:h-36 ${soldOut ? "opacity-45 grayscale" : ""}`}
          imgClassName="transition-transform duration-500 ease-out group-hover:scale-108"
        />
      </div>

      <div className="mt-space-md flex flex-1 flex-col justify-between">
        <h3 className="line-clamp-2 text-label-lg leading-tight text-on-surface group-hover:text-primary transition-colors duration-200">
          {product.name}
        </h3>

        <div className="mt-space-md flex items-end justify-between gap-2">
          {/* Nhãn nhỏ ở trên, giá đậm ở dưới */}
          <div className="flex min-w-0 flex-col">
            {hasDiscount ? (
              <span className="text-label-xs leading-none text-on-surface-variant line-through">
                {formatVnd(product.base_price)}
              </span>
            ) : (
              <span className="text-label-xs uppercase leading-none tracking-wider text-on-surface-variant/80">
                Giá
              </span>
            )}
            <span
              className={`mt-1 truncate text-headline-md leading-none ${
                soldOut ? "text-on-surface-variant" : "text-primary"
              }`}
            >
              {formatVnd(finalPrice)}
            </span>
          </div>

          {!soldOut && (
            <motion.span
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-cta transition-shadow group-hover:shadow-card-hover"
            >
              <Plus size={18} strokeWidth={2.8} />
            </motion.span>
          )}
        </div>
      </div>
    </>
  );

  const shell =
    "group relative flex flex-col rounded-card bg-surface-container-lowest p-3 shadow-card transition-all duration-300 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

  if (soldOut) {
    return (
      <div className={`${shell} opacity-75`} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Link to={`/mon/${product.slug}`} className={shell} aria-label={`Xem ${product.name}`}>
        {inner}
      </Link>
    </motion.div>
  );
}
