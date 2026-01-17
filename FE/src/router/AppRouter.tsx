// ===== REACT ROUTER CONFIGURATION =====

import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "../constants";

// Lazy load components để optimize performance
const MainLayout = React.lazy(() => import("../components/Layout/MainLayout"));
const HomePage = React.lazy(() => import("../pages/Home"));
const AboutPage = React.lazy(() => import("../pages/About"));
const DashboardPage = React.lazy(() => import("../pages/Dashboard"));

// Error boundary component cho routes
const ErrorBoundary: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-500 mb-4">Oops!</h1>
        <p className="text-gray-600 mb-4">Có lỗi xảy ra khi tải trang này.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Tải lại trang
        </button>
      </div>
    </div>
  );
};

// Loading component cho lazy loading
const PageLoading: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Đang tải...</p>
      </div>
    </div>
  );
};

// Wrapper component với Suspense
const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <React.Suspense fallback={<PageLoading />}>{children}</React.Suspense>;
};

// Router configuration
export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <SuspenseWrapper>
        <MainLayout />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <HomePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ABOUT,
        element: (
          <SuspenseWrapper>
            <AboutPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.DASHBOARD,
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  // Catch all route - redirect to home
  {
    path: "*",
    element: <Navigate to={ROUTES.HOME} replace />,
  },
]);

// Route definitions để sử dụng trong navigation
export const routeDefinitions = [
  {
    key: "home",
    path: ROUTES.HOME,
    label: "Trang chủ",
    icon: "home",
  },
  {
    key: "about",
    path: ROUTES.ABOUT,
    label: "Giới thiệu",
    icon: "info",
  },
  {
    key: "dashboard",
    path: ROUTES.DASHBOARD,
    label: "Dashboard",
    icon: "dashboard",
  },
] as const;
