import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import ProductImage from "@/components/product/ProductImage";
import { useAsync } from "@/hooks/useAsync";
import { fetchActiveBanners } from "@/lib/queries";
import type { Tables } from "@/types/database";

type Banner = Tables<"banners">;

const AUTO_PLAY_INTERVAL = 4500;
const SWIPE_CONFIDENCE_THRESHOLD = 50;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 320, damping: 32 },
      opacity: { duration: 0.35 },
      scale: { duration: 0.35 },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.98,
    transition: {
      x: { type: "spring" as const, stiffness: 320, damping: 32 },
      opacity: { duration: 0.3 },
      scale: { duration: 0.3 },
    },
  }),
};

/**
 * Dải banner quảng cáo với animation chuyển cảnh mượt mà, hỗ trợ vuốt chạm
 * và tự động chuyển slide thông minh.
 */
export default function BannerRail() {
  const { data } = useAsync<Banner[]>(fetchActiveBanners, []);
  const [[page, direction], setPage] = useState([0, 0]);
  const [isPaused, setIsPaused] = useState(false);

  const banners = data ?? [];
  const bannerCount = banners.length;

  const currentIndex = bannerCount > 0 ? ((page % bannerCount) + bannerCount) % bannerCount : 0;

  const paginate = useCallback((newDirection: number) => {
    setPage(([prevPage]) => [prevPage + newDirection, newDirection]);
  }, []);

  const goToIndex = (targetIndex: number) => {
    const diff = targetIndex - currentIndex;
    if (diff !== 0) {
      setPage(([prevPage]) => [prevPage + diff, diff > 0 ? 1 : -1]);
    }
  };

  // Tự động chuyển slide khi có nhiều hơn 1 banner
  useEffect(() => {
    if (bannerCount <= 1 || isPaused) return;

    const timer = setInterval(() => {
      paginate(1);
    }, AUTO_PLAY_INTERVAL);

    return () => clearInterval(timer);
  }, [bannerCount, isPaused, paginate]);

  if (!data || data.length === 0) return null;

  const currentBanner = banners[currentIndex];

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mt-6 px-margin-mobile md:px-gutter"
      aria-label="Khuyến mãi"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div className="group relative w-full overflow-hidden rounded-card-lg bg-surface-container shadow-card">
        {bannerCount === 1 ? (
          <div className="relative h-44 w-full sm:h-48 md:h-72 lg:h-80">
            <BannerItem banner={banners[0]} />
          </div>
        ) : (
          <div className="relative h-44 w-full overflow-hidden sm:h-48 md:h-72 lg:h-80">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={page}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={(_, { offset, velocity }) => {
                  const swipe = offset.x + velocity.x * 0.2;
                  if (swipe < -SWIPE_CONFIDENCE_THRESHOLD) {
                    paginate(1);
                  } else if (swipe > SWIPE_CONFIDENCE_THRESHOLD) {
                    paginate(-1);
                  }
                }}
                className="absolute inset-0 size-full cursor-grab active:cursor-grabbing select-none"
              >
                <BannerItem banner={currentBanner} />
              </motion.div>
            </AnimatePresence>

            {/* Nút điều hướng desktop */}
            <div className="pointer-events-none absolute inset-x-2.5 top-1/2 z-10 hidden -translate-y-1/2 justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:flex">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  paginate(-1);
                }}
                aria-label="Banner trước"
                className="pointer-events-auto grid size-8 place-items-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow-md backdrop-blur-md transition-colors hover:bg-surface-container-lowest"
              >
                <ChevronLeft size={18} strokeWidth={2.5} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  paginate(1);
                }}
                aria-label="Banner tiếp theo"
                className="pointer-events-auto grid size-8 place-items-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow-md backdrop-blur-md transition-colors hover:bg-surface-container-lowest"
              >
                <ChevronRight size={18} strokeWidth={2.5} />
              </motion.button>
            </div>

            {/* Chỉ số phân trang dạng dot hoạt hoạ */}
            <div className="absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-neutral-950/40 px-2.5 py-1 backdrop-blur-md">
              {banners.map((b, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      goToIndex(idx);
                    }}
                    aria-label={`Chuyển tới banner ${idx + 1}`}
                    className="relative flex h-2 items-center justify-center p-0.5 focus:outline-none"
                  >
                    <motion.span
                      layout
                      className={`block h-1.5 rounded-full transition-all duration-300 ${
                        isActive ? "w-5 bg-white shadow-sm" : "w-1.5 bg-white/50 hover:bg-white/80"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

function BannerItem({ banner }: { banner: Banner }) {
  const content = (
    <div className="relative size-full overflow-hidden">
      <ProductImage
        src={banner.image_url}
        alt=""
        fallbackIcon="📣"
        className="size-full object-cover"
        imgClassName="transition-transform duration-700 ease-out hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/5" />
    </div>
  );

  if (!banner.link_url) {
    return <div className="size-full">{content}</div>;
  }

  const external = /^https?:\/\//.test(banner.link_url);
  const linkClass = "block size-full transition-transform duration-200 active:scale-[0.99]";

  if (external) {
    return (
      <a
        href={banner.link_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Xem khuyến mãi"
        className={linkClass}
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={banner.link_url} aria-label="Xem khuyến mãi" className={linkClass}>
      {content}
    </Link>
  );
}

