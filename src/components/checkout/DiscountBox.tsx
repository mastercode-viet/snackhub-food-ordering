import { useState } from "react";
import { CheckCircle2, Ticket, X } from "lucide-react";
import { ApiError, applyDiscount, type DiscountPreview } from "@/lib/api";
import { formatVnd } from "@/lib/format";

/**
 * Áp mã giảm giá.
 *
 * Nút "Áp dụng" gọi Edge Function `apply-discount` — hàm đó chỉ XEM TRƯỚC
 * mức giảm, không tiêu lượt. Lượt chỉ bị trừ khi đơn thực sự được tạo, nên
 * khách bấm thử bao nhiêu lần cũng không đốt quota của mã.
 *
 * Bản Stitch có thêm "Chọn mã khác" mở danh sách mã đang có — bỏ, vì
 * `discount_codes` không cho khách đọc (chống dò mã), và cũng không có khái
 * niệm mã đã lưu theo từng khách.
 */
export default function DiscountBox({
  subtotal,
  applied,
  onApplied,
  onCleared,
}: {
  subtotal: number;
  applied: DiscountPreview | null;
  onApplied: (preview: DiscountPreview) => void;
  onCleared: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = code.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    try {
      const preview = await applyDiscount(value, subtotal);
      onApplied(preview);
      setCode("");
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Không áp được mã, vui lòng thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-secondary-fixed/50 p-3.5">
        <CheckCircle2 size={20} className="shrink-0 text-secondary" strokeWidth={2.4} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-lg text-on-secondary-fixed">{applied.code}</p>
          <p className="text-body-sm text-on-secondary-fixed-variant">
            Đã giảm {formatVnd(applied.discount_amount)} 🎉
          </p>
        </div>
        <button
          type="button"
          onClick={onCleared}
          aria-label="Bỏ mã giảm giá"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-container-lowest text-on-surface-variant"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-12 flex-1 items-center gap-2.5 rounded-2xl bg-surface-container-low/70 px-4 transition-all focus-within:ring-2 focus-within:ring-on-surface">
          <Ticket size={18} className="shrink-0 text-on-surface-variant" strokeWidth={2.2} />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={50}
            placeholder="Nhập mã giảm giá"
            aria-label="Mã giảm giá"
            className="w-full bg-transparent text-body-md uppercase tracking-wide text-on-surface outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-on-surface-variant/50"
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!code.trim() || busy}
          className="h-12 shrink-0 rounded-2xl bg-inverse-surface px-5 text-label-md text-inverse-on-surface shadow-cta transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none disabled:active:scale-100"
        >
          {busy ? "Đang kiểm…" : "Áp dụng"}
        </button>
      </div>

      {error && <p className="px-1 text-body-sm text-error">{error}</p>}
    </div>
  );
}
