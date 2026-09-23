import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Ghi nhớ thông tin giao hàng lần trước — khách đặt giữa giờ ra chơi, gõ lại
 * tên/số điện thoại/toà mỗi lần thì rất mất thời gian.
 *
 * Chỉ nằm trong localStorage của máy khách, không đẩy lên server, không có
 * bảng nào lưu (khách không đăng nhập nên cũng không có chỗ để gắn vào).
 */
export type DeliveryProfile = {
  customer_name: string;
  customer_phone: string;
  building: string;
  address_detail: string;
};

const EMPTY: DeliveryProfile = {
  customer_name: "",
  customer_phone: "",
  building: "",
  address_detail: "",
};

type ProfileState = {
  profile: DeliveryProfile;
  save: (profile: DeliveryProfile) => void;
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: EMPTY,
      save: (profile) => set({ profile }),
    }),
    {
      name: "snackhub-delivery-profile",
      // v1 lưu class_name (bỏ ô Lớp), v2 lưu floor/room (nay chỉ giao tầng 1).
      version: 3,
      migrate: (state) => {
        const s = state as ProfileState;
        // Chỉ nhặt lại các khoá còn dùng — bản cũ còn sót class_name/floor/room.
        const old = (s.profile ?? {}) as Partial<DeliveryProfile>;
        s.profile = {
          customer_name: old.customer_name ?? "",
          customer_phone: old.customer_phone ?? "",
          building: old.building ?? "",
          address_detail: old.address_detail ?? "",
        };
        return s;
      },
    },
  ),
);
