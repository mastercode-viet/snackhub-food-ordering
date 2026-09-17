import { Check } from "lucide-react";
import { motion } from "motion/react";
import { formatVnd } from "@/lib/format";
import type { Tables } from "@/types/database";

export type OptionGroupData = Tables<"product_option_groups"> & {
  product_options: Tables<"product_options">[];
};

function deltaLabel(delta: number): string | null {
  if (delta === 0) return null;
  return delta > 0 ? `+${formatVnd(delta)}` : `-${formatVnd(Math.abs(delta))}`;
}

function badgeText(group: OptionGroupData): string {
  const min = Math.max(1, group.min_select);
  if (group.is_required) {
    return min === group.max_select ? `Chọn ${min}` : `Chọn ${min}–${group.max_select}`;
  }
  return group.max_select > 1 ? `Tối đa ${group.max_select}` : "Tuỳ chọn";
}

export default function OptionGroup({
  group,
  selected,
  onChange,
}: {
  group: OptionGroupData;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const single = group.max_select === 1;
  const atMax = selected.length >= group.max_select;

  function toggle(optionId: string) {
    if (single) {
      onChange([optionId]);
      return;
    }
    if (selected.includes(optionId)) {
      onChange(selected.filter((id) => id !== optionId));
    } else if (!atMax) {
      onChange([...selected, optionId]);
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card border border-outline-variant/40">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${
              group.is_required ? "bg-primary-container" : "bg-secondary"
            }`}
          />
          <h2 className="truncate text-headline-sm font-bold text-on-surface">{group.name}</h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-label-sm font-bold ${
            group.is_required
              ? "bg-surface-container-high text-on-surface-variant"
              : "bg-secondary-fixed/70 text-on-secondary-fixed"
          }`}
        >
          {badgeText(group)}
        </span>
      </div>

      {single ? (
        <div
          role="radiogroup"
          aria-label={group.name}
          className={`grid gap-2.5 ${group.product_options.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}
        >
          {group.product_options.map((opt) => {
            const active = selected.includes(opt.id);
            const disabled = !opt.is_available;
            const delta = deltaLabel(Number(opt.price_delta));

            return (
              <motion.button
                key={opt.id}
                whileHover={disabled ? {} : { scale: 1.02 }}
                whileTap={disabled ? {} : { scale: 0.95 }}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => toggle(opt.id)}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-card p-3.5 text-center transition-all disabled:opacity-40 ${
                  active
                    ? "bg-inverse-surface text-inverse-on-surface shadow-cta font-semibold"
                    : "bg-surface-container-low/80 text-on-surface-variant border border-outline-variant/60 hover:bg-surface-container"
                }`}
              >
                <span className="text-label-md leading-tight">{opt.name}</span>
                {disabled ? (
                  <span className="text-body-sm opacity-70">Tạm hết</span>
                ) : (
                  delta && (
                    <span className={`text-body-sm font-bold ${active ? "text-primary-fixed-dim" : "text-primary"}`}>
                      {delta}
                    </span>
                  )
                )}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {group.product_options.map((opt) => {
            const active = selected.includes(opt.id);
            const disabled = !opt.is_available || (atMax && !active);
            const delta = deltaLabel(Number(opt.price_delta));

            return (
              <motion.label
                key={opt.id}
                whileTap={disabled ? {} : { scale: 0.98 }}
                className={`flex items-center justify-between gap-3 rounded-card p-3.5 border transition-all ${
                  active
                    ? "border-primary/50 bg-surface-container/90 shadow-sm"
                    : "border-outline-variant/50 bg-surface-container-low/60 hover:bg-surface-container-low"
                } ${disabled ? "opacity-50" : "cursor-pointer"}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={active}
                    disabled={disabled}
                    onChange={() => toggle(opt.id)}
                  />
                  <span
                    aria-hidden="true"
                    className={`grid size-5 shrink-0 place-items-center rounded-md border-2 transition-all ${
                      active
                        ? "border-primary bg-primary text-on-primary shadow-badge"
                        : "border-outline-variant bg-surface-container-lowest"
                    }`}
                  >
                    {active && <Check size={13} strokeWidth={4} />}
                  </span>
                  <span className="truncate text-label-lg font-medium text-on-surface">{opt.name}</span>
                </span>

                <span className="shrink-0 text-label-md font-bold text-primary">
                  {!opt.is_available ? (
                    <span className="text-on-surface-variant">Tạm hết</span>
                  ) : (
                    delta
                  )}
                </span>
              </motion.label>
            );
          })}
        </div>
      )}
    </section>
  );
}
