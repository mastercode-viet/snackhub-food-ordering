import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Thèm món gì, tìm liền nhé...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex w-full items-center">
      <div className="group flex h-12 w-full items-center gap-3 rounded-full bg-surface-container-lowest/90 backdrop-blur-md px-4.5 border border-outline-variant/80 shadow-card transition-all duration-300 focus-within:border-primary focus-within:shadow-card-hover focus-within:ring-2 focus-within:ring-primary/20">
        <input
          type="search"
          inputMode="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Tìm món"
          className="w-full border-none bg-transparent text-body-md font-medium text-on-surface outline-none placeholder:text-on-surface-variant/60 [&::-webkit-search-cancel-button]:hidden"
        />
        <AnimatePresence mode="wait" initial={false}>
          {value.length > 0 ? (
            <motion.button
              key="clear"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 0.85 }}
              type="button"
              onClick={() => onChange("")}
              aria-label="Xoá từ khoá"
              className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors hover:bg-inverse-surface hover:text-inverse-on-surface"
            >
              <X size={15} strokeWidth={2.5} />
            </motion.button>
          ) : (
            <motion.span
              key="icon"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="grid size-7 shrink-0 place-items-center"
            >
              <Search
                size={20}
                aria-hidden="true"
                className="shrink-0 text-on-surface-variant transition-colors group-focus-within:text-primary"
                strokeWidth={2.4}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
