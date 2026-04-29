import React, { useEffect, useState } from "react";
import { Table, Tag, Space, Input, Button } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeIcon } from "@heroicons/react/24/outline";
import { ClockIcon } from "@heroicons/react/24/solid";
import { adminService } from "../../services/adminService";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { logout } from "../../services/authService";

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

const getStatusColor = (status: string) => {
  const normalized = status?.trim().toUpperCase() || "";
  if (normalized === "RESERVED") return "success";
  if (normalized === "NO_SHOW") return "warning";
  if (normalized === "IN_USE") return "processing";
  if (normalized === "COMPLETED") return "success";
  if (normalized === "CANCELLED") return "error";
  if (normalized === "FORCE_CANCELLED") return "error";
  return "default";
};

const AdminEventBookingListPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");

  const loadAdminProfile = async () => {
    try {
      const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
      const data = res.data?.data || res.data;
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(data.email || "");
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
      const totalElements = typeof res?.meta?.total === "number" ? res.meta.total : content.length;

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
          <div className="text-sm font-semibold text-slate-900">{record.userName}</div>
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
          const startTime = start.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
          const endTime = end.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
          
          return (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-700">{startDate}</div>
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
      render: (status: string) => {
        const displayText = status
          .replace(/_/g, " ")
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
        return (
          <Tag color={getStatusColor(status)}>{displayText}</Tag>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Space size="middle">
          <button
            onClick={() => navigate(`/admin/event-bookings/${record.reservationId}`)}
            className="rounded-lg p-1.5 hover:bg-orange-50 transition-colors"
          >
            <EyeIcon className="h-5 w-5 text-slate-400 hover:text-orange-500" />
          </button>
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
              <h1 className="text-2xl font-bold text-slate-900">Manage Event Booking</h1>
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
              pagination={{
                current: page,
                pageSize: pageSize,
                total: total,
                onChange: (p, s) => {
                  setPage(p);
                  setPageSize(s);
                },
                showSizeChanger: true,
                className: "px-4",
              }}
              className="overflow-hidden"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminEventBookingListPage;
