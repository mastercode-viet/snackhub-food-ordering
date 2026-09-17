import { motion } from "motion/react";
import { CategoryRowSkeleton, Skeleton } from "@/components/Skeleton";
import type { Tables } from "@/types/database";

export type CategoryItem = { id: string | null; slug: string | null; name: string; icon: string | null };

export default function CategoryPills({
  categories,
  loading,
  activeId,
  onSelect,
  variant = "round",
}: {
  categories: Tables<"categories">[] | null;
  loading: boolean;
  activeId: string | null;
  onSelect: (item: CategoryItem) => void;
  variant?: "round" | "chip";
}) {
  if (loading && !categories) {
    return variant === "round" ? (
      <div className="px-margin-mobile py-2 md:px-gutter">
        <CategoryRowSkeleton />
      </div>
    ) : (
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-margin-mobile py-2 md:px-gutter">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) return null;

  const items: CategoryItem[] = [
    { id: null, slug: null, name: "Tất cả", icon: "🧺" },
    ...categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, icon: c.icon })),
  ];

  return (
    <div
      className={`no-scrollbar flex overflow-x-auto scroll-smooth px-margin-mobile md:px-gutter ${
        variant === "round" ? "items-start gap-3.5 py-2.5" : "items-center gap-2.5 py-2"
      }`}
      role="tablist"
      aria-label="Danh mục món"
    >
      {items.map((item) => {
        const active = item.id === activeId;

        if (variant === "chip") {
          return (
            <motion.button
              key={item.id ?? "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(item)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-label-md transition-colors ${
                active
                  ? "bg-inverse-surface text-inverse-on-surface shadow-cta font-semibold"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant shadow-card hover:bg-surface-container-low"
              }`}
            >
              <span aria-hidden="true" className="text-base">{item.icon || "🍽️"}</span>
              <span>{item.name}</span>
            </motion.button>
          );
        }

        return (
          <motion.button
            key={item.id ?? "all"}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.94 }}
            className="group relative flex w-16 shrink-0 flex-col items-center gap-2 focus:outline-none"
          >
            <div
              className={`relative grid size-16 place-items-center rounded-full text-2xl transition-all duration-300 ${
                active
                  ? "bg-surface-container-lowest shadow-lift ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "bg-surface-container-lowest border border-outline-variant/80 shadow-card group-hover:border-primary/40 group-hover:shadow-card-hover"
              }`}
            >
              <span aria-hidden="true" className="transition-transform duration-300 group-hover:scale-110">
                {item.icon || "🍽️"}
              </span>
            </div>
            <span
              className={`text-center text-label-sm leading-tight transition-colors duration-200 ${
                active ? "font-bold text-primary" : "text-on-surface-variant group-hover:text-on-surface"
              }`}
            >
              {item.name}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
