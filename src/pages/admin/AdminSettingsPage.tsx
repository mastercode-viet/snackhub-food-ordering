import { useEffect, useState } from "react";
import { ChevronRight, Power } from "lucide-react";
import { useAsync } from "@/hooks/useAsync";
import { MoneyInput } from "@/components/admin/AdminForm";
import { formatVnd } from "@/lib/format";
import { toast } from "@/store/toast";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { fetchSettings, updateSettings, type StoreSettings } from "@/lib/adminQueries";
import HomeSectionsPanel from "@/components/admin/HomeSectionsPanel";

/** "06:00:00" -> "06:00" cho <input type="time">. */
function toTimeInput(t: string): string {
  return t.slice(0, 5);
}

function toCoordsInput(s: StoreSettings): string {
  return s.store_latitude != null && s.store_longitude != null ? `${s.store_latitude}, ${s.store_longitude}` : "";
}

/** "20.976038, 105.817109" (dạng Google Maps copy ra) -> toạ độ; "" = tắt kiểm tra vị trí; sai định dạng = undefined. */
function parseCoords(text: string): { lat: number; lng: number } | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

export default function AdminSettingsPage() {
  const state = useAsync(fetchSettings, []);

  return (
    <div className="flex flex-col gap-space-lg">
      <nav className="flex items-center gap-1 text-label-sm text-on-surface-variant">
        Quản lý
        <ChevronRight size={14} strokeWidth={2.2} />
        <span className="text-on-surface">Cài đặt quán</span>
      </nav>

      {state.loading ? (
        <Skeleton className="h-64 w-full rounded-card" />
      ) : state.error ? (
        <ErrorState onRetry={state.reload} />
      ) : (
        <>
          <SettingsForm settings={state.data!} onSaved={state.reload} />
          <HomeSectionsPanel settings={state.data!} onSaved={state.reload} />
        </>
      )}
    </div>
  );
}

