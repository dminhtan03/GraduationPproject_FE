import React, { useCallback, useEffect, useState } from "react";
import {
  Bars3Icon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import {
  Table,
  Alert,
  Select,
  Button,
  Tag,
  Space,
  Empty,
  Tooltip,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { adminService } from "../../services/adminService";
import { logout } from "../../services/authService";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import DatePickerField from "../../components/common/DatePickerField";
import { extractApiMessage } from "../../utils/errorHandlers";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";

interface BookingRow {
  id?: string;
  bookingId?: string;
  user?: string;
  userName?: string;
  room?: string;
  roomName?: string;
  roomType?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  time?: string;
  timeSlot?: string;
  status?: string;
}

interface BuildingOption {
  label: string;
  value: string;
}

const PAGE_SIZE = 10;

const getStatusColor = (status: string) => {
  const normalized = status?.toUpperCase() || "";
  if (normalized === "PENDING") return "gold";
  if (normalized === "CONFIRMED") return "green";
  if (normalized === "CHECKED_IN" || normalized === "IN_USE") return "blue";
  if (normalized === "COMPLETED") return "cyan";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "NO_SHOW") return "orange";
  if (normalized === "REJECTED") return "volcano";
  return "default";
};

const parseDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toBackendStartTime = (date?: string) => {
  if (!date) return undefined;
  return `${date}T00:00:00`;
};

const toBackendEndTime = (date?: string) => {
  if (!date) return undefined;
  return `${date}T23:59:59`;
};

const formatDate = (dateStr?: string) => {
  const date = parseDate(dateStr);
  if (!date) return "-";
  return date.toLocaleDateString();
};

const formatTime = (dateStr?: string) => {
  const date = parseDate(dateStr);
  if (!date) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const AdminAllBookingListPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [adminName, setAdminName] = useState("Admin User");
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  // Filter form states
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [buildingNameFilter, setBuildingNameFilter] = useState<string>("");
  const [buildingOptions, setBuildingOptions] = useState<BuildingOption[]>([]);

  // Applied filter states (used for backend query)
  const [appliedStatus, setAppliedStatus] = useState<string>("All");
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");
  const [appliedBuildingName, setAppliedBuildingName] = useState<string>("");

  const loadAdminProfile = async () => {
    try {
      const res = await fetch("/api/v1/auth/profile");
      if (res.ok) {
        const data = await res.json();
        const firstName = data.data?.firstName || data.firstName || "";
        const lastName = data.data?.lastName || data.lastName || "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        setAdminName(fullName || "Admin User");
      }
    } catch {
      setAdminName("Admin User");
    }
  };

  const loadBuildingOptions = useCallback(async () => {
    try {
      const response = await adminService.getAllBuildings();
      const buildings = Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.content)
            ? response.content
            : [];

      const mapped = buildings
        .map((item: any) => {
          const name = String(item?.name || "").trim();
          if (!name) return null;
          return { label: name, value: name };
        })
        .filter(Boolean) as BuildingOption[];

      const uniqueByValue = Array.from(
        new Map(mapped.map((option) => [option.value, option])).values(),
      );

      setBuildingOptions(uniqueByValue);
    } catch {
      setBuildingOptions([]);
    }
  }, []);

  useEffect(() => {
    loadAdminProfile();
    loadBuildingOptions();
  }, [loadBuildingOptions]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminService
      .getAllBookings(page - 1, pageSize, {
        startTime: toBackendStartTime(appliedStartDate),
        endTime: toBackendEndTime(appliedEndDate),
        buildingName: appliedBuildingName || undefined,
        status: appliedStatus !== "All" ? appliedStatus : undefined,
      })
      .then((result) => {
        setBookings(result.items);
        setTotal(result.total);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(extractApiMessage(e, "Unable to load bookings"));
        setBookings([]);
        setTotal(0);
        setLoading(false);
      });
  }, [appliedStatus, appliedStartDate, appliedEndDate, appliedBuildingName, page, pageSize]);

  const handleApplyFilters = () => {
    setAppliedStatus(statusFilter);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedBuildingName((buildingNameFilter || "").trim());
    setPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter("All");
    setStartDate("");
    setEndDate("");
    setBuildingNameFilter("");
    setAppliedStatus("All");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setAppliedBuildingName("");
    setPage(1);
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    const nextPage = pagination.current || 1;
    const nextSize = pagination.pageSize || PAGE_SIZE;
    setPage(nextPage);
    setPageSize(nextSize);
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const showToast = (type: MessageType, nextMessage: string) => {
    setToastPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setToastPopup((current) =>
        current && current.message === nextMessage ? null : current,
      );
    }, 3000);
  };

  const handleExportCSV = () => {
    if (bookings.length === 0) {
      showToast("warning", "No bookings to export");
      return;
    }

    const headers = [
      "BOOKING ID",
      "USER NAME",
      "ROOM NAME",
      "START TIME",
      "END TIME",
      "STATUS",
    ];
    const rows = bookings.map((booking) => [
      booking.bookingId || booking.id || "-",
      booking.userName || booking.user || "-",
      booking.roomName || booking.room || "-",
      booking.startTime ? new Date(booking.startTime).toLocaleString() : "-",
      (booking.endTime || booking.date) ? new Date(booking.endTime || booking.date || "").toLocaleString() : "-",
      booking.status || "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell}"`
              : cell,
          )
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast("success", "Exported to CSV successfully");
  };

  const handlePrintReport = () => {
    if (bookings.length === 0) {
      showToast("warning", "No bookings to print");
      return;
    }

    const printWindow = window.open("", "", "height=600,width=800");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>All Bookings Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { text-align: center; }
            .print-date { text-align: right; font-size: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>All Bookings Master List</h1>
          <div class="print-date">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <tr>
              <th>BOOKING ID</th>
              <th>USER NAME</th>
              <th>ROOM NAME</th>
              <th>START TIME</th>
              <th>END TIME</th>
              <th>STATUS</th>
            </tr>
            ${bookings
              .map(
                (booking) => `
              <tr>
                <td>${booking.bookingId || booking.id || "-"}</td>
                <td>${booking.userName || booking.user || "-"}</td>
                <td>${booking.roomName || booking.room || "-"}</td>
                <td>${booking.startTime ? new Date(booking.startTime).toLocaleString() : "-"}</td>
                <td>${booking.endTime ? new Date(booking.endTime).toLocaleString() : booking.date ? new Date(booking.date).toLocaleString() : "-"}</td>
                <td>${booking.status || "-"}</td>
              </tr>
            `,
              )
              .join("")}
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
    showToast("success", "Print dialog opened");
  };

  const columns: ColumnsType<BookingRow> = [
    {
      title: "BOOKING ID",
      dataIndex: "bookingId",
      key: "bookingId",
      width: "10%",
      render: (value, record) => value || record.id || "-",
    },
    {
      title: "USER NAME",
      dataIndex: "userName",
      key: "userName",
      width: "12%",
      render: (value, record) => value || record.user || "-",
    },
    {
      title: "ROOM NAME",
      dataIndex: "roomName",
      key: "roomName",
      width: "12%",
      render: (value, record) => value || record.room || "-",
    },
    {
      title: "START TIME",
      key: "startTime",
      width: "14%",
      render: (_, record) => {
        const dateStr = record.startTime;
        return dateStr ? new Date(dateStr).toLocaleString() : "-";
      },
    },
    {
      title: "END TIME",
      key: "endTime",
      width: "14%",
      render: (_, record) => {
        const dateStr = record.endTime || record.date;
        return dateStr ? new Date(dateStr).toLocaleString() : "-";
      },
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "11%",
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status || "-"}</Tag>
      ),
    },
    {
      title: "ACTIONS",
      key: "actions",
      width: "11%",
      render: (_, record) => (
        <Space>
          <Tooltip title="View details">
            <Button
              type="text"
              size="small"
              onClick={() => {
                showToast("info", "View details feature coming soon");
              }}
            >
              View
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar
        adminName={adminName}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden ml-72">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              All Bookings Master List
            </h1>
          </div>

          {toastPopup && (
            <CustomMessage
              type={toastPopup.type}
              message={toastPopup.message}
              onClose={() => setToastPopup(null)}
            />
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Filters Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Filter Bookings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-6">
              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Start Date
                </label>
                <DatePickerField
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  End Date
                </label>
                <DatePickerField
                  value={endDate}
                  onChange={setEndDate}
                  minDate={startDate}
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-full"
                  options={[
                    { label: "All Statuses", value: "All" },
                    { label: "Pending", value: "PENDING" },
                    { label: "Confirmed", value: "CONFIRMED" },
                    { label: "Checked In", value: "CHECKED_IN" },
                    { label: "Completed", value: "COMPLETED" },
                    { label: "Cancelled", value: "CANCELLED" },
                    { label: "No Show", value: "NO_SHOW" },
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Building Name
                </label>
                <Select
                  value={buildingNameFilter || undefined}
                  onChange={(value) => setBuildingNameFilter(value || "")}
                  allowClear
                  placeholder="Select building"
                  className="w-full"
                  options={buildingOptions}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="primary"
                onClick={handleApplyFilters}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Apply Filters
              </Button>
              <Button onClick={handleResetFilters}>Reset</Button>
            </div>
          </div>

          {error && (
            <Alert
              className="mb-4"
              type="error"
              showIcon
              message="Unable to load bookings"
              description={error}
              closable
            />
          )}

          {/* Bookings Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-6">
            {bookings.length === 0 && !loading && !error ? (
              <Empty
                style={{ padding: "60px 20px" }}
                description="No bookings match your filters"
              />
            ) : (
              <Table<BookingRow>
                rowKey={(record, index) =>
                  record.bookingId ||
                  record.id ||
                  `booking-${index}`
                }
                loading={loading}
                columns={columns}
                dataSource={bookings}
                pagination={{
                  current: page,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  pageSizeOptions: ["10", "20", "50"],
                }}
                onChange={handleTableChange}
                className="border-none"
              />
            )}
          </div>

          {/* Export/Print Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              icon={<ArrowDownTrayIcon className="w-4 h-4" />}
              onClick={handleExportCSV}
            >
              Export to CSV
            </Button>
            <Button
              icon={<PrinterIcon className="w-4 h-4" />}
              onClick={handlePrintReport}
            >
              Print Report
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminAllBookingListPage;
