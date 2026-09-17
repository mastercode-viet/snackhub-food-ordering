import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RootLayout from "@/routes/RootLayout";
import AppLayout from "@/routes/AppLayout";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import CartPage from "@/pages/CartPage";
import OrdersPage from "@/pages/OrdersPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
import NotFoundPage from "@/pages/NotFoundPage";

// Khu vực Admin tách khỏi bundle khách: khách không bao giờ tải màn quản trị.
const AdminLayout = lazy(() => import("@/routes/AdminLayout"));
const AdminToppingsPage = lazy(() => import("@/pages/admin/AdminToppingsPage"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/AdminOrdersPage"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage"));

const router = createBrowserRouter([
  {
    // Bọc ngoài cùng: toast + khôi phục vị trí cuộn cho MỌI màn
    element: <RootLayout />,
    children: [
      {
        // 4 tab chính — có Bottom Navigation
        element: <AppLayout />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/thuc-don", element: <MenuPage /> },
          { path: "/gio-hang", element: <CartPage /> },
          { path: "/don-hang", element: <OrdersPage /> },
        ],
      },

      // Màn toàn trang — có sticky bar riêng nên không nằm trong AppLayout
      { path: "/mon/:slug", element: <ProductDetailPage /> },
      { path: "/dat-hang", element: <CheckoutPage /> },
      { path: "/don-hang/:orderCode", element: <OrderTrackingPage /> },

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
          { path: "toppings", element: <AdminToppingsPage /> },
        ],
      },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
