import { useEffect, useState } from "react";

/**
 * Hoãn giá trị lại `delay` ms. CLAUDE.md quy định search phải debounce 300ms
 * trước khi gọi API — dùng hook này thay vì tự đặt setTimeout ở từng màn.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
