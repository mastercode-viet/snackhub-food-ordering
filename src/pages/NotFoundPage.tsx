import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-margin-mobile text-center">
      <div>
        <p className="text-display-lg text-primary">404</p>
        <h1 className="mt-2 text-headline-md text-on-surface">Không tìm thấy trang</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Có thể món này đã bị gỡ khỏi thực đơn.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-inverse-surface px-6 text-label-lg text-inverse-on-surface shadow-cta"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