function SettingsForm({
  settings,
  onSaved,
}: {
  settings: StoreSettings;
  onSaved: () => void;
}) {
  const [storeName, setStoreName] = useState(settings.store_name);
  const [openTime, setOpenTime] = useState(toTimeInput(settings.open_time));
  const [closeTime, setCloseTime] = useState(toTimeInput(settings.close_time));
  const [shippingFee, setShippingFee] = useState(Number(settings.shipping_fee));
  const [minOrder, setMinOrder] = useState(Number(settings.min_order_amount));
  const [coords, setCoords] = useState(toCoordsInput(settings));
  const [radius, setRadius] = useState(String(settings.checkin_radius_m));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStoreName(settings.store_name);
    setOpenTime(toTimeInput(settings.open_time));
    setCloseTime(toTimeInput(settings.close_time));
    setShippingFee(Number(settings.shipping_fee));
    setMinOrder(Number(settings.min_order_amount));
    setCoords(toCoordsInput(settings));
    setRadius(String(settings.checkin_radius_m));
  }, [settings]);

  async function run(patch: Parameters<typeof updateSettings>[0], okMessage: string) {
    setBusy(true);
    try {
      await updateSettings(patch);
      toast.success(okMessage);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const name = storeName.trim();
    if (!name) {
      toast.error("Tên quán không được để trống.");
      return;
    }
    const location = parseCoords(coords);
    if (location === undefined) {
      toast.error('Toạ độ quán phải có dạng "vĩ độ, kinh độ", ví dụ 20.976038, 105.817109.');
      return;
    }
    const radiusM = Number(radius);
    if (!Number.isInteger(radiusM) || radiusM < 20 || radiusM > 5000) {
      toast.error("Bán kính chấm công phải là số nguyên từ 20 đến 5000 m.");
      return;
    }

    void run(
      {
        store_name: name,
        open_time: `${openTime}:00`,
        close_time: `${closeTime}:00`,
        shipping_fee: shippingFee,
        min_order_amount: minOrder,
        store_latitude: location?.lat ?? null,
        store_longitude: location?.lng ?? null,
        checkin_radius_m: radiusM,
      },
      "Đã lưu cài đặt.",
    );
  }

  return (
    <div className="flex flex-col gap-gutter-mobile xl:flex-row xl:gap-gutter">
      <section className="flex min-w-0 flex-1 flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
        <div>
          <h1 className="text-headline-sm text-on-surface">Cài đặt quán</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Khung giờ ở đây là thứ chặn đặt hàng thật — cả giao diện khách lẫn Edge Function
            đều kiểm tra bằng cùng một hàm.
          </p>
        </div>

        <Field label="Tên quán">
          <input value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Bắt đầu nhận đơn">
            <input
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Ngừng nhận đơn">
            <input
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Phí giao (đ)" hint="Để 0 là miễn phí">
            <MoneyInput value={shippingFee} onChange={setShippingFee} />
          </Field>
          <Field label="Đơn tối thiểu (đ)">
            <MoneyInput value={minOrder} onChange={setMinOrder} />
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Field label="Toạ độ quán (chấm công)" hint="Chuột phải trên Google Maps để copy. Để trống là tắt kiểm tra vị trí.">
            <input
              value={coords}
              onChange={(e) => setCoords(e.target.value)}
              placeholder="20.976038, 105.817109"
              inputMode="decimal"
              className={inputClass}
            />
          </Field>
          <Field label="Bán kính (m)">
            <input
              type="number"
              min={20}
              max={5000}
              step={10}
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className={`${inputClass} w-28`}
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="min-h-[44px] rounded-card bg-inverse-surface px-4 text-label-lg text-inverse-on-surface disabled:opacity-50"
        >
          Lưu cài đặt
        </button>
      </section>

      <aside className="w-full shrink-0 xl:w-[360px]">
        <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Power size={18} strokeWidth={2.2} className="text-on-surface-variant" />
            <h2 className="text-label-lg text-on-surface">Nhận đơn</h2>
          </div>

          <p className="text-body-sm text-on-surface-variant">
            Tắt là ngừng nhận đơn ngay lập tức, kể cả đang trong khung giờ bán. Dùng khi hết
            nguyên liệu hoặc nghỉ đột xuất. Khách vẫn xem được menu.
          </p>

          <div
            className={`rounded-card px-4 py-3 text-label-md ${
              settings.is_open
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-error-container text-on-error-container"
            }`}
          >
            {settings.is_open
              ? `Đang mở — nhận đơn ${toTimeInput(settings.open_time)}–${toTimeInput(settings.close_time)}`
              : "Đang tạm nghỉ — khách không đặt được"}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (settings.is_open && !confirm("Ngừng nhận đơn ngay bây giờ?")) return;
              void run(
                { is_open: !settings.is_open },
                settings.is_open ? "Đã ngừng nhận đơn." : "Đã mở nhận đơn lại.",
              );
            }}
            className={`min-h-[44px] rounded-card px-4 text-label-lg transition-opacity hover:opacity-90 disabled:opacity-50 ${
              settings.is_open
                ? "border border-outline-variant text-error"
                : "bg-inverse-surface text-inverse-on-surface"
            }`}
          >
            {settings.is_open ? "Ngừng nhận đơn" : "Mở nhận đơn lại"}
          </button>

          <div className="border-t border-outline-variant pt-space-md text-body-sm text-on-surface-variant">
            <p>
              Phí giao hiện tại:{" "}
              <span className="text-on-surface">
                {Number(settings.shipping_fee) === 0 ? "Miễn phí" : formatVnd(settings.shipping_fee)}
              </span>
            </p>
            <p className="mt-0.5">
              Đơn tối thiểu:{" "}
              <span className="text-on-surface">{formatVnd(settings.min_order_amount)}</span>
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}

const inputClass =
  "min-h-[44px] w-full rounded-card border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container";

function Field({
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
