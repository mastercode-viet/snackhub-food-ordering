/**
 * Loading state dùng skeleton `animate-pulse` — CLAUDE.md cấm dùng spinner.
 *
 * Khung chờ phải khớp ĐÚNG kích thước và bo góc của component thật, nếu không
 * tải xong là layout nhảy. Mỗi khung dưới đây soi chiếu 1-1 với component nó thay thế.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-surface-container-high ${className}`} />;
}

/**
 * Khung chờ cho 1 thẻ sản phẩm trong lưới 2 cột.
 * Soi chiếu `components/product/ProductCard.tsx`: vỏ rounded-card + p-2.5,
 * ảnh h-32 rounded-xl, tên 2 dòng, hàng giá có nút tròn size-9.
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-card bg-surface-container-lowest p-2.5 shadow-card">
      <Skeleton className="h-32 w-full rounded-card-sm md:h-36" />

      <div className="mt-space-md flex flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>

        <div className="mt-space-md flex items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="size-10 shrink-0 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Lưới sản phẩm 2 cột đang tải. */
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-gutter-mobile md:grid-cols-3 md:gap-gutter lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Khung chờ cho dải sản phẩm cuộn ngang.
 * Soi chiếu `components/home/ProductRail.tsx`: thẻ "tile" rộng w-40 với ảnh
 * vuông, thẻ "wide" rộng w-72 với ảnh size-20 bên trái.
 */
export function ProductRailSkeleton({
  layout = "tile",
  count = 4,
}: {
  layout?: "tile" | "wide";
  count?: number;
}) {
  if (layout === "wide") {
    return (
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex w-72 shrink-0 gap-3 p-1">
            <Skeleton className="size-20 shrink-0 rounded-card" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-1 h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex w-36 shrink-0 flex-col gap-1.5 p-1.5">
          <Skeleton className="aspect-square w-full rounded-card" />
          <Skeleton className="mt-1 h-3 w-16" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Dải danh mục pill tròn đang tải.
 * Soi chiếu biến thể `round` của `components/home/CategoryPills.tsx`:
 * cột w-16, gap-1.5, icon size-16 BO TRÒN, nhãn text-label-sm.
 */
export function CategoryRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
