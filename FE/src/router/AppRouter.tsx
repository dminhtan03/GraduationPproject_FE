// ===== REACT ROUTER CONFIGURATION =====

import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "../constants";
import {
  getCurrentUser,
  getDefaultRouteByRole,
  isAdminUser,
} from "../services/authService";

// Lazy load components để optimize performance
const MainLayout = React.lazy(() => import("../components/Layout/MainLayout"));
const LoginPage = React.lazy(() => import("../pages/Login"));
const ForgotPasswordPage = React.lazy(() => import("../pages/ForgotPassword"));
const DashboardPage = React.lazy(() => import("../pages/RoomList"));
const RoomDetailPage = React.lazy(() => import("../pages/RoomDetail"));
const BookRoomPage = React.lazy(() => import("../pages/BookRoom"));
const RoomMapPage = React.lazy(() => import("../pages/RoomMap"));
const AboutPage = React.lazy(() => import("../pages/About"));
const MyBookingsPage = React.lazy(() => import("../pages/MyBookings"));
const ProfilePage = React.lazy(() => import("../pages/Profile"));
const EditProfilePage = React.lazy(
  () => import("../pages/Profile/EditProfile"),
);
const ChangePasswordPage = React.lazy(
  () => import("../pages/Profile/ChangePassword"),
);
const AIAssistantPage = React.lazy(() => import("../pages/AIAssistant"));
const NotificationsPage = React.lazy(() => import("../pages/Notifications"));
const AdminUserManagementPage = React.lazy(
  () => import("../pages/AdminUserManagement"),
);
const AdminBuildingManagementPage = React.lazy(
  () => import("../pages/AdminBuildingManagement"),
);
const AdminBuildingFloorsPage = React.lazy(
  () => import("../pages/AdminBuildingManagement/FloorList"),
);
const AdminFloorLayoutPage = React.lazy(
  () => import("../pages/AdminFloorLayout"),
);
const ForbiddenPage = React.lazy(() => import("../pages/Forbidden"));
const NotFoundPage = React.lazy(() => import("../pages/NotFound"));

type AccessMode = "authenticated" | "admin-only" | "user-only";

// eslint-disable-next-line react-refresh/only-export-components
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const user = getCurrentUser();
  if (!user) return <>{children}</>;
  return <Navigate to={getDefaultRouteByRole(user)} replace />;
};

// eslint-disable-next-line react-refresh/only-export-components
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  mode?: AccessMode;
}> = ({ children, mode = "authenticated" }) => {
  const user = getCurrentUser();

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (mode === "admin-only" && !isAdminUser(user)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  if (mode === "user-only" && isAdminUser(user)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return <>{children}</>;
};

// Error boundary component cho routes
// eslint-disable-next-line react-refresh/only-export-components
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
// eslint-disable-next-line react-refresh/only-export-components
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
// eslint-disable-next-line react-refresh/only-export-components
const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <React.Suspense fallback={<PageLoading />}>{children}</React.Suspense>;
};

// Router configuration
export const router = createBrowserRouter([
  {
    path: ROUTES.LOGIN,
    element: (
      <PublicOnlyRoute>
        <SuspenseWrapper>
          <LoginPage />
        </SuspenseWrapper>
      </PublicOnlyRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.FORGOT_PASSWORD,
    element: (
      <PublicOnlyRoute>
        <SuspenseWrapper>
          <ForgotPasswordPage />
        </SuspenseWrapper>
      </PublicOnlyRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.FORBIDDEN,
    element: (
      <SuspenseWrapper>
        <ForbiddenPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.NOT_FOUND,
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_DASHBOARD,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminUserManagementPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_BUILDING_MANAGEMENT,
    element: (
      <SuspenseWrapper>
        <AdminBuildingManagementPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_BUILDING_FLOORS,
    element: (
      <SuspenseWrapper>
        <AdminBuildingFloorsPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_FLOOR_LAYOUT,
    element: (
      <SuspenseWrapper>
        <AdminFloorLayoutPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_BUILDING_MANAGEMENT,
    element: (
      <SuspenseWrapper>
        <AdminBuildingManagementPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_BUILDING_FLOORS,
    element: (
      <SuspenseWrapper>
        <AdminBuildingFloorsPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_FLOOR_LAYOUT,
    element: (
      <SuspenseWrapper>
        <AdminFloorLayoutPage />
      </SuspenseWrapper>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute mode="user-only">
        <SuspenseWrapper>
          <MainLayout />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to={ROUTES.LOGIN} replace />,
      },
      {
        path: ROUTES.ROOM_LIST,
        element: (
          <SuspenseWrapper>
            <DashboardPage />
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
        path: ROUTES.MY_BOOKINGS,
        element: (
          <SuspenseWrapper>
            <MyBookingsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.BOOK_ROOM,
        element: (
          <SuspenseWrapper>
            <BookRoomPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ROOM_DETAIL,
        element: (
          <SuspenseWrapper>
            <RoomDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.PROFILE,
        element: (
          <SuspenseWrapper>
            <ProfilePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.PROFILE_EDIT,
        element: (
          <SuspenseWrapper>
            <EditProfilePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.CHANGE_PASSWORD,
        element: (
          <SuspenseWrapper>
            <ChangePasswordPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.ROOM_MAP,
        element: (
          <SuspenseWrapper>
            <RoomMapPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.AI_ASSISTANT,
        element: (
          <SuspenseWrapper>
            <AIAssistantPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: ROUTES.NOTIFICATIONS,
        element: (
          <SuspenseWrapper>
            <NotificationsPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  // Catch all route - redirect to home
  {
    path: "*",
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
  },
]);

// Route definitions để sử dụng trong navigation
export const routeDefinitions = [
  {
    key: "login",
    path: ROUTES.LOGIN,
    label: "Đăng nhập",
    icon: "login",
  },
  {
    key: "home",
    path: ROUTES.ROOM_LIST,
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
    path: ROUTES.ADMIN_DASHBOARD,
    label: "Dashboard",
    icon: "dashboard",
  },
] as const;
