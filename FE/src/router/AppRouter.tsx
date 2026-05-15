// ===== REACT ROUTER CONFIGURATION =====

import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "../constants";
import { getDefaultRouteByRole, isAdminUser } from "../services/authService";
import {
  selectAuthInitializing,
  selectAuthUser,
  useAppSelector,
} from "../store";

// Lazy load components để optimize performance
const HomePage = React.lazy(() => import("../pages/Home"));
const MainLayout = React.lazy(() => import("../components/Layout/MainLayout"));
const LoginPage = React.lazy(() => import("../pages/Login"));
const ForgotPasswordPage = React.lazy(() => import("../pages/ForgotPassword"));
const DashboardPage = React.lazy(() => import("../pages/RoomList"));
const RoomDetailPage = React.lazy(() => import("../pages/RoomDetail"));
const BookRoomPage = React.lazy(() => import("../pages/BookRoom"));
const BookRoomRecurringPage = React.lazy(
  () => import("../pages/BookRoomRecurring"),
);
const BookRoomEventPage = React.lazy(() => import("../pages/BookRoomEvent"));
const RoomMapPage = React.lazy(() => import("../pages/RoomMap"));
const AboutPage = React.lazy(() => import("../pages/About"));
const MyBookingsPage = React.lazy(() => import("../pages/MyBookings"));
const BookingDetailPage = React.lazy(() => import("../pages/BookingDetail"));
const ProfilePage = React.lazy(() => import("../pages/Profile"));
const EditProfilePage = React.lazy(
  () => import("../pages/Profile/EditProfile"),
);
const ChangePasswordPage = React.lazy(
  () => import("../pages/Profile/ChangePassword"),
);
const AIAssistantPage = React.lazy(() => import("../pages/AIAssistant"));
const NotificationsPage = React.lazy(() => import("../pages/Notifications"));
const QrCheckInPage = React.lazy(() => import("../pages/QrCheckIn"));
const MyRecurringSeriesPage = React.lazy(
  () => import("../pages/MyRecurringSeries"),
);
// const EventDemoPage = React.lazy(() => import("../pages/EventDemo"));
const EventSetupPage = React.lazy(() => import("../pages/EventSetup"));
const EventLivePage = React.lazy(() => import("../pages/EventLive"));
const AdminDashboardPage = React.lazy(() => import("../pages/AdminDashboard"));
const AdminUserManagementPage = React.lazy(
  () => import("../pages/AdminUserManagement"),
);
const AdminAllBookingListPage = React.lazy(
  () => import("../pages/AdminAllBookingList"),
);
const AdminBookingDetailPage = React.lazy(
  () => import("../pages/AdminAllBookingList/AdminBookingDetail"),
);
const AdminBuildingManagementPage = React.lazy(
  () => import("../pages/AdminBuildingManagement"),
);
const AdminBuildingFloorsPage = React.lazy(
  () => import("../pages/AdminBuildingManagement/FloorList"),
);
const AdminRoomManagementPage = React.lazy(
  () => import("../pages/AdminBuildingManagement/RoomManagement"),
);
const AdminAmenityManagementPage = React.lazy(
  () => import("../pages/AdminAmenityManagement"),
);
const AdminServiceItemManagementPage = React.lazy(
  () => import("../pages/AdminServiceItemManagement"),
);
const AdminFloorLayoutPage = React.lazy(
  () => import("../pages/AdminFloorLayout"),
);
const AdminAcademicSchedulePage = React.lazy(
  () => import("../pages/AdminAcademicSchedule"),
);
const AdminEventBookingListPage = React.lazy(
  () => import("../pages/AdminEventBookingList"),
);
const AdminEventBookingDetailPage = React.lazy(
  () => import("../pages/AdminEventBookingDetail"),
);
// start+ chức năng admin quản lý recurring series
const AdminRecurringSeriesPage = React.lazy(
  () => import("../pages/AdminRecurringSeriesManagement"),
);
// end+ chức năng admin quản lý recurring series
const AdminFeedbackManagementPage = React.lazy(
  () => import("../pages/AdminFeedbackManagement"),
);
const TaskListPage = React.lazy(() => import("../pages/TaskList"));
const TaskCreatePage = React.lazy(() => import("../pages/TaskCreate"));
const TaskDetailPage = React.lazy(() => import("../pages/TaskDetail"));
const MeetingListPage = React.lazy(() => import("../pages/MeetingList"));
const MeetingDetailPage = React.lazy(() => import("../pages/MeetingDetail"));
const ForbiddenPage = React.lazy(() => import("../pages/Forbidden"));
const NotFoundPage = React.lazy(() => import("../pages/NotFound"));

type AccessMode = "authenticated" | "admin-only" | "user-only";

const useResolvedUser = () => {
  const user = useAppSelector(selectAuthUser);
  const isResolving = useAppSelector(selectAuthInitializing);

  return { user, isResolving };
};

// eslint-disable-next-line react-refresh/only-export-components
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isResolving } = useResolvedUser();
  if (isResolving) return <PageLoading />;
  if (!user) return <>{children}</>;
  return <Navigate to={getDefaultRouteByRole(user)} replace />;
};

// eslint-disable-next-line react-refresh/only-export-components
const RoleRedirect: React.FC = () => {
  const { user, isResolving } = useResolvedUser();
  if (isResolving) return <PageLoading />;
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />;
  return <Navigate to={getDefaultRouteByRole(user)} replace />;
};

