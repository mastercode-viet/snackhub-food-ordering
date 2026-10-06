import { MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import { STORE_CONTACT, formatPhone, zaloUrl } from "@/lib/contact";

/** Thẻ Liên hệ (tab "Liên hệ"): địa chỉ, số điện thoại, và lưu ý ship ngoài trường qua Zalo. */
export default function ContactCard() {
  const phone = formatPhone(STORE_CONTACT.phone);

  return (
    <section className="flex flex-col gap-3 rounded-card-lg bg-surface-container-lowest p-5 shadow-card">
      <a
        href={STORE_CONTACT.mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-3 rounded-card p-1 -m-1 transition-colors hover:bg-surface-container-low"
      >
        <MapPin size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-on-surface-variant" />
        <span className="min-w-0">
          <span className="block text-label-sm text-on-surface-variant">Địa chỉ quán</span>
          <span className="block text-body-md text-on-surface">{STORE_CONTACT.address}</span>
          <span className="mt-0.5 block text-label-sm text-on-surface-variant underline underline-offset-2">
            Xem bản đồ
          </span>
        </span>
      </a>

      <div className="flex items-start gap-3">
        <Phone size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-on-surface-variant" />
        <span className="min-w-0">
          <span className="block text-label-sm text-on-surface-variant">Điện thoại / Zalo</span>
          <span className="block select-all text-body-md font-semibold text-on-surface">{phone}</span>
        </span>
      </div>

      <div className="flex items-start gap-3 rounded-card bg-tertiary-fixed px-4 py-3 text-on-tertiary-fixed">
        <Truck size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" />
        <p className="text-body-sm">
          Muốn ship <strong>ngoài trường</strong>? Nhắn Zalo số <strong>{phone}</strong> để quán báo phí và thời gian giao.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={`tel:${STORE_CONTACT.phone}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card border border-outline-variant px-3 text-label-md font-semibold text-on-surface"
        >
          <Phone size={16} strokeWidth={2.2} />
          Gọi điện
        </a>
        <a
          href={zaloUrl(STORE_CONTACT.phone)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card bg-inverse-surface px-3 text-label-md font-semibold text-inverse-on-surface shadow-cta"
        >
          <MessageCircle size={16} strokeWidth={2.2} />
          Nhắn Zalo
        </a>
      </div>
    </section>
  );
}
