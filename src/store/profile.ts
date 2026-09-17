import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Ghi nhớ thông tin giao hàng lần trước — khách đặt giữa giờ ra chơi, gõ lại
 * toà/tầng/phòng mỗi lần thì rất mất thời gian.
 *
 * Chỉ nằm trong localStorage của máy khách, không đẩy lên server, không có
 * bảng nào lưu (khách không đăng nhập nên cũng không có chỗ để gắn vào).
 */
export type DeliveryProfile = {
  customer_name: string;
  customer_phone: string;
  building: string;
  floor: string;
  room: string;
  address_detail: string;
};

const EMPTY: DeliveryProfile = {
  customer_name: "",
  customer_phone: "",
  building: "",
  floor: "",
  room: "",
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
      version: 2, // v1 còn lưu class_name, nay đã bỏ ô Lớp
      migrate: (state) => {
        const s = state as ProfileState;
        s.profile = { ...EMPTY, ...s.profile };
        return s;
      },
    },
  ),
);
