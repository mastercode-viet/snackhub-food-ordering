import { Outlet, ScrollRestoration } from "react-router-dom";
import ToastHost from "@/components/ui/Toast";
import { useOrderModeFromUrl } from "@/store/orderMode";
import OrderModeChooser from "@/components/order/OrderModeChooser";
import PosterPopup from "@/components/PosterPopup";

export default function RootLayout() {
  useOrderModeFromUrl();
  return (
    <>
      <Outlet />
      <OrderModeChooser />
      <PosterPopup />
      <ToastHost />
      <ScrollRestoration />
    </>
  );
}
