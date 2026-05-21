import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminService } from "../services/adminService";
import { ROUTES } from "../constants";
import { api } from "../services/api";
import { API_ENDPOINTS } from "../constants/endpoints";
import { logout } from "../services/authService";
import type { MessageType } from "../components/common/CustomMessage";
import { EventRow } from "../types/adminEventBookingList";
import {
  DEFAULT_END_CLOCK,
  DEFAULT_START_CLOCK,
  PAGE_SIZE,
} from "../constants/adminEventBookingList";
import {
  combineDateTime,
  getEventTimestamp,
  normalizeText,
  parseDateTime,
} from "../utils/adminEventBookingListUtils";

export const useAdminEventBookingList = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = PAGE_SIZE;
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [forceCancelLoadingId, setForceCancelLoadingId] = useState<
    string | null
  >(null);
  const [forceCancelModalOpen, setForceCancelModalOpen] = useState(false);
  const [forceCancelReservationId, setForceCancelReservationId] = useState("");
  const [forceCancelReason, setForceCancelReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startClock, setStartClock] = useState(DEFAULT_START_CLOCK);
  const [endClock, setEndClock] = useState(DEFAULT_END_CLOCK);
  const [titleFilter, setTitleFilter] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("All");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [appliedTitle, setAppliedTitle] = useState("");
  const [appliedRoom, setAppliedRoom] = useState("");
  const [appliedEmail, setAppliedEmail] = useState("");

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

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await adminService.getAdminEvents(0, 1000);
      const content = Array.isArray(res?.data) ? res.data : [];
      setEvents(content);
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminProfile();
    loadEvents();
  }, []);

  const showToast = (type: MessageType, message: string) => {
    setToastPopup({ type, message });
    window.setTimeout(() => {
      setToastPopup((current) =>
        current && current.message === message ? null : current,
      );
    }, 3000);
  };

  const handleApplyFilters = () => {
    let normalizedStart = "";
    let normalizedEnd = "";

    if (startDate && endDate) {
      const startDateTime = combineDateTime(startDate, startClock);
      const endDateTime = combineDateTime(endDate, endClock);
      normalizedStart = startDateTime || "";
      normalizedEnd = endDateTime || "";

      const parsedStart = parseDateTime(normalizedStart);
      const parsedEnd = parseDateTime(normalizedEnd);
      if (parsedStart && parsedEnd && parsedEnd <= parsedStart) {
        showToast("warning", "End time must be later than Start time");
        return;
      }
    } else if ((startDate && !endDate) || (!startDate && endDate)) {
      showToast(
        "warning",
        "Please select both start and end dates, or leave both empty to show all",
      );
      return;
    }

    setAppliedStatus(statusFilter);
    setAppliedStartDate(normalizedStart);
    setAppliedEndDate(normalizedEnd);
    setAppliedTitle(titleFilter.trim());
    setAppliedRoom(roomFilter.trim());
    setAppliedEmail(emailFilter.trim());
    setPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter("All");
    setStartDate("");
    setEndDate("");
    setStartClock(DEFAULT_START_CLOCK);
    setEndClock(DEFAULT_END_CLOCK);
    setTitleFilter("");
    setRoomFilter("");
    setEmailFilter("");
    setAppliedStatus("All");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setAppliedTitle("");
    setAppliedRoom("");
    setAppliedEmail("");
    setPage(1);
  };

  const handleForceCancel = (record: EventRow) => {
    setForceCancelReservationId(record.reservationId);
    setForceCancelReason("");
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
        message ||
          "Force cancel success. User will receive an email notification.",
      );
      setForceCancelModalOpen(false);
      await loadEvents();
    } catch {
      showToast("error", "Force cancel failed");
    } finally {
      setForceCancelLoadingId(null);
    }
  };

  const filteredEvents = useMemo(() => {
    const statusToken = normalizeText(appliedStatus);
    const titleToken = normalizeText(appliedTitle);
    const roomToken = normalizeText(appliedRoom);
    const emailToken = normalizeText(appliedEmail);

    const startBoundary = appliedStartDate
      ? parseDateTime(appliedStartDate)
      : null;
    const endBoundary = appliedEndDate ? parseDateTime(appliedEndDate) : null;

    return events.filter((record) => {
      const normalizedStatus = normalizeText(record.status || "");
      if (statusToken !== "all" && normalizedStatus !== statusToken) {
        return false;
      }

      if (titleToken) {
        const titleValue = normalizeText(record.title || "");
        if (!titleValue.includes(titleToken)) return false;
      }

      if (roomToken) {
        const roomValue = normalizeText(
          `${record.roomCode || ""} ${record.roomName || ""}`,
        );
        if (!roomValue.includes(roomToken)) return false;
      }

      if (emailToken) {
        const emailValue = normalizeText(record.userEmail || "");
        if (!emailValue.includes(emailToken)) return false;
      }

      if (startBoundary || endBoundary) {
        const eventTime =
          parseDateTime(record.startTime) || parseDateTime(record.endTime);
        if (!eventTime) return false;
        if (startBoundary && eventTime < startBoundary) return false;
        if (endBoundary && eventTime > endBoundary) return false;
      }

      return true;
    });
  }, [
    appliedEmail,
    appliedEndDate,
    appliedRoom,
    appliedStartDate,
    appliedStatus,
    appliedTitle,
    events,
  ]);

  const sortedEvents = useMemo(
    () =>
      [...filteredEvents].sort(
        (left, right) => getEventTimestamp(right) - getEventTimestamp(left),
      ),
    [filteredEvents],
  );

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const pagedEvents = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedEvents.slice(startIndex, startIndex + pageSize);
  }, [page, pageSize, sortedEvents]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return {
    navigate,
    mobileOpen,
    setMobileOpen,
    loading,
    page,
    setPage,
    adminName,
    adminEmail,
    toastPopup,
    setToastPopup,
    forceCancelLoadingId,
    forceCancelModalOpen,
    setForceCancelModalOpen,
    forceCancelReason,
    setForceCancelReason,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    startClock,
    setStartClock,
    endClock,
    setEndClock,
    titleFilter,
    setTitleFilter,
    roomFilter,
    setRoomFilter,
    emailFilter,
    setEmailFilter,
    handleApplyFilters,
    handleResetFilters,
    handleForceCancel,
    submitForceCancel,
    sortedEvents,
    totalPages,
    pagedEvents,
    showToast,
    handleLogout,
  };
};
