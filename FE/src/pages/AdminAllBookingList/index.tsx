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
  Input,
  Button,
  Tag,
  Space,
  Empty,
  Tooltip,
  Modal,
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
  reservationId?: string;
  reservationID?: string;
  reservation_id?: string;
  bookingId?: string;
  bookingID?: string;
  booking_id?: string;
  user?: string;
  userName?: string;
  userEmail?: string;
  room?: string;
  roomName?: string;
  floorName?: string;
  buildingName?: string;
  roomType?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  time?: string;
  timeSlot?: string;
  status?: string;
  rawData?: Record<string, unknown>;
}

interface BuildingOption {
  label: string;
  value: string;
  name: string;
}

interface FloorOption {
  label: string;
  value: string;
}

const PAGE_SIZE = 10;
const FORCE_CANCEL_QUICK_ACTIONS = [
  "Reclaimed for a university event",
  "Scheduled maintenance",
  "Already booked in advance",
];

const pad = (value: number) => value.toString().padStart(2, "0");
const ALL_HOURS = Array.from({ length: 24 }, (_, index) => pad(index));
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50", "59"];

const toDatePart = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const DEFAULT_START_CLOCK = "00:00";
const DEFAULT_END_CLOCK = "23:59";

const combineDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue || !timeValue) return "";
  return `${dateValue}T${timeValue}`;
};

const getClockHour = (clock: string) => {
  if (!clock.includes(":")) return "";
  return clock.split(":")[0] || "";
};

const getClockMinute = (clock: string) => {
  if (!clock.includes(":")) return "";
  return clock.split(":")[1] || "";
};

const getStatusColor = (status: string) => {
  const normalized = status?.trim().toUpperCase() || "";
  if (normalized === "RESERVED") return "green";
  if (normalized === "IN_USE") return "blue";
  if (normalized === "COMPLETED") return "cyan";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "FORCE_CANCELLED") return "volcano";
  if (normalized === "NO_SHOW") return "orange";
  if (normalized === "FAILED") return "orange";
  return "default";
};

const parseDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDateTimeForApi = (value?: string) => {
  if (!value) return undefined;
  // Native datetime-local returns YYYY-MM-DDTHH:mm, BE expects seconds.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }
  return value;
};

