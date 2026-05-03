import React, { useEffect, useState } from "react";
import { Table, Space, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Bars3Icon, EyeIcon } from "@heroicons/react/24/outline";
import { ClockIcon } from "@heroicons/react/24/solid";
import { adminService } from "../../services/adminService";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { logout } from "../../services/authService";
import { CustomPagination } from "../../components/common";

interface EventRow {
  eventId: string;
  reservationId: string;
  title: string;
  description: string;
  visibility: string;
  startTime: string;
  endTime: string;
  status: string;
  roomName: string;
  roomCode: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

const AdminEventBookingListPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");

  const loadAdminProfile = async () => {
    try {
      const res = await api.get(API_ENDPOINTS.AUTH.PROFILE);
      const responseData = res.data as unknown;
      let profile: unknown = responseData;

      if (
        responseData &&
        typeof responseData === "object" &&
        "data" in responseData
      ) {
        profile = (responseData as { data?: unknown }).data;
      }

      const profileData = (profile || {}) as {
        firstName?: string;
        lastName?: string;
        email?: string;
      };
      const fullName = [profileData.firstName, profileData.lastName]
        .filter(Boolean)
        .join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(profileData.email || "");
    } catch {
      setAdminName("Admin User");
    }
  };

  const loadEvents = async (p: number, s: number) => {
    setLoading(true);
    try {
      const res = await adminService.getAdminEvents(p - 1, s);
      console.log("Admin events response:", res);

      // Backend Response structure for Page:
      // { data: [...items], meta: { total: 100, ... } }
      // adminService.getAdminEvents returns res.data (the whole Response object)

      const content = Array.isArray(res?.data) ? res.data : [];
      const totalElements =
        typeof res?.meta?.total === "number" ? res.meta.total : content.length;

      console.log("Extracted content:", content);
      console.log("Extracted total:", totalElements);

      setEvents(content);
      setTotal(totalElements);
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminProfile();
    loadEvents(page, pageSize);
  }, [page, pageSize]);

  const columns: ColumnsType<EventRow> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text) => (
        <div className="inline-block rounded-lg bg-orange-50 px-3 py-1.5">
          <span className="font-semibold text-orange-700">{text}</span>
        </div>
      ),
    },
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {record.userName}
          </div>
          <div className="text-xs text-slate-500">{record.userEmail}</div>
        </div>
      ),
    },
    {
      title: "Room",
      key: "room",
      render: (_, record) => (
        <div className="inline-block rounded-lg bg-slate-100 px-3 py-1.5">
          <span className="text-sm font-semibold text-slate-900">
            {record.roomCode || record.roomName || "N/A"}
          </span>
        </div>
      ),
    },
    {
      title: "Time",
      key: "time",
      render: (_, record) => {
        try {
          const start = new Date(record.startTime);
          const end = new Date(record.endTime);

          const startDate = start.toLocaleDateString("vi-VN");
          const startTime = start.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const endTime = end.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          return (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700">
                {startDate}
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5">
                <ClockIcon className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">
                  {startTime} - {endTime}
                </span>
              </div>
            </div>
          );
        } catch {
          return <span className="text-sm text-slate-500">Invalid time</span>;
        }
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string | undefined) => {
        const normalized = String(status || "").toUpperCase();
        const label =
          normalized === "IN_USE" || normalized === "CHECKED_IN"
            ? "On-going"
            : normalized === "APPROVED" || normalized === "RESERVED"
              ? "In-coming"
              : normalized === "COMPLETED"
                ? "Completed"
                : normalized === "CANCELLED" ||
                    normalized === "NO_SHOW" ||
                    normalized === "FORCE_CANCELLED"
                  ? "Cancelled"
                  : normalized === "PENDING"
                    ? "Pending"
                    : status || "—";
        const cls =
          normalized === "IN_USE" || normalized === "CHECKED_IN"
            ? "bg-emerald-50 text-emerald-700"
            : normalized === "APPROVED" || normalized === "RESERVED"
              ? "bg-blue-50 text-blue-700"
              : normalized === "COMPLETED"
                ? "bg-slate-100 text-slate-700"
                : normalized === "CANCELLED" ||
                    normalized === "NO_SHOW" ||
                    normalized === "FORCE_CANCELLED"
                  ? "bg-red-50 text-red-600"
                  : normalized === "PENDING"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-500";
        return (
          <span
            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="View booking detail">
            <button
              type="button"
              onClick={() =>
                navigate(`/admin/event-bookings/${record.reservationId}`)
              }
              className="group inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-100 hover:shadow"
            >
              <EyeIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              View
            </button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="flex-1 lg:pl-72">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open admin sidebar"
                >
                  <Bars3Icon className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">
                  Event Booking Management
                </h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                View and manage all event-related room bookings.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Table
              columns={columns}
              dataSource={events}
              rowKey="eventId"
              loading={loading}
              pagination={false}
              className="overflow-hidden"
            />
            {total > 0 && Math.ceil(total / pageSize) > 1 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <CustomPagination
                  currentPage={page}
                  totalPages={Math.ceil(total / pageSize)}
                  onPageChange={(p) => setPage(p)}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminEventBookingListPage;
