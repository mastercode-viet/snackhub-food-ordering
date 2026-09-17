import { useMemo, useRef, useState } from "react";
import { ChevronRight, ImagePlus, Plus, Search, Trash2, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { formatVnd } from "@/lib/format";
import { normalizeSearch, toSlug } from "@/lib/text";
import { toast } from "@/store/toast";
import ProductImage from "@/components/product/ProductImage";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  fetchAdminCategories,
  fetchAdminProductRows,
  setProductAvailability,
  updateCategory,
  updateProduct,
  uploadProductImage,
  type AdminCategory,
  type AdminProductRow,
  type ProductFormValues,
} from "@/lib/adminQueries";

type Tab = "products" | "categories";
type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

export default function AdminCatalogPage() {
  const state = useAsync(
    async () => ({
      products: await fetchAdminProductRows(),
      categories: await fetchAdminCategories(),
    }),
    [],
  );

  const [tab, setTab] = useState<Tab>("products");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const run: RunFn = async (action, okMessage) => {
    try {
      await action();
      toast.success(okMessage);
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    }
  };

  const products = state.data?.products ?? [];
  const categories = state.data?.categories ?? [];

  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return products;
    return products.filter((p) => normalizeSearch(p.name).includes(q));
  }, [products, query]);

  const selected = products.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Thực đơn</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="min-w-0">
          <h1 className="text-headline-sm text-on-surface">Quản lý thực đơn</h1>
          <p className="mt-1 max-w-[56ch] text-body-sm text-on-surface-variant">
            Tắt “còn bán” là món biến thành “Tạm hết” bên khách ngay. Xoá món thì đơn cũ vẫn
            giữ nguyên tên và giá đã đặt.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setCreating(true);
            setTab("products");
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-primary-container px-4 text-label-lg text-on-primary-container transition-opacity hover:opacity-90"
        >
          <Plus size={17} strokeWidth={2.4} />
          Thêm món
        </button>
      </header>

      <div className="flex gap-2">
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>
          Món ăn ({products.length})
        </TabButton>
        <TabButton active={tab === "categories"} onClick={() => setTab("categories")}>
          Danh mục ({categories.length})
        </TabButton>
      </div>

      {state.loading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : tab === "categories" ? (
        <CategoryPanel categories={categories} onRun={run} />
      ) : (
        <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
          <section className="flex min-w-0 flex-1 flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
            <div className="relative">
              <Search
                size={16}
                strokeWidth={2.2}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm món theo tên…"
                className="min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
              />
            </div>

            {visible.length === 0 ? (
              <EmptyState icon="🍽️" title="Không có món nào khớp" />
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {visible.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    active={p.id === selectedId}
                    onSelect={() => {
                      setCreating(false);
                      setSelectedId(p.id);
                    }}
                    onToggle={() =>
                      void run(
                        () => setProductAvailability(p.id, !p.is_available),
                        p.is_available ? `Đã tắt bán "${p.name}".` : `Đã bật bán lại "${p.name}".`,
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <aside className="w-full shrink-0 xl:w-[400px]">
            {creating ? (
              <ProductForm
                key="new"
                categories={categories}
                onClose={() => setCreating(false)}
                onRun={run}
              />
            ) : selected ? (
              <ProductForm
                key={selected.id}
                product={selected}
                categories={categories}
                onClose={() => setSelectedId(null)}
                onRun={run}
              />
            ) : (
              <div className="rounded-card-lg border border-dashed border-outline-variant p-6 text-center text-body-sm text-on-surface-variant">
                Chọn một món để sửa, hoặc bấm “Thêm món”.
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-card px-4 text-label-md transition-colors ${
        active
          ? "bg-primary-container text-on-primary-container"
          : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
  );
}

function ProductRow({
  product,
  active,
  onSelect,
  onToggle,
}: {
  product: AdminProductRow;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-card px-2 py-2.5 transition-colors ${
        active ? "bg-surface-container" : "hover:bg-surface-container-low"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left"
      >
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="size-11 shrink-0 rounded-card-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md text-on-surface">{product.name}</p>
          <p className="truncate text-label-sm text-on-surface-variant">
            {product.categories?.name ?? "chưa có danh mục"}
            {product.is_featured ? " · nổi bật" : ""}
            {product.discount_percent > 0 ? ` · giảm ${product.discount_percent}%` : ""}
          </p>
        </div>
        <span className="shrink-0 text-label-md text-primary">
          {formatVnd(product.base_price)}
        </span>
      </button>

      {/* Công tắc còn/hết hàng: thao tác nhiều nhất trong ngày nên để ngay
          ngoài danh sách, không chôn trong form. */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={product.is_available}
        className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-label-sm transition-colors ${
          product.is_available
            ? "bg-secondary-container text-on-secondary-container"
            : "bg-error-container text-on-error-container"
        }`}
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${product.is_available ? "bg-secondary" : "bg-error"}`}
        />
        {product.is_available ? "Còn bán" : "Tạm hết"}
      </button>
    </li>
  );
}

function ProductForm({
  product,
  categories,
  onClose,
  onRun,
}: {
  product?: AdminProductRow;
  categories: AdminCategory[];
  onClose: () => void;
  onRun: RunFn;
}) {
  const isNew = !product;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [values, setValues] = useState<ProductFormValues>({
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? null,
    base_price: product?.base_price ?? 0,
    discount_percent: product?.discount_percent ?? 0,
    image_url: product?.image_url ?? null,
    is_available: product?.is_available ?? true,
    is_featured: product?.is_featured ?? false,
    sort_order: product?.sort_order ?? 0,
  });

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onPickImage(file: File) {
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      set("image_url", url);
      toast.success("Đã tải ảnh lên.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tải ảnh thất bại.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const name = values.name.trim();
    if (!name) {
      toast.error("Món phải có tên.");
      return;
    }
    if (!Number.isFinite(values.base_price) || values.base_price < 0) {
      toast.error("Giá không hợp lệ.");
      return;
    }

    const payload: ProductFormValues = {
      ...values,
      name,
      slug: values.slug.trim() || toSlug(name),
      description: values.description?.trim() || null,
    };

    if (isNew) {
      void onRun(() => createProduct(payload), `Đã thêm "${name}".`).then(onClose);
    } else {
      void onRun(() => updateProduct(product!.id, payload), "Đã lưu thay đổi.");
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-label-lg text-on-surface">{isNew ? "Thêm món mới" : "Sửa món"}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="inline-flex size-11 items-center justify-center rounded-card text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <ProductImage
          src={values.image_url}
          alt={values.name || "Ảnh món"}
          className="size-20 shrink-0 rounded-card-sm"
        />
        <div className="flex flex-col gap-1.5">
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
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <ImagePlus size={16} strokeWidth={2.2} />
            {uploading ? "Đang tải…" : values.image_url ? "Đổi ảnh" : "Tải ảnh lên"}
          </button>
          <p className="text-label-xs text-on-surface-variant">WEBP/JPG/PNG/AVIF, tối đa 3MB</p>
        </div>
      </div>

      <FormField label="Tên món">
        <input
          value={values.name}
          onChange={(e) => {
            const name = e.target.value;
            setValues((v) => ({
              ...v,
              name,
              // Món mới: slug bám theo tên. Món cũ giữ nguyên slug vì đổi là
              // hỏng link khách đã lưu.
              slug: isNew ? toSlug(name) : v.slug,
            }));
          }}
          className={inputClass}
        />
      </FormField>

      <FormField label="Đường dẫn (slug)" hint={isNew ? undefined : "Đổi slug sẽ làm hỏng link cũ"}>
        <input
          value={values.slug}
          onChange={(e) => set("slug", e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Mô tả">
        <textarea
          rows={2}
          value={values.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Danh mục">
        <select
          value={values.category_id ?? ""}
          onChange={(e) => set("category_id", e.target.value || null)}
          className={inputClass}
        >
          <option value="">— chưa xếp danh mục —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ""}
              {c.name}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Giá (đ)">
          <input
            inputMode="numeric"
            value={String(values.base_price)}
            onChange={(e) => set("base_price", Number(e.target.value.replace(/\D/g, "")) || 0)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Giảm giá (%)">
          <input
            inputMode="numeric"
            value={String(values.discount_percent)}
            onChange={(e) =>
              set("discount_percent", Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0))
            }
            className={inputClass}
          />
        </FormField>
      </div>

      <FormField label="Thứ tự hiển thị" hint="Số nhỏ hiện trước">
        <input
          inputMode="numeric"
          value={String(values.sort_order)}
          onChange={(e) => set("sort_order", Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={inputClass}
        />
      </FormField>

      <div className="flex flex-col gap-2">
        <Toggle
          label="Còn bán"
          hint="Tắt là khách thấy “Tạm hết”"
          on={values.is_available}
          onChange={(v) => set("is_available", v)}
        />
        <Toggle
          label="Món nổi bật"
          hint="Hiện ở dải “Must Try” trang chủ"
          on={values.is_featured}
          onChange={(v) => set("is_featured", v)}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg text-inverse-on-surface"
      >
        {isNew ? "Thêm món" : "Lưu thay đổi"}
      </button>

      {!isNew && (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Xoá "${product!.name}" khỏi thực đơn?\n\nĐơn cũ vẫn giữ nguyên tên và giá đã đặt.`)) return;
            onClose();
            void onRun(() => deleteProduct(product!.id), "Đã xoá món.");
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant text-label-md text-error transition-colors hover:bg-error-container"
        >
          <Trash2 size={16} strokeWidth={2.2} />
          Xoá món này
        </button>
      )}
    </section>
  );
}

function CategoryPanel({ categories, onRun }: { categories: AdminCategory[]; onRun: RunFn }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          setName("");
          setIcon("");
          void onRun(
            () =>
              createCategory({
                name: n,
                slug: toSlug(n),
                icon: icon.trim() || null,
                sort_order: categories.length + 1,
              }),
            `Đã thêm danh mục "${n}".`,
          );
        }}
      >
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="🍜"
          aria-label="Biểu tượng danh mục"
          className="min-h-[44px] w-16 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-center text-body-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên danh mục mới"
          className="min-h-[44px] min-w-0 flex-1 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-primary-container px-4 text-label-md text-on-primary-container"
        >
          <Plus size={16} strokeWidth={2.4} />
          Thêm
        </button>
      </form>

      <ul className="flex flex-col divide-y divide-outline-variant">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container text-xl">
              {c.icon ?? "🍽️"}
            </span>

            <input
              defaultValue={c.name}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (!next || next === c.name) {
                  e.target.value = c.name;
                  return;
                }
                void onRun(() => updateCategory(c.id, { name: next }), "Đã đổi tên danh mục.");
              }}
              className="min-h-[44px] min-w-0 flex-1 rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
            />

            <button
              type="button"
              onClick={() =>
                void onRun(
                  () => updateCategory(c.id, { is_active: !c.is_active }),
                  c.is_active ? "Đã ẩn danh mục." : "Đã hiện lại danh mục.",
                )
              }
              aria-pressed={c.is_active}
              className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full px-3 text-label-sm transition-colors ${
                c.is_active
                  ? "bg-secondary-container text-on-secondary-container"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {c.is_active ? "Đang hiện" : "Đang ẩn"}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!confirm(`Xoá danh mục "${c.name}"?`)) return;
                void onRun(() => deleteCategory(c.id), "Đã xoá danh mục.");
              }}
              aria-label={`Xoá ${c.name}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-card text-error transition-colors hover:bg-error-container"
            >
              <Trash2 size={16} strokeWidth={2.2} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const inputClass =
  "min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container";

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-sm text-on-surface-variant">{label}</span>
      {children}
      {hint && <span className="text-label-xs text-on-surface-variant">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="flex min-h-[44px] items-center justify-between gap-3 rounded-card border border-outline-variant px-3 text-left transition-colors hover:bg-surface-container-low"
    >
      <span className="min-w-0">
        <span className="block text-body-md text-on-surface">{label}</span>
        <span className="block text-label-xs text-on-surface-variant">{hint}</span>
      </span>
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-label-sm ${
          on
            ? "bg-secondary-container text-on-secondary-container"
            : "bg-surface-container text-on-surface-variant"
        }`}
      >
        {on ? "Bật" : "Tắt"}
      </span>
    </button>
  );
}
