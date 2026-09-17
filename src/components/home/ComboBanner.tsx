import { Plus } from "lucide-react";
import { motion } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import { useAsync } from "@/hooks/useAsync";
import { fetchFeaturedCombos, type ComboWithItems } from "@/lib/queries";
import { formatVnd } from "@/lib/format";
import { comboToCartItem, useCartStore } from "@/store/cart";
import { toast } from "@/store/toast";

/**
 * Banner combo nổi bật — vị trí TRÊN CÙNG trang chủ, trước cả header.
 *
 * Ẩn hẳn (không loading skeleton, không khung rỗng) nếu chưa có combo nào
 * bật `is_featured` — đây là vị trí nhạy cảm nhất trang, một khung chờ hay
 * khung rỗng ở đây đập ngay vào mắt trước khi có gì khác kịp tải.
 *
 * Ảnh full-bleed thay vì dải màu phẳng: khác iconTone nhạt của ComboRail bên
 * dưới, banner được phép "nói to" hơn một chút vì đây là vị trí quảng cáo
 * đúng nghĩa — nhưng vẫn không dùng gradient hay đổ bóng nhiều tầng, đúng
 * hướng editorial đã chốt từ đầu đợt redesign.
 */
export default function ComboBanner() {
  const { data } = useAsync<ComboWithItems[]>(fetchFeaturedCombos, []);

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-3 px-margin-mobile md:px-gutter">
      <div
        className={`no-scrollbar flex gap-3 overflow-x-auto pb-1 ${
          data.length > 1 ? "snap-x snap-mandatory scroll-smooth" : ""
        }`}
      >
        {data.map((combo) => (
          <BannerCard key={combo.id} combo={combo} single={data.length === 1} />
        ))}
      </div>
    </section>
  );
}

function BannerCard({ combo, single }: { combo: ComboWithItems; single: boolean }) {
  const addItem = useCartStore((s) => s.addItem);

  function handleAdd() {
    addItem(comboToCartItem(combo, 1));
    toast.success(`Đã thêm "${combo.name}" vào giỏ`);
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-card-lg bg-surface-container shadow-card ${
        single ? "w-full" : "w-[85%] snap-center"
      }`}
    >
      <ProductImage
        src={combo.image_url}
        alt={combo.name}
        fallbackIcon="🍱"
        className="h-40 w-full md:h-48"
        imgClassName="transition-transform duration-500 ease-out hover:scale-105"
      />

      {/* Dải chữ dưới ảnh dùng mực ĐẶC, không trong suốt: nếu để bán trong suốt,
          độ tương phản phụ thuộc màu ảnh bên dưới — mỗi combo một ảnh khác
          nhau nên không đo cố định được. Mực đặc tái dùng đúng cặp đã đo
          16.13:1 (giống hệt nút chính) bất kể ảnh nền là gì. Cũng tránh việc
          thêm một biến thể glass mới ngoài phạm vi đã định (chỉ BottomNav
          dùng kính mờ, có fallback prefers-reduced-transparency riêng). */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-inverse-surface px-4 py-3">
        <div className="min-w-0">
          <p className="line-clamp-1 text-label-lg font-bold text-inverse-on-surface">{combo.name}</p>
          <p className="mt-0.5 text-headline-sm font-extrabold text-inverse-on-surface">
            {formatVnd(Number(combo.price))}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          type="button"
          onClick={handleAdd}
          aria-label={`Thêm "${combo.name}" vào giỏ`}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-on-primary shadow-cta"
        >
          <Plus size={20} strokeWidth={2.8} />
        </motion.button>
      </div>
    </div>
  );
}
