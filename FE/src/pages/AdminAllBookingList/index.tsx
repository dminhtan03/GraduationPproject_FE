import React, { useCallback, useEffect, useState } from "react";
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

  const generatePaginationItems = (
    currentPage: number,
    totalPages: number,
  ): Array<{ number?: number; type: "page" | "jumper" }> => {
    // If total pages <= 5, show all
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => ({
        number: i + 1,
        type: "page" as const,
      }));
    }

    const items: Array<{ number?: number; type: "page" | "jumper" }> = [];

    // Calculate range: currentPage ± 2
    const rangeStart = Math.max(1, currentPage - 2);
    const rangeEnd = Math.min(totalPages, currentPage + 2);

    // Add first page if not in range
    if (rangeStart > 1) {
      items.push({ number: 1, type: "page" });
      // Add jumper if there's a gap after page 1
      if (rangeStart > 2) {
        items.push({ type: "jumper" });
      }
    }

    // Add pages in range
    for (let i = rangeStart; i <= rangeEnd; i++) {
      items.push({ number: i, type: "page" });
    }

    // Add last page if not in range
    if (rangeEnd < totalPages) {
      // Add jumper if there's a gap before last page
      if (rangeEnd < totalPages - 1) {
        items.push({ type: "jumper" });
      }
      items.push({ number: totalPages, type: "page" });
    }

    return items;
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
        {/* Main Content */}
        <main className="flex-1 overflow-auto px-4 pb-8 pt-5 lg:px-8">
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

          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">All Bookings List</h1>
              <p className="text-sm text-slate-500">Manage all booking reservations and requests</p>
            </div>
          </div>

          {toastPopup && (
            <CustomMessage
              type={toastPopup.type}
              message={toastPopup.message}
              onClose={() => setToastPopup(null)}
            />
          )}

          {/* Search & Filter Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6 flex flex-col gap-4">
            {/* First Row - Start/End Time */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
              <div>
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Start time
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <div className="min-w-0">
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
                  <select
                    value={getClockMinute(startClock)}
                    onChange={(event) => {
                      const nextMinute = event.target.value;
                      const currentHour = getClockHour(startClock) || "00";
                      setStartClock(nextMinute ? `${currentHour}:${nextMinute}` : "");
                    }}
                    className="w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm tabular-nums bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
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

              <div>
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  End time
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <div className="min-w-0">
                    <DatePickerField
                      value={endDate}
                      minDate={startDate}
                      onChange={setEndDate}
                    />
                  </div>
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
                  <select
                    value={getClockMinute(endClock)}
                    onChange={(event) => {
                      const nextMinute = event.target.value;
                      const currentHour = getClockHour(endClock) || "00";
                      setEndClock(nextMinute ? `${currentHour}:${nextMinute}` : "");
                    }}
                    className="w-full min-w-0 border border-gray-200 rounded-lg px-2 py-2 text-sm tabular-nums bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
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

              <div>
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Status
                </div>
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
                    { label: "No Show", value: "NO_SHOW" },
                    { label: "Failed", value: "FAILED" },
                  ]}
                />
              </div>
            </div>

            {/* Second Row - Main Filters */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-2">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Building
                </div>
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
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Floor
                </div>
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

              <div className="md:col-span-3">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Room Name
                </div>
                <Input
                  value={roomNameFilter}
                  onChange={(event) => setRoomNameFilter(event.target.value)}
                  placeholder="Search room..."
                  className="rounded-lg"
                />
              </div>

              <div className="md:col-span-3">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  User Email
                </div>
                <Input
                  value={userEmailFilter}
                  onChange={(event) => setUserEmailFilter(event.target.value)}
                  placeholder="Search email..."
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button 
                onClick={handleResetFilters}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50 transition-all"
              >
                Clear
              </button>
              <button
                onClick={handleApplyFilters}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-all"
              >
                Search
              </button>
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
            {bookings.length === 0 && !loading && !error ? (
              <Empty
                style={{ padding: "60px 20px" }}
                description="No bookings match your filters"
              />
            ) : (
              <>
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
                  pagination={false}
                  onChange={handleTableChange}
                  className="border-none"
                />

                {/* Custom Pagination */}
                <div className="border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
                  <div className="text-sm text-slate-700 font-medium">
                    {total > 0
                      ? `Results: ${(page - 1) * pageSize + 1} - ${Math.min(
                          page * pageSize,
                          total,
                        )} of ${total}`
                      : "0 of 0"}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white transition-all"
                    >
                      &lt;
                    </button>

                    {generatePaginationItems(page, Math.ceil(total / pageSize)).map(
                      (item, index) =>
                        item.type === "page" ? (
                          <button
                            key={`page-${item.number}`}
                            onClick={() => setPage(item.number || 1)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                              page === item.number
                                ? "bg-slate-900 text-white shadow-md"
                                : "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50"
                            }`}
                          >
                            {item.number}
                          </button>
                        ) : (
                          <span
                            key={`jumper-${index}`}
                            className="px-2 text-slate-400 font-semibold"
                          >
                            ...
                          </span>
                        ),
                    )}

                    <button
                      onClick={() =>
                        setPage(Math.min(Math.ceil(total / pageSize), page + 1))
                      }
                      disabled={page >= Math.ceil(total / pageSize)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:text-slate-300 disabled:hover:bg-white transition-all"
                    >
                      &gt;
                    </button>
                  </div>

                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminAllBookingListPage;
