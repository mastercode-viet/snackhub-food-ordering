import type { ReactNode } from "react";

/** Chỗ giữ chỗ cho các màn hình sẽ dựng ở section sau. */
export default function PagePlaceholder({
  title,
  section,
  children,
}: {
  title: string;
  section: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-margin-mobile pt-safe">
      <div className="pt-6">
        <h1 className="text-headline-lg text-on-surface">{title}</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Màn hình này sẽ được dựng ở <span className="font-bold text-primary">{section}</span>.
        </p>
        {children}
      </div>
    </div>
  );
}
