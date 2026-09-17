import { Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-full bg-surface-container/80 p-1 border border-outline-variant/50 shadow-inner">
      <motion.button
        whileTap={{ scale: 0.85 }}
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Giảm số lượng"
        className="grid size-9 place-items-center rounded-full bg-surface-container-lowest text-on-surface shadow-card transition-colors hover:bg-surface-container-high disabled:opacity-40 disabled:shadow-none"
      >
        <Minus size={16} strokeWidth={2.8} />
      </motion.button>

      <span aria-live="polite" className="w-9 text-center text-headline-sm font-bold text-on-surface">
        <AnimatePresence mode="wait">
          <motion.span
            key={value}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-block"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>

      <motion.button
        whileTap={{ scale: 0.85 }}
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Tăng số lượng"
        className="grid size-9 place-items-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-cta transition-colors hover:opacity-90 disabled:opacity-40 disabled:shadow-none"
      >
        <Plus size={16} strokeWidth={2.8} />
      </motion.button>
    </div>
  );
}