const getTextFromUnknown = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const parseFloorNumber = (text: string): number | null => {
  const matched = text.match(/(\d+)/);
  if (!matched) return null;
  const value = Number(matched[1]);
  return Number.isFinite(value) ? value : null;
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
  const [startClock, setStartClock] = useState<string>(DEFAULT_START_CLOCK);
  const [endClock, setEndClock] = useState<string>(DEFAULT_END_CLOCK);
  const [userEmailFilter, setUserEmailFilter] = useState<string>("");
  const [roomNameFilter, setRoomNameFilter] = useState<string>("");
  const [floorNameFilter, setFloorNameFilter] = useState<string>("");
  const [buildingNameFilter, setBuildingNameFilter] = useState<string>("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [buildingOptions, setBuildingOptions] = useState<BuildingOption[]>([]);
  const [floorOptions, setFloorOptions] = useState<FloorOption[]>([]);
  const [forceCancelLoadingId, setForceCancelLoadingId] = useState<string | null>(
    null,
  );
  const [forceCancelModalOpen, setForceCancelModalOpen] = useState(false);
  const [forceCancelReservationId, setForceCancelReservationId] = useState("");
  const [forceCancelReason, setForceCancelReason] = useState("");
  const [forceCancelReasonOptions] = useState<Array<{ label: string; value: string }>>(
    FORCE_CANCEL_QUICK_ACTIONS.map((reason) => ({
      label: reason,
      value: reason,
    })),
  );

  // Applied filter states (used for backend query)
  const [appliedStatus, setAppliedStatus] = useState<string>("All");
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");
  const [appliedUserEmail, setAppliedUserEmail] = useState<string>("");
  const [appliedRoomName, setAppliedRoomName] = useState<string>("");
  const [appliedFloorName, setAppliedFloorName] = useState<string>("");
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
          const id = String(item?.id ?? item?.buildingId ?? "").trim();
          const name = String(item?.name ?? item?.buildingName ?? "").trim();
          if (!id || !name) return null;
          return { label: name, value: id, name };
        })
        .filter(Boolean) as BuildingOption[];

      const uniqueByValue = Array.from(
        new Map(mapped.map((option) => [option.value, option])).values(),
      );

      setBuildingOptions(
        uniqueByValue.sort((left, right) =>
          left.label.localeCompare(right.label, undefined, { numeric: true }),
        ),
      );
    } catch {
      setBuildingOptions([]);
    }
  }, []);

  const loadFloorOptions = useCallback(async (buildingId: string) => {
    const normalizedBuildingId = String(buildingId || "").trim();
    if (!normalizedBuildingId) {
      setFloorOptions([]);
      return;
    }

    try {
      const response = await adminService.getFloorsByBuilding(normalizedBuildingId);
      const floors = Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.content)
            ? response.content
            : [];

      const mapped = floors
        .map((item: any) => {
          const rawName = String(item?.name ?? item?.floorName ?? "").trim();
          if (!rawName) return null;
          const floorNumber = parseFloorNumber(rawName);
          return {
            label: rawName,
            value: rawName,
            floorNumber,
          };
        })
        .filter(
          (
            item,
          ): item is FloorOption & {
            floorNumber: number | null;
          } => !!item,
        );

      const unique = Array.from(
        new Map(mapped.map((item) => [item.value, item])).values(),
      );

      const sorted = unique
        .sort((left, right) => {
          if (left.floorNumber != null && right.floorNumber != null) {
            return left.floorNumber - right.floorNumber;
          }
          if (left.floorNumber != null) return -1;
          if (right.floorNumber != null) return 1;
          return left.label.localeCompare(right.label, undefined, { numeric: true });
        })
        .map(({ label, value }) => ({ label, value }));

      setFloorOptions(sorted);
    } catch {
      setFloorOptions([]);
    }
  }, []);

  useEffect(() => {
    loadAdminProfile();
    loadBuildingOptions();
  }, [loadBuildingOptions]);

  useEffect(() => {
    if (!selectedBuildingId) {
      setFloorOptions([]);
      return;
    }

    void loadFloorOptions(selectedBuildingId);
  }, [loadFloorOptions, selectedBuildingId]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const normalizedStart = normalizeDateTimeForApi(appliedStartDate);
    const normalizedEnd = normalizeDateTimeForApi(appliedEndDate);

    adminService
      .getAllBookings(page - 1, pageSize, {
        startDate: normalizedStart,
        endDate: normalizedEnd,
        userEmail: appliedUserEmail || undefined,
        roomName: appliedRoomName || undefined,
        floorName: appliedFloorName || undefined,
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
  }, [
    appliedStatus,
    appliedStartDate,
    appliedEndDate,
    appliedUserEmail,
    appliedRoomName,
    appliedFloorName,
    appliedBuildingName,
    page,
    pageSize,
  ]);

  const handleApplyFilters = () => {
    let normalizedStart = "";
    let normalizedEnd = "";

    // If both dates are provided, validate them
    if (startDate && endDate) {
      const startDateTime = combineDateTime(startDate, startClock);
      const endDateTime = combineDateTime(endDate, endClock);
      normalizedStart = normalizeDateTimeForApi(startDateTime) || "";
      normalizedEnd = normalizeDateTimeForApi(endDateTime) || "";
      const parsedStart = parseDate(normalizedStart);
      const parsedEnd = parseDate(normalizedEnd);

      if (parsedStart && parsedEnd && parsedEnd <= parsedStart) {
        showToast("warning", "End time must be later than Start time");
        return;
      }
    }
    // If only one date is provided, show warning
    else if ((startDate && !endDate) || (!startDate && endDate)) {
      showToast("warning", "Please select both start and end dates, or leave both empty to show all");
      return;
    }
    // If both are empty, that's OK - will show all bookings

    setAppliedStatus(statusFilter);
    setAppliedStartDate(normalizedStart);
    setAppliedEndDate(normalizedEnd);
    setAppliedUserEmail(userEmailFilter.trim());
    setAppliedRoomName(roomNameFilter.trim());
    setAppliedFloorName(floorNameFilter.trim());
    setAppliedBuildingName((buildingNameFilter || "").trim());
    setPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter("All");
    setStartDate("");
    setEndDate("");
    setStartClock(DEFAULT_START_CLOCK);
    setEndClock(DEFAULT_END_CLOCK);
    setUserEmailFilter("");
    setRoomNameFilter("");
    setFloorNameFilter("");
    setSelectedBuildingId("");
    setFloorOptions([]);
    setBuildingNameFilter("");
    setAppliedStatus("All");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setAppliedUserEmail("");
    setAppliedRoomName("");
    setAppliedFloorName("");
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

  const getReservationKey = (record: BookingRow): string =>
    (() => {
      const rawReservation = (record.rawData?.["reservation"] ||
        null) as Record<string, unknown> | null;

      return (
        getTextFromUnknown(record.reservationId) ||
        getTextFromUnknown(record.reservationID) ||
        getTextFromUnknown(record.reservation_id) ||
        getTextFromUnknown(record.bookingId) ||
        getTextFromUnknown(record.bookingID) ||
        getTextFromUnknown(record.booking_id) ||
        getTextFromUnknown(record.id) ||
        getTextFromUnknown(record.rawData?.["reservationId"]) ||
        getTextFromUnknown(record.rawData?.["reservationID"]) ||
        getTextFromUnknown(record.rawData?.["reservation_id"]) ||
        getTextFromUnknown(record.rawData?.["bookingId"]) ||
        getTextFromUnknown(record.rawData?.["bookingID"]) ||
        getTextFromUnknown(record.rawData?.["booking_id"]) ||
        getTextFromUnknown(record.rawData?.["reservationUuid"]) ||
        getTextFromUnknown(record.rawData?.["uuid"]) ||
        getTextFromUnknown(record.rawData?.["id"]) ||
        getTextFromUnknown(rawReservation?.["reservationId"]) ||
        getTextFromUnknown(rawReservation?.["id"]) ||
        ""
      );
    })();

  const canForceCancel = (status?: string) => {
    const normalized = String(status || "")
      .trim()
      .toUpperCase()
      .replace(/[-\s]+/g, "_");
    return normalized === "RESERVED" || normalized === "IN_USE";
  };

  const reloadBookings = async () => {
    const normalizedStart = normalizeDateTimeForApi(appliedStartDate);
    const normalizedEnd = normalizeDateTimeForApi(appliedEndDate);
    const result = await adminService.getAllBookings(page - 1, pageSize, {
      startDate: normalizedStart,
      endDate: normalizedEnd,
      userEmail: appliedUserEmail || undefined,
      roomName: appliedRoomName || undefined,
      floorName: appliedFloorName || undefined,
      buildingName: appliedBuildingName || undefined,
      status: appliedStatus !== "All" ? appliedStatus : undefined,
    });
    setBookings(result.items);
    setTotal(result.total);
  };

  const handleForceCancel = (record: BookingRow) => {
    if (!canForceCancel(record.status)) {
      showToast(
        "warning",
        `Cannot force cancel booking with status: ${String(record.status || "UNKNOWN")}`,
      );
      return;
    }

    const initialReservationId = getReservationKey(record);
    setForceCancelReservationId(initialReservationId);
    setForceCancelReason(forceCancelReasonOptions[0]?.value || "");
    setForceCancelModalOpen(true);
  };

  const submitForceCancel = async () => {
    const reservationId = forceCancelReservationId.trim();
    if (!reservationId) {
      showToast("error", "Reservation id is required");
      return;
    }

    const reason = forceCancelReason.trim() || "Force cancel by admin";

    try {
      setForceCancelLoadingId(reservationId);
      const message = await adminService.forceCancelBooking(reservationId, {
        reason,
      });
      showToast(
        "success",
        message || "Force cancel success. User will receive an email notification.",
      );
      setForceCancelModalOpen(false);
      await reloadBookings();
    } catch (error: unknown) {
      showToast("error", extractApiMessage(error, "Force cancel failed"));
    } finally {
      setForceCancelLoadingId(null);
    }
  };

  const handleExportCSV = () => {
    if (bookings.length === 0) {
      showToast("warning", "No bookings to export");
      return;
    }

    const csvContent = [
      ["USER NAME", "ROOM NAME", "START TIME", "END TIME", "STATUS"].join(","),
      ...bookings.map((booking) => [
        booking.userName || booking.user || "-",
        booking.roomName || booking.room || "-",
        booking.startTime ? new Date(booking.startTime).toLocaleString() : "-",
        (booking.endTime || booking.date) ? new Date(booking.endTime || booking.date || "").toLocaleString() : "-",
        booking.status || "-",
      ]
        .map((cell) =>
          typeof cell === "string" && cell.includes(",")
            ? `"${cell}"`
            : cell,
        )
        .join(",")),
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
          <h1>All Bookings List</h1>
          <div class="print-date">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <tr>
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

  const userNameColumnFilters = Array.from(
    new Set(
      bookings
        .map((item) => (item.userName || item.user || "").trim())
        .filter(Boolean),
    ),
  ).map((value) => ({ text: value, value }));

  const roomNameColumnFilters = Array.from(
    new Set(
      bookings
        .map((item) => (item.roomName || item.room || "").trim())
        .filter(Boolean),
    ),
  ).map((value) => ({ text: value, value }));

  const statusColumnFilters = Array.from(
    new Set(bookings.map((item) => String(item.status || "").trim()).filter(Boolean)),
  ).map((value) => ({ text: value, value }));

  const columns: ColumnsType<BookingRow> = [
    {
      title: "USER NAME",
      dataIndex: "userName",
      key: "userName",
      width: "14%",
      sorter: (a, b) =>
        String(a.userName || a.user || "").localeCompare(
          String(b.userName || b.user || ""),
        ),
      filters: userNameColumnFilters,
      onFilter: (value, record) =>
        String(record.userName || record.user || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (value, record) => value || record.user || "-",
    },
    {
      title: "ROOM NAME",
      dataIndex: "roomName",
      key: "roomName",
      width: "14%",
      sorter: (a, b) =>
        String(a.roomName || a.room || "").localeCompare(
          String(b.roomName || b.room || ""),
        ),
      filters: roomNameColumnFilters,
      onFilter: (value, record) =>
        String(record.roomName || record.room || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (value, record) => value || record.room || "-",
    },
    {
      title: "START TIME",
      key: "startTime",
      width: "15%",
      sorter: (a, b) => {
        const left = parseDate(a.startTime)?.getTime() || 0;
        const right = parseDate(b.startTime)?.getTime() || 0;
        return left - right;
      },
      render: (_, record) => {
        const dateStr = record.startTime;
        return dateStr ? new Date(dateStr).toLocaleString() : "-";
      },
    },
    {
      title: "END TIME",
      key: "endTime",
      width: "15%",
      sorter: (a, b) => {
        const left = parseDate(a.endTime || a.date)?.getTime() || 0;
        const right = parseDate(b.endTime || b.date)?.getTime() || 0;
        return left - right;
      },
      render: (_, record) => {
        const dateStr = record.endTime || record.date;
        return dateStr ? new Date(dateStr).toLocaleString() : "-";
      },
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      width: "13%",
      sorter: (a, b) =>
        String(a.status || "").localeCompare(String(b.status || "")),
      filters: statusColumnFilters,
      onFilter: (value, record) =>
        String(record.status || "")
          .toLowerCase()
          .includes(String(value).toLowerCase()),
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status || "-"}</Tag>
      ),
    },
    {
      title: "ACTIONS",
      key: "actions",
      width: "13%",
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
          {canForceCancel(record.status) && Boolean(getReservationKey(record)) && (
            <Tooltip title="Force cancel booking">
              <Button
                danger
                size="small"
                loading={forceCancelLoadingId === getReservationKey(record)}
                onClick={() => handleForceCancel(record)}
              >
                Force Cancel
              </Button>
            </Tooltip>
          )}
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
              All Bookings List
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
          <Modal
            title="Are you sure to cancel booking?"
            open={forceCancelModalOpen}
            onCancel={() => setForceCancelModalOpen(false)}
            onOk={submitForceCancel}
            okText="Force Cancel"
            cancelText="Close"
            okButtonProps={{
              danger: true,
              loading: Boolean(forceCancelLoadingId),
            }}
          >
            <div className="mt-2 space-y-3">
              <p className="text-sm text-gray-600">
                This action will force cancel the booking and a notification email will be sent to the user.
              </p>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Quick action
                </label>
                <Select
                  value={forceCancelReason || undefined}
                  onChange={(value) => setForceCancelReason(value || "")}
                  className="w-full"
                  placeholder="Choose a quick reason"
                  options={forceCancelReasonOptions}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">
                  Reason
                </label>
                <Input.TextArea
                  value={forceCancelReason}
                  placeholder="Reason for force cancel"
                  autoSize={{ minRows: 3, maxRows: 5 }}
                  maxLength={500}
                  onChange={(event) => setForceCancelReason(event.target.value)}
                />
              </div>
            </div>
          </Modal>

          {/* Filters Section */}
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
            <h2 className="text-sm font-semibold text-slate-700">
              Search & Filter
            </h2>

            {/* First Row - Start/End Time */}
            <div className="grid grid-cols-1 gap-3 border-b border-slate-200 pb-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Start Time
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[1.25fr_1fr_1fr] gap-2">
                  <div>
                    <DatePickerField
                      value={startDate}
                      onChange={(nextDate) => {
                        setStartDate(nextDate);
                        if (endDate && nextDate > endDate) {
                          setEndDate(nextDate);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Select
                      value={getClockHour(startClock) || undefined}
                      onChange={(nextHour) => {
                        const currentMinute = getClockMinute(startClock) || "00";
                        setStartClock(nextHour ? `${nextHour}:${currentMinute}` : "");
                      }}
                      placeholder="Hour"
                      listHeight={160}
                      className="w-full"
                      options={ALL_HOURS.map((hour) => ({ value: hour, label: hour }))}
                    />
                  </div>
                  <div>
                    <select
                      value={getClockMinute(startClock)}
                      onChange={(event) => {
                        const nextMinute = event.target.value;
                        const currentHour = getClockHour(startClock) || "00";
                        setStartClock(nextMinute ? `${currentHour}:${nextMinute}` : "");
                      }}
                      className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm tabular-nums text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">Min</option>
                      {MINUTE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  End Time
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-[1.25fr_1fr_1fr] gap-2">
                  <div>
                    <DatePickerField
                      value={endDate}
                      minDate={startDate}
                      onChange={setEndDate}
                    />
                  </div>
                  <div>
                    <Select
                      value={getClockHour(endClock) || undefined}
                      onChange={(nextHour) => {
                        const currentMinute = getClockMinute(endClock) || "00";
                        setEndClock(nextHour ? `${nextHour}:${currentMinute}` : "");
                      }}
                      placeholder="Hour"
                      listHeight={160}
                      className="w-full"
                      options={ALL_HOURS.map((hour) => ({ value: hour, label: hour }))}
                    />
                  </div>
                  <div>
                    <select
                      value={getClockMinute(endClock)}
                      onChange={(event) => {
                        const nextMinute = event.target.value;
                        const currentHour = getClockHour(endClock) || "00";
                        setEndClock(nextMinute ? `${currentHour}:${nextMinute}` : "");
                      }}
                      className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm tabular-nums text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">Min</option>
                      {MINUTE_OPTIONS.map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Second Row - Main Filters */}
            <div className="mb-4 grid grid-cols-1 gap-4 border-b border-slate-200 pb-4 md:grid-cols-12">
              <div className="md:col-span-2">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Building
                </label>
                <Select
                  value={selectedBuildingId || undefined}
                  onChange={(value) => {
                    const buildingId = String(value || "");
                    const matched = buildingOptions.find(
                      (option) => option.value === buildingId,
                    );
                    setSelectedBuildingId(buildingId);
                    setBuildingNameFilter(matched?.name || "");
                    setFloorNameFilter("");
                    setFloorOptions([]);
                  }}
                  allowClear
                  placeholder="Select building"
                  className="w-full"
                  options={buildingOptions}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Floor
                </label>
                <Select
                  value={floorNameFilter || undefined}
                  onChange={(value) => setFloorNameFilter(value || "")}
                  allowClear
                  disabled={!selectedBuildingId}
                  placeholder={
                    selectedBuildingId
                      ? "Select floor"
                      : "Select building first"
                  }
                  className="w-full"
                  options={floorOptions}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Room Name
                </label>
                <Input
                  value={roomNameFilter}
                  onChange={(event) => setRoomNameFilter(event.target.value)}
                  placeholder="Search room..."
                  className="rounded-lg"
                />
              </div>
              <div className="md:col-span-4">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  User Email
                </label>
                <Input
                  value={userEmailFilter}
                  onChange={(event) => setUserEmailFilter(event.target.value)}
                  placeholder="Search email..."
                  className="rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-full"
                  options={[
                    { label: "All", value: "All" },
                    { label: "Reserved", value: "RESERVED" },
                    { label: "In Use", value: "IN_USE" },
                    { label: "Completed", value: "COMPLETED" },
                    { label: "Cancelled", value: "CANCELLED" },
                    { label: "Force Cancelled", value: "FORCE_CANCELLED" },
                    { label: "No Show", value: "NO_SHOW" },
                    { label: "Failed", value: "FAILED" },
                  ]}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button 
                onClick={handleResetFilters}
                className="rounded-xl border border-gray-200 px-6 py-2 text-gray-700 hover:bg-gray-100"
              >
                Clear
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="rounded-xl bg-slate-900 px-6 py-2 font-medium text-white hover:bg-slate-800"
              >
                Search
              </Button>
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
                  record.reservationId ||
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
