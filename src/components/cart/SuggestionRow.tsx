import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import ProductImage from "@/components/product/ProductImage";
import { Skeleton } from "@/components/Skeleton";
import { useAsync } from "@/hooks/useAsync";
import { fetchSuggestions, type ProductWithCategory } from "@/lib/queries";
import { discountedPrice, formatVnd } from "@/lib/format";
import type { CartItem } from "@/store/cart";

/**
 * Dải gợi ý thêm món, cuộn ngang — theo bố cục "Gợi ý món ăn hay mua cùng"
 * của Stitch.
 *
 * Khác Stitch ở tên gọi: project không có dữ liệu mua kèm, nên đây là các món
 * CÙNG DANH MỤC với thứ đang có trong giỏ, chưa được chọn. Gọi là "hay mua
 * cùng" sẽ là hứa hẹn một thống kê mình không có.
 *
 * Bấm vào thẻ là sang trang chi tiết chứ không thêm thẳng vào giỏ — nhiều món
 * có nhóm tùy chọn bắt buộc (Size, Độ cay) phải chọn trước.
 */
export default function SuggestionRow({ items }: { items: CartItem[] }) {
  // Combo không có category/productId riêng (không phải là một sản phẩm),
  // nên chỉ tính gợi ý dựa trên các dòng SẢN PHẨM đang có trong giỏ.
  const productItems = useMemo(() => items.filter((i) => i.kind === "product"), [items]);

  // Danh mục lấy từ chính các món đang có trong giỏ. Giỏ lưu từ phiên bản cũ
  // có thể chưa có categoryId — khi đó để mảng rỗng, nghĩa là gợi ý toàn menu.
  const categoryIds = useMemo(
    () => [...new Set(productItems.map((i) => i.categoryId).filter((id): id is string => Boolean(id)))],
    [productItems],
  );
  const excludeIds = useMemo(() => [...new Set(productItems.map((i) => i.productId))], [productItems]);

  const key = `${categoryIds.join(",")}|${excludeIds.join(",")}`;

  const fn = useMemo(
    () => () => fetchSuggestions(categoryIds, excludeIds, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const { data, loading } = useAsync<ProductWithCategory[]>(fn, [key]);

  if (!loading && (!data || data.length === 0)) return null;

  return (
    <section className="mt-5">
      <div className="flex items-center gap-2 px-margin-mobile">
        <Sparkles size={16} className="text-secondary" strokeWidth={2.4} />
        <h2 className="text-label-lg text-on-surface">Gợi ý thêm món</h2>
        <span className="rounded-full bg-secondary-fixed/50 px-2 py-0.5 text-label-xs font-bold text-on-secondary-fixed">
          Ăn kèm ngon
        </span>
      </div>

      <div className="no-scrollbar mt-2.5 flex gap-3 overflow-x-auto px-margin-mobile pb-1">
        {loading && !data
          ? [0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-32 shrink-0 rounded-card" />
            ))
          : data!.map((p) => {
              const price = discountedPrice(p.base_price, p.discount_percent);
              return (
                <Link
                  key={p.id}
                  to={`/mon/${p.slug}`}
                  className="group flex w-32 shrink-0 flex-col rounded-card bg-surface-container-lowest p-2 shadow-card"
                >
                  <ProductImage
                    src={p.image_url}
                    alt={p.name}
                    fallbackIcon={p.categories?.icon}
                    className="h-20 w-full rounded-card-sm"
                  />
                  <h3 className="mt-2 line-clamp-2 flex-1 text-label-md leading-tight text-on-surface">
                    {p.name}
                  </h3>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-label-md font-bold text-primary">{formatVnd(price)}</span>
                    <span
                      aria-hidden="true"
                      className="grid size-6 place-items-center rounded-full bg-inverse-surface text-inverse-on-surface transition-transform group-hover:scale-110"
                    >
                      <Plus size={13} strokeWidth={3} />
                    </span>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
