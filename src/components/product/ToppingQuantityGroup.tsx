import { Minus, Plus } from "lucide-react";
import { formatVnd } from "@/lib/format";
import type { OptionGroupData } from "@/components/product/OptionGroup";

export default function ToppingQuantityGroup({
  group,
  quantities,
  onChange,
}: {
  group: OptionGroupData;
  quantities: Record<string, number>;
  onChange: (optionId: string, quantity: number) => void;
}) {
  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-secondary" />
          <h2 className="truncate text-headline-sm font-bold text-on-surface">{group.name}</h2>
        </div>
        <span className="shrink-0 rounded-full bg-secondary-fixed/70 px-3 py-1 text-label-sm font-bold text-on-secondary-fixed">
          Tuỳ chọn
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {group.product_options.map((opt) => {
          const qty = quantities[opt.id] ?? 0;
          const disabled = !opt.is_available;
          const delta = Number(opt.price_delta);
          const maxQty = Math.max(0, Number(opt.max_quantity) > 1 ? Number(opt.max_quantity) : 99);
          return (
            <div
              key={opt.id}
              className="flex items-center justify-between gap-3 rounded-card p-3.5 border border-outline-variant/50 bg-surface-container-low/60"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-label-lg font-medium text-on-surface">{opt.name}</span>
                {delta !== 0 && (
                  <span className="text-body-sm font-bold text-primary">
                    {delta > 0 ? `+${formatVnd(delta)}` : `-${formatVnd(Math.abs(delta))}`}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={qty <= 0}
                  onClick={() => onChange(opt.id, Math.max(0, qty - 1))}
                  className="grid size-7 place-items-center rounded-full bg-surface-container-lowest text-on-surface shadow-card disabled:opacity-40"
                >
                  <Minus size={13} strokeWidth={3} />
                </button>
                <span className="min-w-[14px] px-1 text-center text-label-md font-bold text-on-surface">{qty}</span>
                <button
                  type="button"
                  disabled={disabled || qty >= maxQty}
                  onClick={() => onChange(opt.id, qty + 1)}
                  className="grid size-7 place-items-center rounded-full bg-inverse-surface text-inverse-on-surface shadow-cta disabled:opacity-40"
                >
                  <Plus size={13} strokeWidth={3} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}