// eslint-disable-next-line react-refresh/only-export-components
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  mode?: AccessMode;
}> = ({ children, mode = "authenticated" }) => {
  const { user, isResolving } = useResolvedUser();

  if (isResolving) {
    return <PageLoading />;
  }

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
          <AdminDashboardPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_USER_MANAGEMENT,
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
    path: ROUTES.ADMIN_ALL_BOOKINGS,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminAllBookingListPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_BOOKING_DETAIL,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminBookingDetailPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_BUILDING_MANAGEMENT,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminBuildingManagementPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_BUILDING_FLOORS,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminBuildingFloorsPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_ROOM_MANAGEMENT,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminRoomManagementPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_AMENITY_MANAGEMENT,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminAmenityManagementPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    // start+ chức năng CRUD dịch vụ đi kèm (route admin)
    path: ROUTES.ADMIN_SERVICE_ITEMS,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminServiceItemManagementPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    // end+ chức năng CRUD dịch vụ đi kèm (route admin)
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_FLOOR_LAYOUT,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminFloorLayoutPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_ACADEMIC_SCHEDULE,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminAcademicSchedulePage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_EVENT_BOOKINGS,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminEventBookingListPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: ROUTES.ADMIN_EVENT_BOOKING_DETAIL,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminEventBookingDetailPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  // start+ chức năng admin quản lý recurring series
  {
    path: ROUTES.ADMIN_RECURRING_SERIES,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminRecurringSeriesPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  // end+ chức năng admin quản lý recurring series
  {
    path: ROUTES.ADMIN_FEEDBACK_MANAGEMENT,
    element: (
      <ProtectedRoute mode="admin-only">
        <SuspenseWrapper>
          <AdminFeedbackManagementPage />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute mode="authenticated">
        <SuspenseWrapper>
          <MainLayout />
        </SuspenseWrapper>
      </ProtectedRoute>
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
        path: ROUTES.BOOKING_DETAIL,
        element: (
          <SuspenseWrapper>
            <BookingDetailPage />
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
        // start+ chức năng 3 màn hình đặt phòng (đặt phòng định kì)
        path: ROUTES.BOOK_ROOM_RECURRING,
        element: (
          <SuspenseWrapper>
            <BookRoomRecurringPage />
          </SuspenseWrapper>
        ),
        // end+ chức năng 3 màn hình đặt phòng (đặt phòng định kì)
      },
      {
        // start+ chức năng 3 màn hình đặt phòng (đặt phòng sự kiện)
        path: ROUTES.BOOK_ROOM_EVENT,
        element: (
          <SuspenseWrapper>
            <BookRoomEventPage />
          </SuspenseWrapper>
        ),
        // end+ chức năng 3 màn hình đặt phòng (đặt phòng sự kiện)
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
      {
        // start+ chức năng check-in bằng QR (route demo)
        path: ROUTES.CHECKIN_QR,
        element: (
          <SuspenseWrapper>
            <QrCheckInPage />
          </SuspenseWrapper>
        ),
        // end+ chức năng check-in bằng QR (route demo)
      },
      {
        // start+ chức năng đặt phòng lặp lại (route demo)
        path: ROUTES.MY_RECURRING_SERIES,
        element: (
          <SuspenseWrapper>
            <MyRecurringSeriesPage />
          </SuspenseWrapper>
        ),
        // end+ chức năng đặt phòng lặp lại (route demo)
      },
      // {
      //   // start+ chức năng đặt phòng theo sự kiện (route demo)
      //   path: ROUTES.EVENT_DEMO,
      //   element: (
      //     <SuspenseWrapper>
      //       <EventDemoPage />
      //     </SuspenseWrapper>
      //   ),
      //   // end+ chức năng đặt phòng theo sự kiện (route demo)
      // },
      {
        // start+ chức năng đặt phòng theo sự kiện (route setup)
        path: ROUTES.EVENT_SETUP,
        element: (
          <SuspenseWrapper>
            <EventSetupPage />
          </SuspenseWrapper>
        ),
        // end+ chức năng đặt phòng theo sự kiện (route setup)
      },
      {
        // start+ chức năng sự kiện đang diễn ra (route live)
        path: ROUTES.EVENT_LIVE,
        element: (
          <SuspenseWrapper>
            <EventLivePage />
          </SuspenseWrapper>
        ),
        // end+ chức năng sự kiện đang diễn ra (route live)
      },
      // Task Management
      {
        path: ROUTES.TASKS,
        element: <SuspenseWrapper><TaskListPage /></SuspenseWrapper>,
      },
      {
        path: ROUTES.TASK_CREATE,
        element: <SuspenseWrapper><TaskCreatePage /></SuspenseWrapper>,
      },
      {
        path: ROUTES.TASK_DETAIL,
        element: <SuspenseWrapper><TaskDetailPage /></SuspenseWrapper>,
      },
      // Meeting Management
      {
        path: ROUTES.MEETINGS,
        element: <SuspenseWrapper><MeetingListPage /></SuspenseWrapper>,
      },
      {
        path: ROUTES.MEETING_DETAIL,
        element: <SuspenseWrapper><MeetingDetailPage /></SuspenseWrapper>,
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
  {
    key: "user-management",
    path: ROUTES.ADMIN_USER_MANAGEMENT,
    label: "User Management",
    icon: "users",
  },
] as const;
