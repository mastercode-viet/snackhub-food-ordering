import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ChevronRight,
  Flame,
  ImagePlus,
  Minus,
  Package,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { toast } from "@/store/toast";
import { formatVnd } from "@/lib/format";
import { toSlug } from "@/lib/text";
import ProductImage from "@/components/product/ProductImage";
import { FormField, LabeledSwitch, MoneyInput, Toggle, inputClass } from "@/components/admin/AdminForm";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  createCombo,
  deleteCombo,
  fetchAdminCombos,
  fetchAdminProducts,
  setComboAvailability,
  setComboFeatured,
  updateCombo,
  uploadProductImage,
  type AdminCombo,
  type AdminProduct,
  type ComboFormValues,
  type ComboItemInput,
} from "@/lib/adminQueries";

type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

/**
 * Quản lý Combo món ăn (gộp nhiều món đơn lẻ với giá ưu đãi).
 *
 * Đồng bộ trực tiếp với `ComboRail` trên trang chủ và logic giỏ hàng `kind: "combo"`.
 */
export default function AdminCombosPage() {
  const state = useAsync(fetchAdminCombos, []);
  const productsState = useAsync(fetchAdminProducts, []);
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

  const combos = state.data ?? [];
  const allProducts = productsState.data ?? [];
  const editing = combos.find((c) => c.id === editingId) ?? null;

  const filtered = combos.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q));
  });

  const availableCount = combos.filter((c) => c.is_available).length;

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Combo</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Package size={19} strokeWidth={2.4} />
            </span>
            <h1 className="text-headline-sm text-on-surface">Thiết lập Combo ăn vặt</h1>
          </div>
          <p className="mt-1 max-w-[60ch] text-body-sm text-on-surface-variant">
            Tạo các gói combo gộp nhiều món kèm ảnh riêng và mức giá ưu đãi. Danh sách hiển
            thị trực tiếp tại dải Combo trên trang chủ.
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
          Tạo combo mới
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
                {combos.length} combo · {availableCount} đang mở bán
              </p>

              <input
                type="search"
                placeholder="Tìm combo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full max-w-xs rounded-full border border-outline-variant bg-surface-container-low px-3.5 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon="🍱"
                title={search ? "Không tìm thấy combo nào" : "Chưa có combo nào"}
                description={
                  search
                    ? "Thử tìm với từ khoá khác."
                    : "Bấm 'Tạo combo mới' để thiết lập set ăn đầu tiên cho quán."
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant/60">
                {filtered.map((combo) => (
                  <ComboRow
                    key={combo.id}
                    combo={combo}
                    active={combo.id === editingId}
                    onSelect={() => {
                      setCreating(false);
                      setEditingId(combo.id);
                    }}
                    onToggleAvailable={(on) =>
                      run(
                        () => setComboAvailability(combo.id, on),
                        on ? `Đã mở bán "${combo.name}".` : `Đã tắt mở bán "${combo.name}".`,
                      )
                    }
                    onToggleFeatured={(on) =>
                      run(
                        () => setComboFeatured(combo.id, on),
                        on ? `Đã đặt "${combo.name}" làm nổi bật.` : `Đã bỏ nổi bật "${combo.name}".`,
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          {(creating || editing) && (
            <div className="w-full shrink-0 xl:max-w-md">
              <ComboForm
                key={editing?.id ?? "new"}
                combo={editing ?? undefined}
                products={allProducts}
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

function ComboRow({
  combo,
  active,
  onSelect,
  onToggleAvailable,
  onToggleFeatured,
}: {
  combo: AdminCombo;
  active: boolean;
  onSelect: () => void;
  onToggleAvailable: (on: boolean) => void;
  onToggleFeatured: (on: boolean) => void;
}) {
  const originalTotal = combo.combo_items.reduce(
    (acc, item) => acc + (item.products?.base_price ?? 0) * item.quantity,
    0,
  );
  const savings = originalTotal > combo.price ? originalTotal - combo.price : 0;
  const savingsPercent =
    originalTotal > 0 && originalTotal > combo.price
      ? Math.round(((originalTotal - combo.price) / originalTotal) * 100)
      : 0;

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-h-[44px] min-w-0 flex-1 items-start gap-3 rounded-card p-2 text-left transition-colors ${
          active ? "bg-surface-container" : "hover:bg-surface-container-low"
        }`}
      >
        <ProductImage
          src={combo.image_url}
          alt={combo.name}
          fallbackIcon="🍱"
          className="size-16 shrink-0 rounded-card-sm"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-label-lg font-bold text-on-surface">{combo.name}</h3>

            {combo.is_featured && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary-fixed px-2 py-0.5 text-label-xs font-bold text-on-secondary-fixed">
                <Flame size={12} strokeWidth={2.4} />
                Nổi bật
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {combo.combo_items.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center rounded-full bg-surface-container px-2 py-0.5 text-label-xs font-semibold text-on-surface-variant"
              >
                {item.quantity > 1 ? `${item.quantity}x ` : ""}
                {item.products?.name ?? "Món đã xoá"}
              </span>
            ))}
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
            <span className="text-label-lg font-extrabold text-primary">
              {formatVnd(combo.price)}
            </span>

            {originalTotal > combo.price && (
              <>
                <span className="text-label-sm text-on-surface-variant line-through">
                  {formatVnd(originalTotal)}
                </span>
                <span className="rounded bg-primary-fixed/60 px-1.5 py-0.2 text-label-xs font-bold text-on-primary-fixed">
                  Tiết kiệm {formatVnd(savings)} ({savingsPercent}%)
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
        <LabeledSwitch
          on={combo.is_available}
          onChange={() => onToggleAvailable(!combo.is_available)}
          onLabel="Đang bán"
          offLabel="Tạm hết"
        />

        <motion.button
          type="button"
          onClick={() => onToggleFeatured(!combo.is_featured)}
          title={combo.is_featured ? "Đang nổi bật" : "Bấm để ghim nổi bật"}
          animate={{ scale: combo.is_featured ? 1.08 : 1 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className={`inline-flex size-8 items-center justify-center rounded-full border transition-colors ${
            combo.is_featured
              ? "border-amber-500 bg-amber-50 text-amber-600"
              : "border-outline-variant bg-transparent text-outline hover:text-on-surface"
          }`}
        >
          <Flame size={15} strokeWidth={2.4} />
        </motion.button>
      </div>
    </li>
  );
}

function ComboForm({
  combo,
  products,
  onClose,
  onRun,
}: {
  combo?: AdminCombo;
  products: AdminProduct[];
  onClose: () => void;
  onRun: RunFn;
}) {
  const isNew = !combo;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [values, setValues] = useState<ComboFormValues>({
    name: combo?.name ?? "",
    slug: combo?.slug ?? "",
    description: combo?.description ?? "",
    price: combo?.price ?? 45000,
    image_url: combo?.image_url ?? "",
    is_available: combo?.is_available ?? true,
    is_featured: combo?.is_featured ?? false,
    sort_order: combo?.sort_order ?? 0,
  });

  const [items, setItems] = useState<ComboItemInput[]>(
    combo?.combo_items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      sort_order: i.sort_order,
    })) ?? [],
  );

  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>("");

  function set<K extends keyof ComboFormValues>(key: K, value: ComboFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleNameChange(name: string) {
    setValues((v) => ({
      ...v,
      name,
      slug: isNew || v.slug === toSlug(v.name) ? toSlug(name) : v.slug,
    }));
  }

  async function onPickImage(file: File) {
    setUploading(true);
    try {
      set("image_url", await uploadProductImage(file));
      toast.success("Đã tải ảnh lên.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải ảnh thất bại.");
    } finally {
      setUploading(false);
    }
  }

  function addItem(productId: string) {
    if (!productId) return;
    const existing = items.find((i) => i.product_id === productId);
    if (existing) {
      setItems(items.map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i)));
    } else {
      setItems([...items, { product_id: productId, quantity: 1, sort_order: items.length }]);
    }
    setSelectedProductToAdd("");
  }

  function updateItemQty(productId: string, delta: number) {
    setItems(
      items
        .map((i) => {
          if (i.product_id !== productId) return i;
          const nextQty = i.quantity + delta;
          return nextQty > 0 ? { ...i, quantity: nextQty } : null;
        })
        .filter((i): i is ComboItemInput => i !== null),
    );
  }

  function removeItem(productId: string) {
    setItems(items.filter((i) => i.product_id !== productId));
  }

  function submit() {
    const name = values.name.trim();
    if (!name) {
      toast.error("Tên combo không được để trống.");
      return;
    }
    if (values.price <= 0) {
      toast.error("Giá combo phải lớn hơn 0.");
      return;
    }
    if (items.length === 0) {
      toast.error("Combo phải có ít nhất 1 món ăn.");
      return;
    }

    const payload: ComboFormValues = {
      ...values,
      name,
      slug: values.slug.trim() || toSlug(name),
      description: values.description?.trim() || null,
      image_url: values.image_url?.trim() || null,
    };

    if (isNew) {
      void onRun(() => createCombo(payload, items), `Đã tạo combo "${name}".`).then(onClose);
    } else {
      void onRun(() => updateCombo(combo.id, payload, items), `Đã lưu combo "${name}".`);
    }
  }

  // Tính toán tổng giá gốc tạm tính của các món con đã chọn
  const originalSum = items.reduce((acc, item) => {
    const p = products.find((prod) => prod.id === item.product_id);
    return acc + (p?.base_price ?? 0) * item.quantity;
  }, 0);

  const formSavings = originalSum > values.price ? originalSum - values.price : 0;
  const formSavingsPercent =
    originalSum > 0 && originalSum > values.price
      ? Math.round(((originalSum - values.price) / originalSum) * 100)
      : 0;

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-2 border-b border-outline-variant/60 pb-3">
        <div>
          <h2 className="text-label-lg font-bold text-on-surface">
            {isNew ? "Tạo combo mới" : `Sửa combo: ${combo.name}`}
          </h2>
          <p className="text-label-xs text-on-surface-variant">
            {isNew ? "Gộp món và thiết lập giá bán ưu đãi" : "Cập nhật thông tin và danh sách món con"}
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

      <div className="flex items-center gap-3">
        <ProductImage
          src={values.image_url || null}
          alt={values.name}
          fallbackIcon="🍱"
          className="size-20 shrink-0 rounded-card-sm border border-outline-variant/60"
        />

        <div className="flex flex-col gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/webp,image/jpeg,image/png,image/avif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onPickImage(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex min-h-[38px] items-center gap-1.5 self-start rounded-card border border-outline-variant px-3 text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <ImagePlus size={15} strokeWidth={2.2} />
            {uploading ? "Đang tải…" : values.image_url ? "Đổi ảnh" : "Tải ảnh combo"}
          </button>
          <p className="text-label-xs text-on-surface-variant">Ảnh vuông hoặc ngang, tối đa 3MB.</p>
        </div>
      </div>

      <FormField label="Tên combo" hint="Ví dụ: Combo Trà Đào + Bánh Tráng, Set Căng Đét">
        <input
          value={values.name}
          placeholder="VD: Combo No Nê"
          onChange={(e) => handleNameChange(e.target.value)}
          className={inputClass}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Đường dẫn (slug)">
          <input
            value={values.slug}
            onChange={(e) => set("slug", toSlug(e.target.value))}
            className={inputClass}
          />
        </FormField>

        <FormField label="Giá bán combo (đ)" hint="Giá ưu đãi đã gộp món">
          <MoneyInput
            value={values.price}
            onChange={(v) => set("price", v)}
            inputClassName="font-bold text-primary"
          />
        </FormField>
      </div>

      {originalSum > 0 && (
        <div className="flex items-center justify-between rounded-card bg-surface-container-low px-3 py-2 text-label-xs">
          <span className="text-on-surface-variant">
            Tổng giá gốc các món: <strong>{formatVnd(originalSum)}</strong>
          </span>
          {formSavings > 0 ? (
            <span className="font-bold text-primary">
              Tiết kiệm: {formatVnd(formSavings)} ({formSavingsPercent}%)
            </span>
          ) : (
            <span className="text-on-surface-variant italic">Giá combo bằng hoặc cao hơn giá lẻ</span>
          )}
        </div>
      )}

      <FormField label="Mô tả combo" hint="Tóm tắt ngắn gọn các món có trong combo">
        <textarea
          rows={2}
          value={values.description ?? ""}
          placeholder="VD: Gồm 1 Trà đào cam sả cỡ lớn và 1 phần Bánh tráng cuộn bơ sốt me"
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </FormField>

      {/* Mục chọn món con cho Combo */}
      <div className="flex flex-col gap-2 rounded-card bg-surface-container-low p-3 border border-outline-variant/60">
        <div className="flex items-center justify-between">
          <span className="text-label-md font-bold text-on-surface">Món con trong Combo</span>
          <span className="text-label-xs text-secondary font-semibold">
            {items.length} món đã chọn
          </span>
        </div>

        {items.length === 0 ? (
          <p className="py-2 text-center text-label-sm text-on-surface-variant">
            Chưa có món nào. Vui lòng chọn món bên dưới để thêm vào combo.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/40">
            {items.map((item) => {
              const product = products.find((p) => p.id === item.product_id);
              return (
                <li key={item.product_id} className="flex items-center justify-between py-2">
                  <span className="text-body-sm font-medium text-on-surface">
                    {product?.name ?? "Món đã xoá"}
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-full border border-outline-variant bg-surface-container-lowest">
                      <button
                        type="button"
                        onClick={() => updateItemQty(item.product_id, -1)}
                        className="grid size-7 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
                      >
                        <Minus size={13} strokeWidth={2.4} />
                      </button>
                      <span className="w-6 text-center text-label-sm font-bold text-on-surface">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateItemQty(item.product_id, 1)}
                        className="grid size-7 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
                      >
                        <Plus size={13} strokeWidth={2.4} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.product_id)}
                      className="grid size-7 place-items-center rounded-full text-error hover:bg-error-container"
                    >
                      <Trash2 size={14} strokeWidth={2.2} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-outline-variant/40">
          <select
            value={selectedProductToAdd}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedProductToAdd(val);
              if (val) addItem(val);
            }}
            className={`${inputClass} text-body-sm`}
          >
            <option value="">+ Chọn món thêm vào combo…</option>
            {products
              .filter((p) => !items.some((i) => i.product_id === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Toggle
          label="Đang mở bán"
          hint="Tắt để tạm ẩn combo khỏi trang chủ"
          on={values.is_available}
          onChange={(v) => set("is_available", v)}
        />

        <Toggle
          label="Nổi bật (Featured)"
          hint="Ưu tiên đẩy lên đầu"
          on={values.is_featured}
          onChange={(v) => set("is_featured", v)}
        />
      </div>

      <FormField label="Thứ tự hiển thị" hint="Số nhỏ xếp trước">
        <input
          inputMode="numeric"
          value={String(values.sort_order)}
          onChange={(e) => set("sort_order", Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={inputClass}
        />
      </FormField>

      <button
        type="button"
        onClick={submit}
        disabled={uploading}
        className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg font-semibold text-inverse-on-surface shadow-cta transition-transform active:scale-[0.99] disabled:opacity-50"
      >
        {isNew ? "Tạo combo" : "Lưu thay đổi"}
      </button>

      {!isNew && (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Bạn có chắc muốn xoá combo "${combo.name}"?`)) return;
            onClose();
            void onRun(() => deleteCombo(combo.id), `Đã xoá combo "${combo.name}".`);
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant text-label-md text-error transition-colors hover:bg-error-container"
        >
          <Trash2 size={16} strokeWidth={2.2} />
          Xoá combo này
        </button>
      )}
    </section>
  );
}
