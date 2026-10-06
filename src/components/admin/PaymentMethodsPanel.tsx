import { useState } from "react";
import { Wallet } from "lucide-react";
import { Toggle } from "@/components/admin/AdminForm";
import { toast } from "@/store/toast";
import { updateSettings, type StoreSettings } from "@/lib/adminQueries";

type PaymentKey = "delivery_payos_enabled" | "delivery_cod_enabled" | "in_store_payos_enabled" | "in_store_cod_enabled";

type Item = { key: PaymentKey; /** Phương thức còn lại cùng hình thức đặt. */ other: PaymentKey; label: string; hint: string };

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: "Giao tận nơi",
    items: [
      { key: "delivery_payos_enabled", other: "delivery_cod_enabled", label: "Chuyển khoản VietQR (PayOS)", hint: "Khách trả trước khi quán làm món" },
      { key: "delivery_cod_enabled", other: "delivery_payos_enabled", label: "Thanh toán khi nhận hàng (COD)", hint: "Thu tiền mặt lúc giao" },
    ],
  },
  {
    title: "Đặt tại quầy (mã QR)",
    items: [
      { key: "in_store_payos_enabled", other: "in_store_cod_enabled", label: "Thanh toán online (VietQR)", hint: "Khách quét mã trả trước" },
      { key: "in_store_cod_enabled", other: "in_store_payos_enabled", label: "Tiền mặt tại quầy", hint: "Nhân viên thu tiền tại quầy" },
    ],
  },
];

/**
 * Superadmin bật/tắt phương thức thanh toán theo hình thức đặt. Bấm là lưu ngay
 * (giống "Mục trên trang chủ"). Khách thấy đúng các phương thức đang bật ở trang
 * Thanh toán, và Edge Function create-order từ chối phương thức đang tắt.
 *
 * Mỗi hình thức phải còn ít nhất 1 phương thức — chặn ở đây cho rõ lý do, DB cũng
 * có CHECK constraint chặn lần nữa.
 */
export default function PaymentMethodsPanel({ settings, onSaved }: { settings: StoreSettings; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);

  async function toggle(item: Item, group: string, on: boolean) {
    if (busy) return;
    if (!on && !settings[item.other]) {
      toast.error(`Phải bật ít nhất 1 phương thức thanh toán cho ${group.toLowerCase()}.`);
      return;
    }
    const patch: Partial<Record<PaymentKey, boolean>> = { [item.key]: on };
    setBusy(true);
    try {
      await updateSettings(patch);
      toast.success(`${on ? "Đã bật" : "Đã tắt"} ${item.label} — ${group.toLowerCase()}.`);
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg.includes("payment_check")
          ? `Phải bật ít nhất 1 phương thức thanh toán cho ${group.toLowerCase()}.`
          : msg || "Không lưu được, thử lại nhé.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-space-md rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Wallet size={18} strokeWidth={2.2} className="text-on-surface-variant" />
        <h2 className="text-label-lg text-on-surface">Phương thức thanh toán</h2>
      </div>
      <p className="-mt-2 text-body-sm text-on-surface-variant">
        Bấm là lưu luôn. Mỗi hình thức đặt phải còn ít nhất 1 phương thức. Khi PayOS gặp sự cố, có thể tạm bật COD cho
        đơn giao tận nơi.
      </p>

      <div className={`grid gap-gutter-mobile md:grid-cols-2 md:gap-gutter ${busy ? "opacity-60" : ""}`}>
        {GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col gap-2">
            <h3 className="text-label-md font-semibold text-on-surface">{g.title}</h3>
            {g.items.map((item) => (
              <Toggle
                key={item.key}
                label={item.label}
                hint={item.hint}
                on={settings[item.key]}
                onChange={(on) => void toggle(item, g.title, on)}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
