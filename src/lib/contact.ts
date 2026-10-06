/** Thông tin liên hệ của quán — một chỗ duy nhất, dùng cho thẻ Liên hệ và hotline hoàn tiền. */
export const STORE_CONTACT = {
  address: "Tầng 5, Tạp hoá Quy Vy, đối diện Đại học Thăng Long",
  /** Gọi điện và Zalo dùng chung một số. */
  phone: "0963743207",
  /** Toạ độ quán (Plus Code XRG8+CR9 Định Công, Hà Nội) — trùng store_settings dùng cho chấm công. */
  mapsUrl: "https://www.google.com/maps?q=20.976038,105.817109",
} as const;

export const zaloUrl = (phone: string) => `https://zalo.me/${phone}`;

/** "0963743207" -> "0963 743 207" cho dễ đọc. */
export const formatPhone = (phone: string) => phone.replace(/^(\d{4})(\d{3})(\d{3})$/, "$1 $2 $3");
