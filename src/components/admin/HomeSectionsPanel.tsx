import { useMemo, useState } from "react";
import { LayoutGrid, Search } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { normalizeSearch } from "@/lib/text";
import { formatVnd } from "@/lib/format";
import { toast } from "@/store/toast";
import ProductImage from "@/components/product/ProductImage";
import { Toggle } from "@/components/admin/AdminForm";
import { SelectCheckbox } from "@/components/admin/BulkSelect";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  fetchAdminProductRows,
  setProductHomeFlag,
  updateSettings,
  type AdminProductRow,
  type StoreSettings,
} from "@/lib/adminQueries";

/** Trang chủ hiện tối đa bấy nhiêu món mỗi dải — khớp RAIL_SIZE ở HomePage. */
const RAIL_SIZE = 10;

type Flag = "is_flash_sale" | "is_featured";

/**
 * Cài đặt các mục trên trang chủ: bật/tắt Banner, Flash Sale, Must Try và chọn
 * món cho từng dải. Mỗi thao tác lưu ngay (không cần bấm "Lưu cài đặt").
 */
export default function HomeSectionsPanel({ settings, onSaved }: { settings: StoreSettings; onSaved: () => void }) {
  const products = useAsync(fetchAdminProductRows, []);

  async function toggleSection(patch: Parameters<typeof updateSettings>[0], okMessage: string) {
    try {
      await updateSettings(patch);
      toast.success(okMessage);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex items-center gap-2">
        <LayoutGrid size={18} strokeWidth={2.2} className="text-on-surface-variant" />
        <h2 className="text-label-lg text-on-surface">Mục trên trang chủ</h2>
      </div>
      <p className="-mt-2 text-body-sm text-on-surface-variant">
        Tắt mục nào thì mục đó biến khỏi trang chủ ngay. Bấm là lưu luôn.
      </p>

      <div className="grid gap-2 md:grid-cols-3">
        <Toggle
          label="Banner"
          hint="Dải banner quảng cáo"
          on={settings.show_banners}
          onChange={(on) => void toggleSection({ show_banners: on }, on ? "Đã bật Banner." : "Đã tắt Banner.")}
        />
        <Toggle
          label="Flash Sale"
          hint="Món giảm giá do quán chọn"
          on={settings.show_flash_sale}
          onChange={(on) => void toggleSection({ show_flash_sale: on }, on ? "Đã bật Flash Sale." : "Đã tắt Flash Sale.")}
        />
        <Toggle
          label="Must Try"
          hint="Món nổi bật do quán chọn"
          on={settings.show_must_try}
          onChange={(on) => void toggleSection({ show_must_try: on }, on ? "Đã bật Must Try." : "Đã tắt Must Try.")}
        />
      </div>

      {products.loading ? (
        <Skeleton className="h-48 w-full rounded-card" />
      ) : products.error ? (
        <ErrorState onRetry={products.reload} />
      ) : (
        <div className="grid gap-gutter-mobile xl:grid-cols-2 xl:gap-gutter">
          <ProductPicker
            title="Món trong Flash Sale"
            flag="is_flash_sale"
            products={products.data ?? []}
            onChanged={products.reload}
            warnOf={(p) => (p.discount_value > 0 ? null : "chưa giảm giá")}
          />
          <ProductPicker
            title="Món Must Try"
            flag="is_featured"
            products={products.data ?? []}
            onChanged={products.reload}
          />
        </div>
      )}
    </section>
  );
}

function ProductPicker({
  title,
  flag,
  products,
  onChanged,
  warnOf,
}: {
  title: string;
  flag: Flag;
  products: AdminProductRow[];
  onChanged: () => void;
  /** Ghi chú cảnh báo cạnh món (vd. vào Flash Sale mà chưa đặt giảm giá). */
  warnOf?: (p: AdminProductRow) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const chosenCount = products.filter((p) => p[flag]).length;
  // Món đã chọn lên đầu để thấy ngay danh sách hiện tại, rồi mới tới phần còn lại.
  const visible = useMemo(() => {
    const q = normalizeSearch(query);
    return products
      .filter((p) => !q || normalizeSearch(p.name).includes(q))
      .sort((a, b) => Number(b[flag]) - Number(a[flag]));
  }, [products, query, flag]);

  async function toggle(p: AdminProductRow) {
    setPending(p.id);
    try {
      await setProductHomeFlag(p.id, flag, !p[flag]);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card border border-outline-variant p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-label-lg text-on-surface">{title}</h3>
        <span className="text-label-sm text-on-surface-variant">Đã chọn {chosenCount}</span>
      </div>
      {chosenCount > RAIL_SIZE && (
        <p className="rounded-card bg-tertiary-fixed px-3 py-2 text-label-sm text-on-tertiary-fixed">
          Trang chủ chỉ hiện {RAIL_SIZE} món đầu, các món còn lại vẫn được lưu.
        </p>
      )}

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
          placeholder="Tìm món…"
          className="min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest pl-9 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
        />
      </div>

      <ul className="flex max-h-80 flex-col divide-y divide-outline-variant overflow-y-auto">
        {visible.map((p) => {
          const warn = p[flag] ? warnOf?.(p) : null;
          return (
            <li key={p.id} className={`flex items-center gap-2 py-1 ${pending === p.id ? "opacity-50" : ""}`}>
              <SelectCheckbox
                checked={p[flag]}
                onChange={() => void toggle(p)}
                label={`${p[flag] ? "Bỏ" : "Thêm"} ${p.name}`}
              />
              <ProductImage src={p.image_url} alt={p.name} className="size-9 shrink-0 rounded-card-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-md text-on-surface">{p.name}</p>
                <p className="truncate text-label-sm text-on-surface-variant">
                  {formatVnd(p.base_price)}
                  {!p.is_available && " · tạm hết (không hiện)"}
                  {warn && ` · ${warn}`}
                </p>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && <li className="py-4 text-center text-body-sm text-on-surface-variant">Không có món nào khớp.</li>}
      </ul>
    </div>
  );
}
