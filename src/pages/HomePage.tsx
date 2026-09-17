import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, ChevronRight, MapPin, PiggyBank, Sparkles, User } from "lucide-react";
import SearchBar from "@/components/home/SearchBar";
import CategoryPills from "@/components/home/CategoryPills";
import CountdownTimer from "@/components/home/CountdownTimer";
import ProductRail from "@/components/home/ProductRail";
import { StoreClosedBanner, StoreHoursBadge, StoreStatusLine } from "@/components/home/StoreStatus";
import ProductGrid from "@/components/product/ProductGrid";
import { useCategories, useProducts, useStoreOpen, useStoreSettings } from "@/hooks/useMenu";
import { useDebounce } from "@/hooks/useDebounce";
import { discountedPrice } from "@/lib/format";

/** Số món tối đa hiển thị trong một dải cuộn ngang. */
const RAIL_SIZE = 10;

export default function HomePage() {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300); // CLAUDE.md: debounce 300ms

  const categories = useCategories();
  const settings = useStoreSettings();
  const storeOpen = useStoreOpen();
  const products = useProducts({ categoryId, search: debouncedSearch });

  /**
   * Nguồn RIÊNG cho các dải cuộn ngang, KHÔNG dùng lại `products` ở trên.
   * `products` đã bị lọc theo danh mục và từ khoá đang chọn — dùng lại sẽ khiến
   * Flash Sale đổi nội dung mỗi lần khách bấm một danh mục, điều không ai muốn.
   */
  const allProducts = useProducts({});

  // Ba dải dưới đây đều chạy bằng DỮ LIỆU THẬT, chỉ khác cách lọc/sắp xếp.
  const rails = useMemo(() => {
    const available = (allProducts.data ?? []).filter((p) => p.is_available);

    return {
      // Flash Sale: món đang giảm giá, giảm sâu xếp trước.
      flashSale: available
        .filter((p) => p.discount_percent > 0)
        .sort((a, b) => b.discount_percent - a.discount_percent)
        .slice(0, RAIL_SIZE),

      // Must Try: cờ is_featured do quán bật.
      mustTry: available.filter((p) => p.is_featured).slice(0, RAIL_SIZE),

      // Ăn Ngon Rẻ: giá sau giảm thấp nhất xếp trước.
      goodCheap: [...available]
        .sort(
          (a, b) =>
            discountedPrice(a.base_price, a.discount_percent) -
            discountedPrice(b.base_price, b.discount_percent),
        )
        .slice(0, RAIL_SIZE),
    };
  }, [allProducts.data]);

  const activeCategory = categories.data?.find((c) => c.id === categoryId) ?? null;

  // Mang theo bộ lọc đang chọn sang Thực đơn, để khách không phải chọn lại
  const menuParams = new URLSearchParams();
  if (activeCategory) menuParams.set("danh-muc", activeCategory.slug);
  if (debouncedSearch.trim()) menuParams.set("q", debouncedSearch.trim());
  const menuHref = menuParams.toString() ? `/thuc-don?${menuParams}` : "/thuc-don";

  const heading = debouncedSearch.trim()
    ? `Kết quả cho "${debouncedSearch.trim()}"`
    : activeCategory
      ? activeCategory.name
      : "Món ăn vặt thịnh hành";

  return (
    <div className="pt-safe">
      {/* Đã bỏ hai khối mờ trang trí: chúng phủ sắc hồng/vàng lên nền giấy và
          là thứ điển hình tạo cảm giác "app đồ ăn AI". Editorial dựa vào khoảng
          trắng và phân cấp chữ, không dựa vào hiệu ứng nền. */}
      <header className="pb-1 pt-3">
        <div className="flex flex-col gap-space-md px-margin-mobile md:px-gutter">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              {/* Khai báo sẵn width/height để trình duyệt giữ chỗ, tránh nhảy
                  layout lúc ảnh chưa tải xong */}
              <img
                src="/logo.png"
                alt="SnackHub"
                width={156}
                height={160}
                className="size-12 shrink-0 object-contain"
              />
              <p className="flex min-w-0 items-center gap-1 text-label-sm text-on-surface-variant">
                <MapPin size={13} className="shrink-0 text-secondary" strokeWidth={2.5} />
                Giao miễn phí trong trường
              </p>
            </div>

            <Link
              to="/don-hang"
              aria-label="Đơn hàng của tôi"
              className="grid size-11 place-items-center rounded-full bg-surface-container-lowest text-on-surface-variant border border-outline-variant shadow-card transition-transform active:scale-95"
            >
              <User size={20} strokeWidth={2.2} />
            </Link>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <StoreStatusLine isOpen={storeOpen.data} />
              <h1 className="mt-0.5 text-headline-md tracking-tight text-on-surface">
                Hôm nay ăn gì thượng đế ơi?
              </h1>
            </div>
            <StoreHoursBadge settings={settings.data} />
          </div>

          <SearchBar value={search} onChange={setSearch} />
        </div>

        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between px-margin-mobile md:px-gutter">
            <span className="text-label-md text-on-surface">Món vặt ưa thích</span>
            {products.data && (
              <span className="text-label-sm font-semibold text-secondary">
                {products.data.length} món
              </span>
            )}
          </div>
          <CategoryPills
            categories={categories.data}
            loading={categories.loading}
            activeId={categoryId}
            onSelect={(item) => setCategoryId(item.id)}
          />
        </div>
      </header>

      {storeOpen.data === false && <StoreClosedBanner settings={settings.data} />}

      <section className="mt-4 flex flex-col gap-space-sm px-margin-mobile md:px-gutter">
        {/* Tiêu đề mục kiểu editorial: chữ to siết tracking, đường kẻ mảnh phía
            dưới thay cho thanh màu. Link phụ dùng mực, không dùng màu. */}
        <div className="flex items-end justify-between gap-3 border-b border-outline-variant pb-2">
          <h2 className="min-w-0 truncate text-headline-md text-on-surface">{heading}</h2>

          <Link
            to={menuHref}
            className="flex shrink-0 items-center gap-0.5 pb-0.5 text-label-md text-on-surface-variant underline-offset-4 transition-colors hover:text-on-surface hover:underline"
          >
            Xem tất cả
            <ChevronRight size={15} strokeWidth={2} />
          </Link>
        </div>

        <ProductGrid
          products={products.data}
          loading={products.loading}
          error={products.error}
          onRetry={products.reload}
          emptyTitle={debouncedSearch.trim() ? "Không tìm thấy món nào" : "Danh mục này chưa có món"}
          emptyDescription={
            debouncedSearch.trim()
              ? "Thử từ khoá ngắn hơn, ví dụ “trà” hoặc “bánh”."
              : "Chọn danh mục khác để xem thêm nhé."
          }
        />
      </section>

      <ProductRail
        title={
          /* Wordmark như mẫu: "FLASH" đỏ, "SALE" đen, cả hai in nghiêng đậm */
          <span className="text-headline-sm font-extrabold italic tracking-tight">
            <span className="text-primary">FLASH</span>{" "}
            <span className="text-on-surface">SALE</span>
          </span>
        }
        icon={<AlarmClock size={20} strokeWidth={2.6} />}
        products={rails.flashSale}
        loading={allProducts.loading}
        error={allProducts.error}
        onRetry={allProducts.reload}
        href="/thuc-don"
        emptyText="Hiện chưa có món nào đang giảm giá."
        /* Chưa có cột thời gian khuyến mãi trong `products` nên truyền null:
           CountdownTimer sẽ tự ẩn thay vì đếm ngược tới một mốc bịa ra. */
        headerRight={<CountdownTimer endsAt={null} />}
      />

      <ProductRail
        title={
          <span className="text-headline-sm font-extrabold tracking-tight text-primary">
            Xem gần đây
          </span>
        }
        layout="wide"
        /* Chưa có nơi lưu lịch sử xem món — khối chạy ở trạng thái rỗng cho tới
           khi thêm store `recentProducts`. Giao diện đã sẵn sàng nhận dữ liệu. */
        products={[]}
        loading={false}
        emptyText="Món bạn vừa xem sẽ xuất hiện ở đây."
      />

      <ProductRail
        title="Must Try"
        icon={<Sparkles size={20} strokeWidth={2.4} />}
        tone="banner-info"
        subtitle="Giảm tới 50%"
        products={rails.mustTry}
        loading={allProducts.loading}
        error={allProducts.error}
        onRetry={allProducts.reload}
        href="/thuc-don"
        emptyText="Quán chưa chọn món nổi bật nào."
      />

      <ProductRail
        title="Ăn Ngon Rẻ"
        icon={<PiggyBank size={20} strokeWidth={2.4} />}
        tone="banner-primary"
        subtitle="Giá mềm nhất quán"
        products={rails.goodCheap}
        loading={allProducts.loading}
        error={allProducts.error}
        onRetry={allProducts.reload}
        href="/thuc-don"
        emptyText="Chưa có món nào để xếp hạng giá."
      />
    </div>
  );
}
