import { useState } from "react";
import {
  ChevronRight,
  Coins,
  Percent,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { toast } from "@/store/toast";
import { formatVnd } from "@/lib/format";
import { FormField, LabeledSwitch, MoneyInput, Toggle, inputClass } from "@/components/admin/AdminForm";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { BulkDeleteBar, SelectCheckbox, useBulkSelection } from "@/components/admin/BulkSelect";
import {
  createDiscountCode,
  deleteDiscountCode,
  fetchAdminDiscountCodes,
  setDiscountCodeActive,
  updateDiscountCode,
  type AdminDiscountCode,
  type DiscountCodeFormValues,
} from "@/lib/adminQueries";

type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

/**
 * Quản lý mã giảm giá (Voucher / Coupon).
 *
 * Kiểm soát điều kiện áp dụng (đơn tối thiểu, trần giảm tối đa, thời hạn hiệu lực,
 * giới hạn lượt dùng) và kiểm soát lượt dùng thực tế qua atomic update `used_count`.
 */
export default function AdminDiscountCodesPage() {
  const state = useAsync(fetchAdminDiscountCodes, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const run: RunFn = async (action, okMessage) => {
    try {
      await action();
      toast.success(okMessage);
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    }
  };

  const discountCodes = state.data ?? [];
  const editing = discountCodes.find((d) => d.id === editingId) ?? null;

  const filtered = discountCodes.filter((d) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return d.code.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q));
  });

  const activeCount = discountCodes.filter((d) => d.is_active).length;
  const bulk = useBulkSelection(filtered.map((d) => d.id));

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Mã giảm giá</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Tag size={19} strokeWidth={2.4} />
            </span>
            <h1 className="text-headline-sm text-on-surface">Mã giảm giá & Khuyến mãi</h1>
          </div>
          <p className="mt-1 max-w-[60ch] text-body-sm text-on-surface-variant">
            Tạo voucher/coupon theo phần trăm hoặc số tiền cố định, thiết lập điều kiện đơn tối
            thiểu, trần giảm và kiểm soát hạn mức lượt sử dụng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-primary-container px-4 text-label-lg text-on-primary-container shadow-cta transition-opacity hover:opacity-90"
        >
          <Plus size={17} strokeWidth={2.4} />
          Tạo mã mới
        </button>
      </header>

      {state.loading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
          <section className="flex min-w-0 flex-1 flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-3">
              <p className="text-label-sm text-on-surface-variant">
                {discountCodes.length} mã · {activeCount} đang kích hoạt
              </p>

              <input
                type="search"
                placeholder="Tìm mã hoặc mô tả…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full max-w-xs rounded-full border border-outline-variant bg-surface-container-low px-3.5 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon="🏷️"
                title={search ? "Không tìm thấy mã nào" : "Chưa có mã giảm giá nào"}
                description={
                  search
                    ? "Thử tìm với từ khoá khác."
                    : "Bấm 'Tạo mã mới' để tung chương trình khuyến mãi đầu tiên."
                }
              />
            ) : (
              <>
                <BulkDeleteBar
                  selection={bulk}
                  items={filtered}
                  noun="mã"
                  nameOf={(d) => d.code}
                  deleteOne={(d) => deleteDiscountCode(d.id)}
                  onDone={() => {
                    setEditingId(null);
                    state.reload();
                  }}
                />
                <ul className="flex flex-col divide-y divide-outline-variant/60">
                  {filtered.map((item) => (
                    <DiscountCodeRow
                      key={item.id}
                      item={item}
                      active={item.id === editingId}
                      checked={bulk.isSelected(item.id)}
                      onCheck={() => bulk.toggle(item.id)}
                      onSelect={() => {
                        setCreating(false);
                        setEditingId(item.id);
                      }}
                      onToggle={(on) =>
                        run(
                          () => setDiscountCodeActive(item.id, on),
                          on ? `Đã kích hoạt mã ${item.code}.` : `Đã tắt mã ${item.code}.`,
                        )
                      }
                    />
                  ))}
                </ul>
              </>
            )}
          </section>

          {(creating || editing) && (
            <div className="w-full shrink-0 xl:max-w-md">
              <DiscountCodeForm
                key={editing?.id ?? "new"}
                item={editing ?? undefined}
                onClose={() => {
                  setCreating(false);
                  setEditingId(null);
                }}
                onRun={run}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiscountCodeRow({
  item,
  active,
  checked,
  onCheck,
  onSelect,
  onToggle,
}: {
  item: AdminDiscountCode;
  active: boolean;
  checked: boolean;
  onCheck: () => void;
  onSelect: () => void;
  onToggle: (on: boolean) => void;
}) {
  const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
  const isLimitReached = item.max_uses !== null && item.used_count >= item.max_uses;

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <SelectCheckbox checked={checked} onChange={onCheck} label={`Chọn mã ${item.code}`} />
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-h-[44px] min-w-0 flex-1 items-start gap-3 rounded-card p-2 text-left transition-colors ${
          active ? "bg-surface-container" : "hover:bg-surface-container-low"
        }`}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-card bg-surface-container text-primary">
          {item.type === "percent" ? (
            <Percent size={20} strokeWidth={2.4} />
          ) : (
            <Coins size={20} strokeWidth={2.4} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-label-lg font-bold tracking-wider text-on-surface">
              {item.code}
            </span>

            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-label-xs font-bold text-primary">
              {item.type === "percent" ? `Giảm ${item.value}%` : `Giảm ${formatVnd(item.value)}`}
            </span>

            {isExpired && (
              <span className="rounded-full bg-error-container px-2 py-0.5 text-label-xs font-semibold text-on-error-container">
                Hết hạn
              </span>
            )}

            {isLimitReached && (
              <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-xs font-semibold text-on-surface-variant">
                Hết lượt
              </span>
            )}
          </div>

          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-body-sm text-on-surface-variant">
              {item.description}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-xs text-on-surface-variant">
            <span>Đơn từ: {formatVnd(item.min_order_amount)}</span>
            {item.type === "percent" && item.max_discount_amount && (
              <span>Tối đa: {formatVnd(item.max_discount_amount)}</span>
            )}
            <span>
              Đã dùng:{" "}
              <strong className="text-on-surface">
                {item.used_count}
                {item.max_uses !== null ? ` / ${item.max_uses}` : " (không giới hạn)"}
              </strong>
            </span>
          </div>
        </div>
      </button>

      <div className="mt-1.5">
        <LabeledSwitch
          on={item.is_active}
          onChange={() => onToggle(!item.is_active)}
          onLabel="Kích hoạt"
          offLabel="Đang tắt"
        />
      </div>
    </li>
  );
}

function DiscountCodeForm({
  item,
  onClose,
  onRun,
}: {
  item?: AdminDiscountCode;
  onClose: () => void;
  onRun: RunFn;
}) {
  const isNew = !item;

  const [values, setValues] = useState<DiscountCodeFormValues>({
    code: item?.code ?? "",
    description: item?.description ?? "",
    type: item?.type ?? "percent",
    value: item?.value ?? 10,
    min_order_amount: item?.min_order_amount ?? 0,
    max_discount_amount: item?.max_discount_amount ?? null,
    max_uses: item?.max_uses ?? null,
    starts_at: item?.starts_at ? item.starts_at.slice(0, 16) : "",
    expires_at: item?.expires_at ? item.expires_at.slice(0, 16) : "",
    is_active: item?.is_active ?? true,
  });

  function set<K extends keyof DiscountCodeFormValues>(key: K, value: DiscountCodeFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function submit() {
    const code = values.code.trim().toUpperCase();
    if (!code) {
      toast.error("Mã giảm giá không được để trống.");
      return;
    }
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      toast.error("Mã chỉ gồm chữ cái in hoa, số, gạch nối (2-30 ký tự).");
      return;
    }
    if (values.value <= 0) {
      toast.error("Mức giảm phải lớn hơn 0.");
      return;
    }
    if (values.type === "percent" && values.value > 100) {
      toast.error("Giảm theo % không được vượt quá 100%.");
      return;
    }

    const payload: DiscountCodeFormValues = {
      ...values,
      code,
      description: values.description?.trim() || null,
      max_discount_amount: values.type === "percent" && values.max_discount_amount ? values.max_discount_amount : null,
      max_uses: values.max_uses ? values.max_uses : null,
      starts_at: values.starts_at ? new Date(values.starts_at).toISOString() : null,
      expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
    };

    if (isNew) {
      void onRun(() => createDiscountCode(payload), `Đã tạo mã ${code}.`).then(onClose);
    } else {
      void onRun(() => updateDiscountCode(item.id, payload), `Đã lưu thay đổi mã ${code}.`);
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-2 border-b border-outline-variant/60 pb-3">
        <div>
          <h2 className="text-label-lg font-bold text-on-surface">
            {isNew ? "Tạo mã giảm giá mới" : `Sửa mã: ${item.code}`}
          </h2>
          <p className="text-label-xs text-on-surface-variant">
            {isNew ? "Thiết lập điều kiện áp dụng cho voucher" : `Đã dùng ${item.used_count} lần`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="inline-flex size-10 items-center justify-center rounded-card text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>

      <FormField label="Mã Voucher / Coupon" hint="Viết hoa liền không dấu, ví dụ: SNACKHUB20, FREESHIP">
        <input
          value={values.code}
          placeholder="VD: BANHMI10"
          onChange={(e) => set("code", e.target.value.toUpperCase())}
          className={`${inputClass} font-mono uppercase`}
        />
      </FormField>

      <FormField label="Mô tả chương trình" hint="Khách sẽ thấy dòng này khi áp mã thành công">
        <input
          value={values.description ?? ""}
          placeholder="VD: Giảm 20k cho đơn từ 60k"
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <label className="text-label-md text-on-surface">Loại giảm giá</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => set("type", "percent")}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border text-label-md font-semibold transition-all ${
              values.type === "percent"
                ? "border-primary bg-primary-container text-on-primary-container shadow-sm"
                : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <Percent size={16} strokeWidth={2.4} />
            Theo phần trăm (%)
          </button>
          <button
            type="button"
            onClick={() => set("type", "fixed")}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border text-label-md font-semibold transition-all ${
              values.type === "fixed"
                ? "border-primary bg-primary-container text-on-primary-container shadow-sm"
                : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            <Coins size={16} strokeWidth={2.4} />
            Số tiền cố định (đ)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={values.type === "percent" ? "Mức giảm (%)" : "Số tiền giảm (đ)"}
          hint={values.type === "percent" ? "Từ 1 đến 100" : "VD: 15000"}
        >
          {values.type === "percent" ? (
            <input
              inputMode="numeric"
              value={String(values.value)}
              onChange={(e) => set("value", Number(e.target.value.replace(/\D/g, "")) || 0)}
              className={inputClass}
            />
          ) : (
            <MoneyInput value={values.value} onChange={(v) => set("value", v)} />
          )}
        </FormField>

        {values.type === "percent" ? (
          <FormField label="Giảm tối đa (đ)" hint="Để 0 = không trần">
            <MoneyInput
              value={values.max_discount_amount ?? 0}
              onChange={(v) => set("max_discount_amount", v || null)}
            />
          </FormField>
        ) : (
          <FormField label="Đơn tối thiểu (đ)" hint="0 = không yêu cầu">
            <MoneyInput
              value={values.min_order_amount}
              onChange={(v) => set("min_order_amount", v)}
            />
          </FormField>
        )}
      </div>

      {values.type === "percent" && (
        <FormField label="Đơn tối thiểu (đ)" hint="Giá trị giỏ hàng trước khi được áp mã">
          <MoneyInput value={values.min_order_amount} onChange={(v) => set("min_order_amount", v)} />
        </FormField>
      )}

      <FormField
        label="Giới hạn tổng lượt dùng"
        hint="Để trống hoặc 0 nếu không giới hạn số lần sử dụng"
      >
        <input
          inputMode="numeric"
          placeholder="Không giới hạn"
          value={values.max_uses ? String(values.max_uses) : ""}
          onChange={(e) => set("max_uses", Number(e.target.value.replace(/\D/g, "")) || null)}
          className={inputClass}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Bắt đầu từ" hint="Bỏ trống = áp dụng ngay">
          <input
            type="datetime-local"
            value={values.starts_at ?? ""}
            onChange={(e) => set("starts_at", e.target.value)}
            className={inputClass}
          />
        </FormField>

        <FormField label="Hết hạn lúc" hint="Bỏ trống = không hết hạn">
          <input
            type="datetime-local"
            value={values.expires_at ?? ""}
            onChange={(e) => set("expires_at", e.target.value)}
            className={inputClass}
          />
        </FormField>
      </div>

      <Toggle
        label="Đang kích hoạt"
        hint="Tắt để tạm ngưng cho phép áp dụng mã này"
        on={values.is_active}
        onChange={(v) => set("is_active", v)}
      />

      <button
        type="button"
        onClick={submit}
        className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99]"
      >
        {isNew ? "Tạo mã giảm giá" : "Lưu thay đổi"}
      </button>

      {!isNew && (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Bạn có chắc chắn muốn xoá mã ${item.code}?`)) return;
            onClose();
            void onRun(() => deleteDiscountCode(item.id), `Đã xoá mã ${item.code}.`);
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant text-label-md text-error transition-colors hover:bg-error-container"
        >
          <Trash2 size={16} strokeWidth={2.2} />
          Xoá mã khuyến mãi này
        </button>
      )}
    </section>
  );
}
