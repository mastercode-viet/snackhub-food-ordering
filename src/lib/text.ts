/**
 * Bỏ dấu tiếng Việt để khớp với cột `products.search_text` — cột đó đã được
 * lowercase + unaccent ở phía Postgres (migration 09).
 *
 * Hai vế PHẢI cùng chuẩn hoá: nếu chỉ chuẩn hoá ở DB mà không chuẩn hoá từ
 * khoá, khách gõ "trà" sẽ ra 0 kết quả vì trong DB đã là "tra".
 */
/**
 * Sinh slug từ tên món/danh mục. Dùng lại chuẩn hoá bỏ dấu của
 * `normalizeSearch` rồi gom mọi ký tự không phải chữ/số thành một dấu gạch.
 *
 * `products.slug` và `categories.slug` là NOT NULL và không có default, nên
 * form Admin buộc phải tự sinh — khác `search_text` vốn là cột GENERATED
 * ALWAYS do Postgres tự lo.
 */
export function toSlug(input: string): string {
  return normalizeSearch(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeSearch(input: string): string {
  return (
    input
      .normalize("NFD")
      // bỏ các dấu tổ hợp (huyền, sắc, hỏi, ngã, nặng, mũ, móc)
      .replace(/[̀-ͯ]/g, "")
      // đ/Đ là ký tự riêng, NFD không tách được — Postgres unaccent cũng map về d
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      // ký tự wildcard của LIKE, bỏ đi để khách không vô tình phá câu truy vấn
      .replace(/[%_*]/g, "")
      .trim()
  );
}
