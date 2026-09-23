import { useRef, useState } from "react";
import { ChevronRight, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { toast } from "@/store/toast";
import ProductImage from "@/components/product/ProductImage";
import { FormField, LabeledSwitch, Toggle, inputClass } from "@/components/admin/AdminForm";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import {
  createBanner,
  deleteBanner,
  fetchAdminBanners,
  setBannerActive,
  updateBanner,
  uploadProductImage,
  type AdminBanner,
  type BannerFormValues,
} from "@/lib/adminQueries";

type RunFn = (action: () => Promise<unknown>, okMessage: string) => Promise<void>;

/**
 * Quản lý banner trang chủ (dải nằm ngay trên mục combo).
 *
 * Ảnh dùng chung bucket `product-images` — cùng giới hạn 3MB, cùng danh sách
 * định dạng, không dựng thêm bucket chỉ để chứa vài tấm banner.
 */
export default function AdminBannersPage() {
  const state = useAsync(fetchAdminBanners, []);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const banners = state.data ?? [];
  const editing = banners.find((b) => b.id === editingId) ?? null;
  const activeCount = banners.filter((b) => b.is_active).length;

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Banner</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div className="min-w-0">
          <h1 className="text-headline-sm text-on-surface">Banner trang chủ</h1>
          <p className="mt-1 max-w-[56ch] text-body-sm text-on-surface-variant">
            Dải banner nằm ngay trên mục combo. Tắt hết banner thì khối này biến mất khỏi
            trang chủ, không để lại khoảng trống.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setCreating(true);
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card bg-primary-container px-4 text-label-lg text-on-primary-container transition-opacity hover:opacity-90"
        >
          <Plus size={17} strokeWidth={2.4} />
          Thêm banner
        </button>
      </header>

      {state.loading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
          <section className="flex min-w-0 flex-1 flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
            <p className="text-label-sm text-on-surface-variant">
              {banners.length} banner · {activeCount} đang hiện
            </p>

            {banners.length === 0 ? (
              <EmptyState
                icon="📣"
                title="Chưa có banner nào"
                description="Thêm banner đầu tiên để quảng bá món mới hay đợt giảm giá."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-outline-variant">
                {banners.map((banner) => (
                  <BannerRow
                    key={banner.id}
                    banner={banner}
                    active={banner.id === editingId}
                    onSelect={() => {
                      setCreating(false);
                      setEditingId(banner.id);
                    }}
                    onToggle={(on) =>
                      run(
                        () => setBannerActive(banner.id, on),
                        on ? "Đã bật banner." : "Đã tắt banner.",
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          {(creating || editing) && (
            <div className="w-full shrink-0 xl:max-w-sm">
              <BannerForm
                // Chuyển từ banner này sang banner khác phải dựng lại form,
                // nếu không state cũ còn nguyên và hiện nhầm nội dung.
                key={editing?.id ?? "new"}
                banner={editing ?? undefined}
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

function BannerRow({
  banner,
  active,
  onSelect,
  onToggle,
}: {
  banner: AdminBanner;
  active: boolean;
  onSelect: () => void;
  onToggle: (on: boolean) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-h-[44px] min-w-0 flex-1 items-center gap-3 rounded-card px-2 text-left transition-colors ${
          active ? "bg-surface-container" : "hover:bg-surface-container-low"
        }`}
      >
        <ProductImage
          src={banner.image_url}
          alt=""
          fallbackIcon="📣"
          className="h-12 w-20 shrink-0 rounded-card-sm"
        />
        {/* Không còn tên banner, nên ảnh chính là thứ để nhận ra nó. Dòng chữ
            chỉ còn thứ tự và link. */}
        <span className="min-w-0">
          <span className="block text-body-md text-on-surface">#{banner.sort_order}</span>
          <span className="block truncate text-label-xs text-on-surface-variant">
            {banner.link_url ?? "không có link"}
          </span>
        </span>
      </button>

      <LabeledSwitch
        on={banner.is_active}
        onChange={() => onToggle(!banner.is_active)}
        onLabel="Đang hiện"
        offLabel="Đang tắt"
      />
    </li>
  );
}

function BannerForm({
  banner,
  onClose,
  onRun,
}: {
  banner?: AdminBanner;
  onClose: () => void;
  onRun: RunFn;
}) {
  const isNew = !banner;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [values, setValues] = useState<BannerFormValues>({
    image_url: banner?.image_url ?? "",
    link_url: banner?.link_url ?? "",
    sort_order: banner?.sort_order ?? 0,
    is_active: banner?.is_active ?? true,
  });

  function set<K extends keyof BannerFormValues>(key: K, value: BannerFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
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

  function submit() {
    const link = values.link_url?.trim() ?? "";

    if (!values.image_url) {
      toast.error("Banner phải có ảnh.");
      return;
    }
    // Cùng ràng buộc với CHECK ở DB — chặn tại đây để báo lỗi tiếng Việt
    // thay vì ném nguyên thông báo constraint của Postgres ra màn hình.
    if (link && !/^(\/|https?:\/\/)/.test(link)) {
      toast.error("Link phải bắt đầu bằng / (trong app) hoặc https://");
      return;
    }

    const payload: BannerFormValues = { ...values, link_url: link || null };

    if (isNew) {
      void onRun(() => createBanner(payload), "Đã thêm banner.").then(onClose);
    } else {
      void onRun(() => updateBanner(banner.id, payload), "Đã lưu thay đổi.");
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-label-lg text-on-surface">
          {isNew ? "Thêm banner mới" : "Sửa banner"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="inline-flex size-11 items-center justify-center rounded-card text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <X size={17} strokeWidth={2.4} />
        </button>
      </div>

      {/* Khung xem trước đúng tỉ lệ banner ngoài trang chủ, để Admin thấy ngay
          ảnh bị cắt trên/dưới thế nào trước khi lưu. */}
      <ProductImage
        src={values.image_url || null}
        alt=""
        fallbackIcon="📣"
        className="h-32 w-full rounded-card-sm"
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
          className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-card border border-outline-variant px-3 text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
        >
          <ImagePlus size={16} strokeWidth={2.2} />
          {uploading ? "Đang tải…" : values.image_url ? "Đổi ảnh" : "Tải ảnh lên"}
        </button>
        <p className="text-label-xs text-on-surface-variant">
          WEBP/JPG/PNG/AVIF, tối đa 3MB. Ảnh ngang, nên rộng ~1200px.
        </p>
      </div>

      <FormField
        label="Link khi bấm"
        hint="Để trống thì banner chỉ để xem. Ví dụ: /thuc-don hoặc /mon/banh-trang-tron"
      >
        <input
          value={values.link_url ?? ""}
          placeholder="/thuc-don"
          onChange={(e) => set("link_url", e.target.value)}
          className={inputClass}
        />
      </FormField>

      <FormField label="Thứ tự hiển thị" hint="Số nhỏ hiện trước">
        <input
          inputMode="numeric"
          value={String(values.sort_order)}
          onChange={(e) => set("sort_order", Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={inputClass}
        />
      </FormField>

      <Toggle
        label="Đang hiện"
        hint="Tắt là banner biến mất khỏi trang chủ"
        on={values.is_active}
        onChange={(v) => set("is_active", v)}
      />

      <button
        type="button"
        onClick={submit}
        disabled={uploading}
        className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg text-inverse-on-surface disabled:opacity-50"
      >
        {isNew ? "Thêm banner" : "Lưu thay đổi"}
      </button>

      {!isNew && (
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Xoá banner #${banner.sort_order}?`)) return;
            onClose();
            void onRun(() => deleteBanner(banner.id), "Đã xoá banner.");
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant text-label-md text-error transition-colors hover:bg-error-container"
        >
          <Trash2 size={16} strokeWidth={2.2} />
          Xoá banner này
        </button>
      )}
    </section>
  );
}
