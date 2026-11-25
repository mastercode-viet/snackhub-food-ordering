import { motion } from "motion/react";
import ProductCard from "@/components/product/ProductCard";
import { ProductGridSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import type { ProductWithCategory } from "@/lib/queries";

export default function ProductGrid({
  products,
  loading,
  error,
  onRetry,
  emptyTitle = "Chưa có món nào",
  emptyDescription = "Thử chọn danh mục khác hoặc đổi từ khoá tìm kiếm.",
}: {
  products: ProductWithCategory[] | null;
  loading: boolean;
  error: Error | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading && !products) return <ProductGridSkeleton count={6} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (!products || products.length === 0) {
    return <EmptyState icon="🔍" title={emptyTitle} description={emptyDescription} />;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={`grid grid-cols-2 gap-gutter-mobile md:grid-cols-3 md:gap-gutter lg:grid-cols-4 ${
        loading ? "opacity-60" : ""
      }`}
    >
      {products.map((p, index) => (
        <motion.div key={p.id} variants={itemVariants}>
          {/* Thẻ đầu tiên mang nhịp thở để hướng dẫn khách mới đúng một điểm. */}
          <ProductCard product={p} highlight={index === 0} />
        </motion.div>
      ))}
    </motion.div>
  );
}
