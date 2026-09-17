import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "@/components/home/SearchBar";
import CategoryPills from "@/components/home/CategoryPills";
import ProductGrid from "@/components/product/ProductGrid";
import { useCategories, useProducts } from "@/hooks/useMenu";
import { useDebounce } from "@/hooks/useDebounce";

const PARAM_CATEGORY = "danh-muc";
const PARAM_QUERY = "q";

/**
 * Thực đơn đầy đủ. Stitch không thiết kế màn này — dựng theo design token
 * và dùng lại nguyên bộ component của Trang chủ.
 *
 * Trạng thái lọc nằm ở URL (`?danh-muc=do-uong&q=trà`) chứ không nằm trong
 * useState, để khách gửi link cho bạn bè và bấm back đều đúng.
 */
export default function MenuPage() {
  const [params, setParams] = useSearchParams();
  const categorySlug = params.get(PARAM_CATEGORY);
  const urlQuery = params.get(PARAM_QUERY) ?? "";

  const [input, setInput] = useState(urlQuery);
  const debounced = useDebounce(input, 300); // CLAUDE.md: debounce 300ms

  const categories = useCategories();

  const activeCategory = useMemo(
    () => categories.data?.find((c) => c.slug === categorySlug) ?? null,
    [categories.data, categorySlug],
  );

  // Ghi từ khoá đã debounce vào URL. So sánh chuỗi trước khi set để effect
  // không tự kích hoạt lại chính nó.
  useEffect(() => {
    const next = new URLSearchParams(params);
    const value = debounced.trim();
    if (value) next.set(PARAM_QUERY, value);
    else next.delete(PARAM_QUERY);

    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
  }, [debounced, params, setParams]);

  const categoryId = activeCategory?.id ?? null;

  // URL là nguồn sự thật cho truy vấn — nhờ đó reload trang vẫn ra đúng kết quả.
  const products = useProducts({ categoryId, search: urlQuery });

  // Đang chờ danh mục về thì chưa biết categoryId, giữ skeleton để tránh
  // nháy một lượt "toàn bộ món" rồi mới lọc.
  const resolvingCategory = Boolean(categorySlug) && categories.loading;

  function selectCategory(slug: string | null) {
    const next = new URLSearchParams(params);
    if (slug) next.set(PARAM_CATEGORY, slug);
    else next.delete(PARAM_CATEGORY);
    setParams(next);
  }

  const hasFilter = Boolean(categorySlug) || Boolean(urlQuery);

  return (
    <div>
      {/* md:top-16 để không chui xuống dưới thanh nav ngang cố định của desktop */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl pt-safe md:top-16">
        <div className="flex flex-col gap-space-md px-margin-mobile pb-1 pt-4 md:px-gutter">
          <div className="flex items-baseline justify-between">
            <h1 className="text-headline-lg tracking-tight text-on-surface">Thực đơn</h1>
            {products.data && !products.loading && (
              <span className="text-label-sm font-semibold text-secondary">
                {products.data.length} món
              </span>
            )}
          </div>

          <SearchBar value={input} onChange={setInput} />
        </div>

        <CategoryPills
          variant="chip"
          categories={categories.data}
          loading={categories.loading}
          activeId={categoryId}
          onSelect={(item) => selectCategory(item.slug)}
        />

        <div className="h-px bg-outline-variant/40" />
      </div>

      <section className="px-margin-mobile pt-4 md:px-gutter">
        {hasFilter && (
          <p className="mb-3 text-body-sm text-on-surface-variant">
            {activeCategory && (
              <>
                Danh mục <span className="font-bold text-on-surface">{activeCategory.name}</span>
              </>
            )}
            {activeCategory && urlQuery && " · "}
            {urlQuery && (
              <>
                Từ khoá <span className="font-bold text-on-surface">“{urlQuery}”</span>
              </>
            )}
          </p>
        )}

        <ProductGrid
          products={products.data}
          loading={products.loading || resolvingCategory}
          error={products.error}
          onRetry={products.reload}
          emptyTitle={urlQuery ? "Không tìm thấy món nào" : "Danh mục này chưa có món"}
          emptyDescription={
            urlQuery
              ? "Thử từ khoá ngắn hơn, ví dụ “tra” hoặc “banh”."
              : "Chọn danh mục khác để xem thêm nhé."
          }
        />
      </section>
    </div>
  );
}
