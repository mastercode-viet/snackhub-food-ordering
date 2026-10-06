import ContactCard from "@/components/ContactCard";

/** Tab "Liên hệ" — tách riêng khỏi "Đơn & Tôi" để khách tìm số quán không phải cuộn qua danh sách đơn. */
export default function ContactPage() {
  return (
    <div className="px-margin-mobile pt-safe md:px-gutter">
      <h1 className="pb-1 pt-5 text-headline-lg tracking-tight text-on-surface">Liên hệ</h1>
      <p className="mb-4 text-body-sm text-on-surface-variant">Cần hỏi món, đổi đơn hay ship ngoài trường — gọi hoặc nhắn Zalo cho quán.</p>
      <ContactCard />
    </div>
  );
}
