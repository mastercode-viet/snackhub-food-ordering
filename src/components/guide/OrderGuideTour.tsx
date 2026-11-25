import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { TOUR_STEPS, useOrderGuide } from "@/store/orderGuide";
import { useShouldChooseOrderMode } from "@/store/orderMode";

/**
 * Lớp hướng dẫn đặt hàng cho khách mới, gắn một lần ở RootLayout nên sống
 * xuyên các route.
 *
 * Hai phần:
 *   1. TOUR 3 BƯỚC — làm tối nền, khoanh sáng đúng nút cần bấm kèm một câu
 *      ngắn. Chỉ tự mở ở lần ghé đầu tiên, và chỉ sau khi khách đã chọn hình
 *      thức đặt hàng (OrderModeChooser đang phủ z-80, tour nằm dưới nó nên
 *      mở sớm sẽ bị che mất).
 *   2. NHÃN GỢI Ý — chip nhỏ dán cạnh nút "+" và nút "Chốt đơn nè!" cho tới
 *      khi khách thực sự bấm vào nút đó lần đầu, rồi tự tắt vĩnh viễn.
 *
 * Vì sao đo bằng getBoundingClientRect thay vì bọc nút bằng component:
 * các nút đích nằm rải ở ProductCard, ProductOptionSheet và CartPage — bọc
 * chúng sẽ phải sửa cả ba và kéo theo layout (chip chiếm chỗ, tour đẩy nội
 * dung). Lớp phủ đo vị trí thật nên không đụng gì tới bố cục hiện có.
 */

type Box = { top: number; left: number; width: number; height: number };

const ADD_SELECTOR = '[data-guide="add-item"]';
const SHEET_ADD_SELECTOR = '[data-guide="sheet-add"]';
const CHECKOUT_SELECTOR = '[data-guide="checkout"]';

const STEPS = [
  {
    selector: ADD_SELECTOR,
    kicker: "Bước 1 / 3 · Chọn món",
    text: "Bấm dấu + trên thẻ món để mở phần chọn size, topping.",
  },
  {
    selector: SHEET_ADD_SELECTOR,
    kicker: "Bước 2 / 3 · Tuỳ chỉnh món",
    text: "Chọn size/topping (nếu có) rồi bấm đây để bỏ món vào giỏ.",
  },
  {
    selector: CHECKOUT_SELECTOR,
    kicker: "Bước 3 / 3 · Chốt đơn",
    text: "Bấm đây để điền địa chỉ nhận hàng và chọn cách thanh toán.",
  },
] as const;

const TIP_WIDTH = 272;

