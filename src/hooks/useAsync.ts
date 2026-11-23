import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export type AsyncState<T> = {
  data: T | null;
  /** Chỉ true ở lần tải đầu, khi chưa có gì để hiển thị. */
  loading: boolean;
  error: Error | null;
  reload: () => void;
  /** Sửa dữ liệu tại chỗ sau một thao tác ghi, khỏi đọc lại DB. */
  setData: Dispatch<SetStateAction<T | null>>;
};

/**
 * Bọc 1 lần gọi bất đồng bộ thành state loading / error / data.
 * Dùng chung cho mọi hook đọc Supabase để không lặp lại 3 useState ở từng chỗ.
 *
 * `reload()` chỉ là LÀM MỚI: giữ nguyên dữ liệu đang hiển thị, không bật lại
 * skeleton — nhờ vậy danh sách không bị tháo ra rồi mount lại (mất scroll,
 * mất focus, mất state đang gõ dở). Chỉ khi đổi tham số (đổi món, đổi bộ lọc)
 * thì dữ liệu cũ mới bị bỏ, vì lúc đó nó không còn đúng.
 *
 * Cố ý không thêm thư viện data-fetching: toàn bộ dữ liệu ở đây đều nhỏ và
 * chỉ đọc, thêm một dependency nữa không đáng.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // deps ở mọi call site đều là primitive (id, slug, từ khoá, ngày…) nên so
  // sánh bằng chuỗi là đủ và ổn định giữa các lần render.
  const depsKey = JSON.stringify(deps);
  const lastDepsKey = useRef<string | null>(null);
  const hasData = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (lastDepsKey.current !== depsKey) {
      lastDepsKey.current = depsKey;
      // Tham số đổi = dữ liệu đang có thuộc về đối tượng khác → bỏ đi.
      hasData.current = false;
      setData(null);
    }

    if (!hasData.current) setLoading(true);
    setError(null);

    fn()
      .then((result) => {
        if (cancelled) return;
        hasData.current = true;
        setData(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Đang có dữ liệu trên màn hình thì lỗi làm mới không được xoá nó.
        if (!hasData.current) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, nonce]);

  return { data, loading, error, reload, setData };
}
