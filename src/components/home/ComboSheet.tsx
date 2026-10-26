import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import ComboDetailPage from "@/pages/ComboDetailPage";

export default function ComboSheet({ slug, onClose }: { slug: string; onClose: () => void }) {
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[71] bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="fixed inset-x-0 bottom-0 z-[72] max-h-[90dvh] overflow-y-auto rounded-t-sheet bg-background shadow-sheet md:inset-0 md:m-auto md:h-fit md:max-w-2xl md:rounded-sheet"
      >
        <div className="flex justify-end p-3">
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full border border-outline-variant">
            <X size={18} />
          </button>
        </div>
        <ComboDetailPage slug={slug} onClose={onClose} />
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}