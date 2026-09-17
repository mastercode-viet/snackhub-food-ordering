import { useState } from "react";

/**
 * Ảnh món. Khi chưa có ảnh (hoặc ảnh lỗi) thì hiện icon của danh mục trên nền
 * token — CỐ Ý không dùng ảnh mẫu/stock, để trang không bao giờ hiển thị món
 * bằng một tấm hình không phải của nó.
 *
 * Hiện tại chưa món nào có `image_url`; ảnh thật sẽ vào qua trang Admin (S9),
 * lúc đó component này tự chuyển sang hiển thị ảnh, không phải sửa gì.
 */
export default function ProductImage({
  src,
  alt,
  fallbackIcon,
  className = "",
  imgClassName = "",
}: {
  src: string | null;
  alt: string;
  fallbackIcon?: string | null;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div className={`relative overflow-hidden bg-surface-container-low ${className}`}>
      {showFallback ? (
        /* Nền phẳng một màu, không gradient. Chưa món nào có ảnh thật nên khung
           này xuất hiện khắp nơi — gradient ở đây là thứ nhuộm màu cả trang. */
        <div className="grid size-full place-items-center bg-surface-container">
          <span className="select-none text-3xl opacity-40 grayscale" aria-hidden="true">
            {fallbackIcon || "🍽️"}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className={`size-full object-cover ${imgClassName}`}
        />
      )}
    </div>
  );
}
