import { ChevronLeft, ChevronRight } from "lucide-react";

/** Các số trang hiển thị: luôn có trang đầu/cuối, quanh trang hiện tại ±1, chỗ hụt là "…". */
function pageItems(page: number, pageCount: number): Array<number | "gap"> {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/** Thanh phân trang: "Đơn 21–40 / 135" + nút trước/sau + số trang. Ẩn khi chỉ có 1 trang. */
export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
  noun = "đơn",
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  noun?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const btn =
    "grid min-h-[40px] min-w-[40px] place-items-center rounded-card px-2 text-label-md transition-colors disabled:opacity-40";

  return (
    <nav
      aria-label="Phân trang"
      className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant pt-3"
    >
      <p className="text-label-md text-on-surface-variant">
        {noun.charAt(0).toUpperCase() + noun.slice(1)} {first}–{last} / {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
          className={`${btn} border border-outline-variant text-on-surface hover:bg-surface-container`}
        >
          <ChevronLeft size={16} strokeWidth={2.4} />
        </button>
        {pageItems(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-label-md text-on-surface-variant">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`${btn} ${
                p === page
                  ? "bg-inverse-surface font-semibold text-inverse-on-surface"
                  : "border border-outline-variant text-on-surface hover:bg-surface-container"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Trang sau"
          className={`${btn} border border-outline-variant text-on-surface hover:bg-surface-container`}
        >
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </nav>
  );
}
