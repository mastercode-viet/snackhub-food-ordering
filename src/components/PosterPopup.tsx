import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_KEY = "snackhub-poster-seen";

export default function PosterPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore
    }
    // Slight delay so the page renders first.
    const t = window.setTimeout(() => setOpen(true), 300);
    return () => window.clearTimeout(t);
  }, []);

  function close() {
    setOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="relative max-h-[90vh] max-w-[95vw] md:max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Đóng"
              className="absolute -right-2 -top-2 z-10 grid size-9 place-items-center rounded-full bg-surface-container-lowest text-on-surface shadow-card border border-outline-variant transition hover:bg-surface-container-high"
            >
              <X size={18} strokeWidth={2.4} />
            </button>
            <img
              src="/poster.png"
              alt="Poster SnackHub"
              className="max-h-[85vh] w-auto max-w-full rounded-card-lg object-contain shadow-sheet"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}