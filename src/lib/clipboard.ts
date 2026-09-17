/**
 * Sao chép văn bản vào clipboard.
 *
 * `navigator.clipboard` chỉ tồn tại trong secure context (HTTPS hoặc
 * localhost) — giống `crypto.randomUUID`. Khi test bằng điện thoại thật qua
 * `http://<IP-LAN>:5173` thì nó `undefined`, nên phải có đường lui bằng
 * `document.execCommand("copy")` (cũ nhưng chạy được trên HTTP thuần).
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // người dùng từ chối quyền, hoặc trình duyệt chặn — thử cách dự phòng
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    // Đưa ra ngoài màn hình để không làm trang nhảy khi focus
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length); // iOS cần dòng này
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
