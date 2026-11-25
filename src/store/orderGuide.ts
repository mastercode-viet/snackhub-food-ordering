import { create } from "zustand";

/**
 * Hướng dẫn đặt hàng cho khách lần đầu.
 *
 * Ba mốc được nhớ trong localStorage, KHÔNG đồng bộ lên server (khách không
 * đăng nhập nên không có chỗ nào gắn vào):
 *   - tour 3 bước đã xem xong/chưa
 *   - nhãn "ấn để thêm món" đã dùng xong/chưa
 *   - nhãn "ấn để chốt đơn" đã dùng xong/chưa
 *
 * localStorage có thể bị chặn (chế độ riêng tư, cài đặt trình duyệt), nên mọi
 * lần đọc/ghi đều bọc try/catch: hỏng storage thì hướng dẫn hiện lại, còn hơn
 * ném lỗi làm sập cả trang chủ.
 */
const TOUR_KEY = "snackhub:guide-tour-done";
const ADD_HINT_KEY = "snackhub:guide-add-hint-done";
const CHECKOUT_HINT_KEY = "snackhub:guide-checkout-hint-done";

/** Số bước của tour — dùng cho nhãn "Bước x / N" và chấm tiến trình. */
export const TOUR_STEPS = 3;

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* storage bị chặn — bỏ qua, hướng dẫn sẽ hiện lại ở lần sau */
  }
}

type OrderGuideState = {
  /** Bước tour đang hiện (0-based). null = không hiện tour. */
  step: number | null;
  tourDone: boolean;
  addHintDone: boolean;
  checkoutHintDone: boolean;
  startTour: () => void;
  nextStep: () => void;
  finishTour: () => void;
  markAddHintDone: () => void;
  markCheckoutHintDone: () => void;
};

export const useOrderGuide = create<OrderGuideState>((set, get) => ({
  step: null,
  tourDone: readFlag(TOUR_KEY),
  addHintDone: readFlag(ADD_HINT_KEY),
  checkoutHintDone: readFlag(CHECKOUT_HINT_KEY),

  startTour: () => {
    // Khách đã xem rồi thì không bao giờ tự mở lại; chỉ mở khi bấm "Xem lại".
    if (get().tourDone) return;
    set({ step: 0 });
  },

  nextStep: () => {
    const step = get().step;
    if (step === null) return;
    if (step + 1 >= TOUR_STEPS) {
      get().finishTour();
      return;
    }
    set({ step: step + 1 });
  },

  finishTour: () => {
    writeFlag(TOUR_KEY);
    set({ step: null, tourDone: true });
  },

  markAddHintDone: () => {
    writeFlag(ADD_HINT_KEY);
    set({ addHintDone: true });
  },

  markCheckoutHintDone: () => {
    writeFlag(CHECKOUT_HINT_KEY);
    set({ checkoutHintDone: true });
  },
}));
