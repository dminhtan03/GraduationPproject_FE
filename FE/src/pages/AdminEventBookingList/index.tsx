import React, { useEffect, useState } from "react";
import { Table, Tag, Space, Input, Button } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeIcon } from "@heroicons/react/24/outline";
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
  if (normalized === "RESERVED") return "green";
  if (normalized === "IN_USE") return "blue";
  if (normalized === "COMPLETED") return "cyan";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "FORCE_CANCELLED") return "volcano";
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
      const res = await api.get(API_ENDPOINTS.AUTH.PROFILE);
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
      render: (text, record) => (
        <div>
          <div className="font-semibold text-slate-900">{text}</div>
          <div className="text-xs text-slate-500">{record.reservationId}</div>
        </div>
      ),
    },
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="text-sm text-slate-900">{record.userName}</div>
          <div className="text-xs text-slate-500">{record.userEmail}</div>
        </div>
      ),
    },
    {
      title: "Room",
      key: "room",
      render: (_, record) => (
        <span className="text-sm font-medium text-slate-900">
          {record.roomCode || record.roomName || "N/A"}
        </span>
      ),
    },
    {
      title: "Time",
      key: "time",
      render: (_, record) => (
        <div className="text-xs text-slate-600">
          <div>{new Date(record.startTime).toLocaleString()}</div>
          <div>{new Date(record.endTime).toLocaleString()}</div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status.replace("_", " ")}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EyeIcon className="h-5 w-5 text-slate-400 hover:text-orange-500" />}
            onClick={() => navigate(`/admin/event-bookings/${record.reservationId}`)}
          />
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
              <h1 className="text-2xl font-bold text-slate-900">Manage Event booking</h1>
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
