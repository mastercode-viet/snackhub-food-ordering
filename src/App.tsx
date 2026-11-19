import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RootLayout from "@/routes/RootLayout";
import AppLayout from "@/routes/AppLayout";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import CartPage from "@/pages/CartPage";
import OrdersPage from "@/pages/OrdersPage";
import ContactPage from "@/pages/ContactPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import ComboDetailPage from "@/pages/ComboDetailPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
import InStoreOrderPage from "@/pages/InStoreOrderPage";
import PaymentQRPage from "@/pages/PaymentQRPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Khu vực Admin tách khỏi bundle khách: khách không bao giờ tải màn quản trị.
const AdminLayout = lazy(() => import("@/routes/AdminLayout"));
const AdminToppingsPage = lazy(() => import("@/pages/admin/AdminToppingsPage"));
const AdminVariantsPage = lazy(() => import("@/pages/admin/AdminVariantsPage"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/AdminOrdersPage"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage"));
const AdminCatalogPage = lazy(() => import("@/pages/admin/AdminCatalogPage"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/AdminSettingsPage"));
const AdminBannersPage = lazy(() => import("@/pages/admin/AdminBannersPage"));
const AdminDiscountCodesPage = lazy(() => import("@/pages/admin/AdminDiscountCodesPage"));
const AdminCombosPage = lazy(() => import("@/pages/admin/AdminCombosPage"));
const AdminStaffPage = lazy(() => import("@/pages/admin/AdminStaffPage"));
const AdminShiftsPage = lazy(() => import("@/pages/admin/AdminShiftsPage"));
const AdminMyShiftsPage = lazy(() => import("@/pages/admin/AdminMyShiftsPage"));
const AdminCheckInPage = lazy(() => import("@/pages/admin/AdminCheckInPage"));

const router = createBrowserRouter([
  {
    // Bọc ngoài cùng: toast + khôi phục vị trí cuộn cho MỌI màn
    element: <RootLayout />,
    children: [
      {
        // 5 tab chính — có Bottom Navigation
        element: <AppLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/thuc-don", element: <MenuPage /> },
          { path: "/gio-hang", element: <CartPage /> },
          { path: "/don-hang", element: <OrdersPage /> },
          { path: "/lien-he", element: <ContactPage /> },
        ],
      },

      // Màn toàn trang — có sticky bar riêng nên không nằm trong AppLayout
      { path: "/mon/:slug", element: <ProductDetailPage /> },
      { path: "/combo/:slug", element: <ComboDetailPage /> },
      { path: "/dat-hang", element: <CheckoutPage /> },
      { path: "/thanh-toan/:orderCode", element: <PaymentQRPage /> },
      { path: "/don-hang/:orderCode", element: <OrderTrackingPage /> },
      { path: "/tai-quay/:orderCode", element: <InStoreOrderPage /> },

      {
        path: "/admin",
        element: (
          <Suspense fallback={null}>
            <AdminLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <AdminOrdersPage /> },
          { path: "don-hang", element: <AdminOrdersPage /> },
          { path: "thong-ke", element: <AdminDashboardPage /> },
          { path: "thuc-don", element: <AdminCatalogPage /> },
          { path: "combos", element: <AdminCombosPage /> },
          { path: "khuyen-mai", element: <AdminDiscountCodesPage /> },
          { path: "toppings", element: <AdminToppingsPage /> },
          { path: "bien-the", element: <AdminVariantsPage /> },
          { path: "banner", element: <AdminBannersPage /> },
          { path: "nhan-su", element: <AdminStaffPage /> },
          { path: "ca-lam", element: <AdminShiftsPage /> },
          { path: "lich-cua-toi", element: <AdminMyShiftsPage /> },
          { path: "cham-cong", element: <AdminCheckInPage /> },
          { path: "cai-dat", element: <AdminSettingsPage /> },
        ],
      },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
