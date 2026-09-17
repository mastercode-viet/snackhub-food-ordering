import { create } from "zustand";
import { newId } from "@/lib/id";

export type ToastTone = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastState = {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone, durationMs?: number) => void;
  dismiss: (id: string) => void;
};

const DEFAULT_DURATION = 4000;

/**
 * Toast dùng chung. Cố ý KHÔNG dùng `persist` — thông báo chỉ sống trong phiên,
 * reload trang mà toast cũ hiện lại thì vô nghĩa.
 */
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (message, tone = "info", durationMs = DEFAULT_DURATION) => {
    const id = newId();
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), durationMs);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Gọi được cả ngoài React (ví dụ trong hàm xử lý lỗi). */
export const toast = {
  success: (message: string) => useToastStore.getState().show(message, "success"),
  error: (message: string) => useToastStore.getState().show(message, "error"),
  info: (message: string) => useToastStore.getState().show(message, "info"),
};