function toBox(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** So sánh có sai số: layout trả về số lẻ, so sánh tuyệt đối sẽ re-render liên tục. */
function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

function onScreen(box: Box): boolean {
  return box.top + box.height > 0 && box.top < window.innerHeight;
}

export default function OrderGuideTour() {
  const { pathname } = useLocation();
  const shouldChooseOrderMode = useShouldChooseOrderMode();

  const step = useOrderGuide((s) => s.step);
  const tourDone = useOrderGuide((s) => s.tourDone);
  const addHintDone = useOrderGuide((s) => s.addHintDone);
  const checkoutHintDone = useOrderGuide((s) => s.checkoutHintDone);
  const startTour = useOrderGuide((s) => s.startTour);
  const nextStep = useOrderGuide((s) => s.nextStep);
  const finishTour = useOrderGuide((s) => s.finishTour);
  const markAddHintDone = useOrderGuide((s) => s.markAddHintDone);
  const markCheckoutHintDone = useOrderGuide((s) => s.markCheckoutHintDone);

  const [tourBox, setTourBox] = useState<Box | null>(null);
  const [addBox, setAddBox] = useState<Box | null>(null);
  const [checkoutBox, setCheckoutBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const scrolledStep = useRef<number | null>(null);

  const measure = useCallback(() => {
    const stepSelector = step === null ? null : STEPS[step].selector;
    const nextTour = toBox(stepSelector ? document.querySelector(stepSelector) : null);
    const nextAdd = toBox(document.querySelector(ADD_SELECTOR));
    const nextCheckout = toBox(document.querySelector(CHECKOUT_SELECTOR));

    setTourBox((prev) => (sameBox(prev, nextTour) ? prev : nextTour));
    setAddBox((prev) => (sameBox(prev, nextAdd) ? prev : nextAdd));
    setCheckoutBox((prev) => (sameBox(prev, nextCheckout) ? prev : nextCheckout));

    setViewport((prev) =>
      prev.w === window.innerWidth && prev.h === window.innerHeight
        ? prev
        : { w: window.innerWidth, h: window.innerHeight },
    );
  }, [step]);

  // Đo lại khi cuộn, đổi kích thước, hoặc DOM đổi (sheet mở, danh sách tải xong).
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    // Đo NGAY, không qua rAF: rAF bị treo khi tab ở nền, còn hướng dẫn thì
    // phải sẵn sàng đúng lúc tab được mở lại.
    measure();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(measure, 800);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [measure]);

  // Tự mở tour đúng một lần trong đời khách, ở trang chủ.
  useEffect(() => {
    if (tourDone || shouldChooseOrderMode) return;
    if (pathname !== "/") return;
    const timer = window.setTimeout(startTour, 600);
    return () => window.clearTimeout(timer);
  }, [tourDone, shouldChooseOrderMode, pathname, startTour]);

  // Đưa đích của bước hiện tại vào giữa màn hình nếu nó đang ngoài tầm nhìn.
  useEffect(() => {
    if (step === null || scrolledStep.current === step) return;
    const el = document.querySelector(STEPS[step].selector);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > window.innerHeight - 100) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    }
    scrolledStep.current = step;
  }, [step]);

  // Bấm đúng nút đang được khoanh sáng thì sang bước kế.
  useEffect(() => {
    if (step === null) return;
    const selector = STEPS[step].selector;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(selector)) nextStep();
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [step, nextStep]);

  // Nhãn gợi ý tự tắt sau lần bấm đầu tiên.
  useEffect(() => {
    if (addHintDone) return;
    const handleClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest(ADD_SELECTOR)) markAddHintDone();
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [addHintDone, markAddHintDone]);

  useEffect(() => {
    if (checkoutHintDone) return;
    const handleClick = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest(CHECKOUT_SELECTOR)) markCheckoutHintDone();
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [checkoutHintDone, markCheckoutHintDone]);

  const stepConfig = step === null ? null : STEPS[step];
  const showTour = stepConfig !== null && tourBox !== null;
  const showAddHint = !showTour && !addHintDone && addBox !== null && onScreen(addBox);
  const showCheckoutHint =
    !showTour && !checkoutHintDone && checkoutBox !== null && onScreen(checkoutBox);

  if (!showTour && !showAddHint && !showCheckoutHint) return null;

  const tipBelow = tourBox ? tourBox.top + tourBox.height < viewport.h * 0.58 : true;
  const tipStyle: React.CSSProperties = tourBox
    ? {
        left: Math.max(12, Math.min(viewport.w - TIP_WIDTH - 12, tourBox.left + tourBox.width / 2 - TIP_WIDTH / 2)),
        ...(tipBelow
          ? { top: Math.min(viewport.h - 168, tourBox.top + tourBox.height + 14) }
          : { bottom: Math.max(12, viewport.h - tourBox.top + 14) }),
      }
    : {};

  const chipStyle = (box: Box): React.CSSProperties => ({
    top: Math.max(8, box.top - 32),
    left: Math.max(8, Math.min(viewport.w - 160, box.left + box.width / 2 - 72)),
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-[75]">
      {showTour && tourBox && stepConfig && (
        <>
          <div
            aria-hidden="true"
            className="fixed rounded-2xl outline outline-2 outline-white/90 transition-all duration-300 ease-out"
            style={{
              top: tourBox.top - 6,
              left: tourBox.left - 6,
              width: tourBox.width + 12,
              height: tourBox.height + 12,
              boxShadow: "0 0 0 9999px rgb(var(--color-on-surface) / 0.55)",
            }}
          />

          <div
            role="dialog"
            aria-label="Hướng dẫn đặt hàng"
            className="pointer-events-auto fixed w-[272px] max-w-[calc(100vw-1.5rem)] rounded-card bg-surface-container-lowest p-3.5 shadow-sheet transition-all duration-300 ease-out"
            style={tipStyle}
          >
            <p className="text-label-xs font-extrabold uppercase tracking-wider text-primary">
              {stepConfig.kicker}
            </p>
            <p className="mt-1 text-body-sm font-semibold leading-snug text-on-surface">
              {stepConfig.text}
            </p>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1" aria-hidden="true">
                {Array.from({ length: TOUR_STEPS }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? "w-3.5 bg-primary-container" : "w-1.5 bg-outline-variant"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={finishTour}
                  className="rounded-full px-2.5 py-1.5 text-label-sm font-bold text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="rounded-full bg-inverse-surface px-3.5 py-1.5 text-label-sm font-bold text-inverse-on-surface transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {step === TOUR_STEPS - 1 ? "Xong" : "Tiếp"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddHint && addBox && (
        <span
          className="guide-nudge pointer-events-none fixed inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-fixed px-2.5 py-1 text-label-xs font-extrabold text-on-primary-fixed shadow-card"
          style={chipStyle(addBox)}
        >
          ▲ Ấn để thêm món
        </span>
      )}

      {showCheckoutHint && checkoutBox && (
        <span
          className="guide-nudge pointer-events-none fixed inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-primary-fixed px-2.5 py-1 text-label-xs font-extrabold text-on-primary-fixed shadow-card"
          style={chipStyle(checkoutBox)}
        >
          ▲ Ấn để chốt đơn
        </span>
      )}
    </div>
  );
}
