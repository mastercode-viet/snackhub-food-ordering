import { formatVnd } from "@/lib/format";
import type { OptionGroupData } from "@/components/product/OptionGroup";

/**
 * Nhóm "size" của đồ uống (dữ liệu thật: nhóm topping "Up size", "Up size Miu
 * lê dầm"… với lựa chọn "Size L"). Đây là chọn MỘT, không phải topping cộng
 * dồn — render bằng con số +/- sẽ cho khách chọn 3 lần "Size L".
 *
 * Nhận diện theo tên nhóm vì schema chưa có cờ riêng cho nhóm size. Nhóm
 * option lẻ ("Size" tạo trong Admin → Biến thể món) phải là price_mode
 * "delta": nhóm "replace" đã thay giá gốc và có màn hình chọn riêng.
 */
export function isSizeGroup(group: OptionGroupData): boolean {
  if (group.source !== "topping" && group.price_mode !== "delta") return false;
  if (group.name) {
    if (/up\s*size|size|kích\s*cỡ|cỡ/i.test(group.name)) return true;
  }
  return (
    group.product_options.length > 0 &&
    group.product_options.every((o) => /\bsize\b/i.test(o.name))
  );
}

/** Nhóm đã có sẵn lựa chọn "M" thì không vẽ thêm M mặc định. */
function hasBaseSize(group: OptionGroupData): boolean {
  return group.product_options.some((o) => /\bm\b/i.test(o.name));
}

/** "Size L" → "L", để hiển thị gọn "M / L" cạnh tên món nước. */
export function sizeOptionLabel(name: string): string {
  return name.replace(/^size\s*/i, "").trim() || name;
}

/** Nhãn size hiển thị cạnh tên đồ uống, ví dụ ["M", "L"]. */
export function sizeGroupLabels(group: OptionGroupData): string[] {
  const sizes = group.product_options.map((o) => sizeOptionLabel(o.name));
  return hasBaseSize(group) ? sizes : ["M", ...sizes];
}

/**
 * Chọn size cho đồ uống. M (vừa) là mặc định, không phát sinh phụ phí; các
 * size khác cộng đúng price_delta của lựa chọn trong DB.
 */
export default function SizeGroup({
  group,
  selected,
  quantities,
  onSelect,
}: {
  group: OptionGroupData;
  /** Nhóm option "Size" (product_option_groups): id đang được chọn. */
  selected?: string[];
  /** Nhóm topping "Up size": lựa chọn nằm ở số lượng (> 0 là đang chọn). */
  quantities?: Record<string, number>;
  onSelect: (optionId: string | null) => void;
}) {
  const selectedId =
    group.source === "topping"
      ? group.product_options.find((o) => (quantities?.[o.id] ?? 0) > 0)?.id ?? null
      : selected?.[0] ?? null;
  const showDefault = !hasBaseSize(group);

  return (
    <section className="flex flex-col gap-space-sm rounded-card-lg bg-surface-container-lowest p-4 shadow-card border border-outline-variant/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-secondary" />
          <h3 className="truncate text-headline-sm font-bold text-on-surface">{group.name}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-secondary-fixed/70 px-3 py-1 text-label-sm font-bold text-on-secondary-fixed">
          Chọn 1
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={group.name}
        className={`grid gap-2 ${showDefault ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {showDefault && (
          <button
            type="button"
            role="radio"
            aria-checked={selectedId === null}
            onClick={() => onSelect(null)}
            className={`flex flex-col items-center justify-center gap-1 rounded-card p-3 text-center transition-all ${
              selectedId === null
                ? "bg-inverse-surface text-inverse-on-surface shadow-cta font-semibold"
                : "bg-surface-container-low/80 text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container"
            }`}
          >
            <span className="text-label-md leading-tight">M (vừa)</span>
            <span className="text-body-sm opacity-80">Mặc định</span>
          </button>
        )}

        {group.product_options.map((opt) => {
          const active = selectedId === opt.id;
          const disabled = !opt.is_available;
          const delta = Number(opt.price_delta);
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onSelect(opt.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-card p-3 text-center transition-all disabled:opacity-40 ${
                active
                  ? "bg-inverse-surface text-inverse-on-surface shadow-cta font-semibold"
                  : "bg-surface-container-low/80 text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container"
              }`}
            >
              <span className="text-label-md leading-tight">{sizeOptionLabel(opt.name)}</span>
              {disabled ? (
                <span className="text-body-sm opacity-70">Tạm hết</span>
              ) : (
                delta !== 0 && (
                  <span
                    className={`text-body-sm font-bold ${
                      active ? "text-primary-fixed-dim" : "text-primary"
                    }`}
                  >
                    +{formatVnd(delta)}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
