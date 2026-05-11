import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_ENDPOINTS } from "../constants/endpoints";
import { ROUTES } from "../constants";
import { api } from "../services/api";
import { adminService } from "../services/adminService";
import { logout } from "../services/authService";
import { reservationService } from "../services/reservationService";
import { roomService } from "../services/roomService";
import { extractApiMessage } from "../utils/errorHandlers";
import { MessageType } from "../components/common/CustomMessage";
import { LocationState, TimelineItem, UnknownRecord } from "../types/adminBookingDetail";
import { notFoundText } from "../constants/adminBookingDetail";
import {
  canForceCancel,
  collectImageUrls,
  getDateTimeText,
  isUuid,
  pickFirstText,
  toDisplayText,
  toNonEmptyString,
} from "../utils/adminBookingDetailUtils";

export const useAdminBookingDetail = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { state } = useLocation();

  const bookingFromState =
    ((state as LocationState | null)?.booking as UnknownRecord | undefined) ||
    undefined;

  const normalizedBookingId = useMemo(
    () =>
      pickFirstText(
        bookingId,
        bookingFromState?.id,
        bookingFromState?.reservationId,
        bookingFromState?.reservationID,
        bookingFromState?.bookingId,
      ),
    [bookingFromState, bookingId],
  );

  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<UnknownRecord | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [roomImageUrls, setRoomImageUrls] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const fetchedDetailIdRef = useRef<string>("");
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [forceCancelModalOpen, setForceCancelModalOpen] = useState(false);
  const [forceCancelReason, setForceCancelReason] = useState("");
  const [forceCancelLoading, setForceCancelLoading] = useState(false);

  const loadAdminProfile = async () => {
    try {
      const response = await api.get<
        | {
            data?: {
              firstName?: string;
              lastName?: string;
              email?: string;
            };
            firstName?: string;
            lastName?: string;
            email?: string;
          }
        | {
            firstName?: string;
            lastName?: string;
            email?: string;
          }
      >(API_ENDPOINTS.AUTH.PROFILE);

      const payload = response.data as {
        data?: {
          firstName?: string;
          lastName?: string;
          email?: string;
        };
        firstName?: string;
        lastName?: string;
        email?: string;
      };

      const firstName = payload.data?.firstName || payload.firstName || "";
      const lastName = payload.data?.lastName || payload.lastName || "";
      const email = payload.data?.email || payload.email || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(email || "");
    } catch {
      setAdminName("Admin User");
      setAdminEmail("");
    }
  };

  useEffect(() => {
    void loadAdminProfile();
  }, []);

  useEffect(() => {
    if (!normalizedBookingId) {
      setError("Missing booking id");
      setLoading(false);
      return;
    }

    if (fetchedDetailIdRef.current === normalizedBookingId) return;
    fetchedDetailIdRef.current = normalizedBookingId;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await reservationService.getBookingDetail(normalizedBookingId);
        setDetail(response);
      } catch (err) {
        if (
          bookingFromState?.rawData &&
          typeof bookingFromState.rawData === "object"
        ) {
          setDetail(bookingFromState.rawData as UnknownRecord);
          setError(null);
        } else {
          setError(extractApiMessage(err, "Unable to load booking details"));
        }
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [bookingFromState, normalizedBookingId]);

  const mergedDetail = useMemo(() => {
    const reservationNode =
      detail?.reservation && typeof detail.reservation === "object"
        ? (detail.reservation as UnknownRecord)
        : null;

    const roomNode =
      reservationNode?.room && typeof reservationNode.room === "object"
        ? (reservationNode.room as UnknownRecord)
        : null;

    const floorNode =
      reservationNode?.floor && typeof reservationNode.floor === "object"
        ? (reservationNode.floor as UnknownRecord)
        : null;

    const buildingNode =
      reservationNode?.building && typeof reservationNode.building === "object"
        ? (reservationNode.building as UnknownRecord)
        : null;

    const userNode =
      reservationNode?.user && typeof reservationNode.user === "object"
        ? (reservationNode.user as UnknownRecord)
        : null;

    const fallbackRaw =
      bookingFromState?.rawData && typeof bookingFromState.rawData === "object"
        ? (bookingFromState.rawData as UnknownRecord)
        : null;

    return {
      ...(fallbackRaw || {}),
      ...(bookingFromState || {}),
      ...(detail || {}),
      ...(reservationNode || {}),
      reservationId: pickFirstText(
        normalizedBookingId,
        detail?.reservationId,
        detail?.id,
        bookingFromState?.reservationId,
        bookingFromState?.id,
      ),
      roomId: pickFirstText(
        roomNode?.roomId,
        reservationNode?.roomId,
        detail?.roomId,
        bookingFromState?.roomId,
      ),
      locationCode: pickFirstText(
        roomNode?.locationCode,
        reservationNode?.locationCode,
        detail?.locationCode,
        bookingFromState?.locationCode,
        detail?.roomName,
        bookingFromState?.roomName,
      ),
      roomName: pickFirstText(
        roomNode?.roomName,
        roomNode?.name,
        detail?.roomName,
      ),
      floorName: pickFirstText(
        floorNode?.name,
        reservationNode?.floorName,
        detail?.floorName,
        detail?.floor,
        bookingFromState?.floorName,
      ),
      buildingName: pickFirstText(
        buildingNode?.name,
        detail?.buildingName,
        bookingFromState?.buildingName,
        detail?.address,
        bookingFromState?.address,
      ),
      requesterName: pickFirstText(
        reservationNode?.userName,
        userNode?.fullName,
        userNode?.name,
        detail?.userName,
        bookingFromState?.userName,
        bookingFromState?.user,
      ),
      requesterEmail: pickFirstText(
        userNode?.email,
        detail?.userEmail,
        bookingFromState?.userEmail,
      ),
      startTime: pickFirstText(
        reservationNode?.startTime,
        detail?.startTime,
        bookingFromState?.startTime,
      ),
      endTime: pickFirstText(
        reservationNode?.endTime,
        detail?.endTime,
        bookingFromState?.endTime,
        bookingFromState?.date,
      ),
      status: pickFirstText(
        reservationNode?.status,
        detail?.status,
        bookingFromState?.status,
      ),
      purpose: pickFirstText(
        reservationNode?.purpose,
        detail?.purpose,
        bookingFromState?.purpose,
      ),
      note: pickFirstText(
        reservationNode?.note,
        detail?.note,
        bookingFromState?.note,
      ),
      cancelReason: pickFirstText(
        detail?.cancelReason,
        detail?.reason,
        reservationNode?.cancelReason,
      ),
      roomImages:
        (Array.isArray(detail?.roomImages) ? detail.roomImages : undefined) ||
        (Array.isArray(reservationNode?.roomImages)
          ? reservationNode.roomImages
          : undefined),
      history: Array.isArray(detail?.history)
        ? detail.history
        : Array.isArray(reservationNode?.history)
          ? reservationNode.history
          : [],
      feedback:
        detail?.feedback && typeof detail.feedback === "object"
          ? detail.feedback
          : reservationNode?.feedback,
    } as UnknownRecord;
  }, [bookingFromState, detail, normalizedBookingId]);

  const roomIdForImages = useMemo(() => {
    const candidates = [
      mergedDetail.roomId,
      mergedDetail.seatId,
      detail?.roomId,
      detail?.seatId,
      bookingFromState?.roomId,
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === "string" &&
        candidate.trim() &&
        isUuid(candidate.trim())
      ) {
        return candidate.trim();
      }
    }

    return "";
  }, [
    bookingFromState?.roomId,
    detail?.roomId,
    detail?.seatId,
    mergedDetail.roomId,
    mergedDetail.seatId,
  ]);

  const locationCodeForLookup = useMemo(
    () =>
      toDisplayText(
        mergedDetail.locationCode ||
          mergedDetail.roomName ||
          mergedDetail.roomCode,
      ),
    [mergedDetail.locationCode, mergedDetail.roomCode, mergedDetail.roomName],
  );

  useEffect(() => {
    const resolveRoomIdFromMap = async (
      locationCode: string,
    ): Promise<string> => {
      if (!locationCode || locationCode === notFoundText) return "";

      const roomsMap = (await roomService.getRoomsMap()) as {
        buildingResponse?: Array<{
          floors?: Array<{
            rooms?: UnknownRecord[];
          }>;
        }>;
      };

      const buildings = Array.isArray(roomsMap?.buildingResponse)
        ? roomsMap.buildingResponse
        : [];

      for (const building of buildings) {
        const floors = Array.isArray(building?.floors) ? building.floors : [];
        for (const floor of floors) {
          const rooms = Array.isArray(floor?.rooms) ? floor.rooms : [];
          for (const room of rooms) {
            const roomLocationCode = pickFirstText(
              room.locationCode,
              room.roomName,
              room.name,
            );
            if (
              roomLocationCode &&
              roomLocationCode.trim().toLowerCase() ===
                locationCode.trim().toLowerCase()
            ) {
              const idCandidates = [room.roomId, room.seatId, room.id];
              const validId = idCandidates
                .map((candidate) =>
                  candidate != null ? String(candidate) : "",
                )
                .find((candidate) => candidate && isUuid(candidate));

              if (validId) {
                return validId;
              }
            }
          }
        }
      }

      return "";
    };

    const loadRoomImages = async () => {
      let resolvedRoomId = roomIdForImages;

      if (!resolvedRoomId) {
        try {
          resolvedRoomId = await resolveRoomIdFromMap(locationCodeForLookup);
        } catch {
          resolvedRoomId = "";
        }
      }

      if (!resolvedRoomId) {
        setRoomImageUrls([]);
        return;
      }

      setLoadingImages(true);
      try {
        const urls =
          await reservationService.getRoomImagesByRoomId(resolvedRoomId);
        setRoomImageUrls(urls);
      } catch {
        setRoomImageUrls([]);
      } finally {
        setLoadingImages(false);
      }
    };

    void loadRoomImages();
  }, [locationCodeForLookup, roomIdForImages]);

  const imageUrls = useMemo(() => {
    if (roomImageUrls.length > 0) {
      return roomImageUrls;
    }

    const roomImagesFromDetail = Array.isArray(mergedDetail.roomImages)
      ? mergedDetail.roomImages
      : [];

    const mappedUrls = roomImagesFromDetail
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const imageObject = item as UnknownRecord;
        const candidates = [
          imageObject.imageUrl,
          imageObject.url,
          imageObject.fileUrl,
          imageObject.publicUrl,
        ];

        const found = candidates.find(
          (candidate) => typeof candidate === "string" && candidate.trim(),
        );

        return typeof found === "string" ? found.trim() : "";
      })
      .filter(Boolean);

    if (mappedUrls.length > 0) {
      return mappedUrls;
    }

    return collectImageUrls(mergedDetail);
  }, [mergedDetail, roomImageUrls]);

  const cancelActorLabel = useMemo(
    () =>
      pickFirstText(
        mergedDetail.cancelledBy,
        mergedDetail.canceledBy,
        mergedDetail.cancelBy,
        mergedDetail.forceCancelledBy,
        mergedDetail.forceCanceledBy,
        mergedDetail.forceCancelBy,
      ),
    [
      mergedDetail.cancelBy,
      mergedDetail.canceledBy,
      mergedDetail.cancelledBy,
      mergedDetail.forceCancelBy,
      mergedDetail.forceCanceledBy,
      mergedDetail.forceCancelledBy,
    ],
  );

  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    const pushItem = (
      key: string,
      label: string,
      timeValue: unknown,
      sourceOrder: number,
      actor?: string,
    ) => {
      const time = toNonEmptyString(timeValue);
      if (!time) return;
      items.push({ key, label, time, sourceOrder, actor });
    };

    pushItem(
      "created",
      "Created",
      mergedDetail.createAt || mergedDetail.createdAt,
      1,
    );
    pushItem(
      "checkin",
      "Check-in",
      mergedDetail.checkinTime || mergedDetail.checkInTime,
      2,
    );

    const historyList = Array.isArray(mergedDetail.history)
      ? mergedDetail.history
      : [];
    let extendIndex = 0;

    historyList.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;

      const row = entry as UnknownRecord;
      const action = toNonEmptyString(row.action).toUpperCase();
      if (action === "EXTEND") {
        extendIndex += 1;
        pushItem(
          `extend-${extendIndex}`,
          `Extend ${extendIndex}`,
          row.performAt,
          3,
          toNonEmptyString(row.performBy),
        );
      }

      if (action === "CHECK_IN") {
        pushItem(
          "history-checkin",
          "Check-in",
          row.performAt,
          2,
          toNonEmptyString(row.performBy),
        );
      }
    });

    pushItem("return", "Return room", mergedDetail.returnTime, 4);
    pushItem(
      "cancelled",
      "Cancelled",
      mergedDetail.cancelTime ||
        mergedDetail.cancelledTime ||
        mergedDetail.canceledAt,
      5,
      cancelActorLabel,
    );

    const seen = new Set<string>();
    return items
      .filter((item) => {
        const token = `${item.label}-${item.time}`;
        if (seen.has(token)) return false;
        seen.add(token);
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.time).getTime();
        const timeB = new Date(b.time).getTime();
        if (Number.isNaN(timeA) && Number.isNaN(timeB))
          return a.sourceOrder - b.sourceOrder;
        if (Number.isNaN(timeA)) return 1;
        if (Number.isNaN(timeB)) return -1;
        return timeA - timeB;
      });
  }, [cancelActorLabel, mergedDetail]);

  const firstImageUrl = imageUrls[0] || "";
  const roomLabel = toDisplayText(
    mergedDetail.locationCode || mergedDetail.roomName || mergedDetail.roomCode,
  );
  const requesterNameLabel = toDisplayText(mergedDetail.requesterName);
  const requesterEmailLabel = toDisplayText(mergedDetail.requesterEmail);
  const buildingLabel = toDisplayText(
    mergedDetail.buildingName || mergedDetail.address,
  );
  const floorLabel = toDisplayText(
    mergedDetail.floorName || mergedDetail.floor,
  );
  const startLabel = getDateTimeText(mergedDetail.startTime);
  const endLabel = getDateTimeText(mergedDetail.endTime);
  const purposeLabel = toDisplayText(mergedDetail.purpose);
  const noteLabel = toDisplayText(mergedDetail.note);
  const normalizedStatus = String(mergedDetail.status || "")
    .trim()
    .toUpperCase()
    .replace(/[-\s]+/g, "_");
  const isForceCancelled = normalizedStatus === "FORCE_CANCELLED";
  const statusLabel = isForceCancelled
    ? "Force Cancelled (Admin)"
    : toDisplayText(mergedDetail.status);
  const cancelReasonLabel = toDisplayText(
    mergedDetail.cancelReason || mergedDetail.reason,
  );
  const isAdminActor =
    !!cancelActorLabel &&
    !!adminEmail &&
    cancelActorLabel.toLowerCase() === adminEmail.toLowerCase();
  const cancelActorText = isAdminActor
    ? "Admin"
    : cancelActorLabel || (isForceCancelled ? "Admin" : "");
  const feedbackNode =
    mergedDetail.feedback && typeof mergedDetail.feedback === "object"
      ? (mergedDetail.feedback as UnknownRecord)
      : null;
  const feedbackLabel = toDisplayText(feedbackNode?.description);

  const showToast = (type: MessageType, message: string) => {
    setToastPopup({ type, message });
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const handleForceCancel = () => {
    if (!normalizedBookingId) {
      showToast("error", "Reservation id is required");
      return;
    }

    if (!canForceCancel(mergedDetail.status as string)) {
      showToast(
        "warning",
        `Cannot force cancel booking with status: ${String(mergedDetail.status || "UNKNOWN")}`,
      );
      return;
    }

    setForceCancelReason("");
    setForceCancelModalOpen(true);
  };

  const submitForceCancel = async () => {
    const reservationId = normalizedBookingId.trim();
    if (!reservationId) {
      showToast("error", "Reservation id is required");
      return;
    }

    const reason = forceCancelReason.trim() || "Force cancel by admin";

    try {
      setForceCancelLoading(true);
      const message = await adminService.forceCancelBooking(reservationId, {
        reason,
      });
      showToast(
        "success",
        message ||
          "Force cancel success. User will receive an email notification.",
      );
      setForceCancelModalOpen(false);
      const response = await reservationService.getBookingDetail(reservationId);
      setDetail(response);
    } catch (err) {
      showToast("error", extractApiMessage(err, "Force cancel failed"));
    } finally {
      setForceCancelLoading(false);
    }
  };

  return {
    navigate,
    mobileOpen,
    setMobileOpen,
    adminName,
    adminEmail,
    loading,
    error,
    failedImages,
    setFailedImages,
    loadingImages,
    toastPopup,
    setToastPopup,
    forceCancelModalOpen,
    setForceCancelModalOpen,
    forceCancelReason,
    setForceCancelReason,
    forceCancelLoading,
    timelineItems,
    firstImageUrl,
    roomLabel,
    requesterNameLabel,
    requesterEmailLabel,
    buildingLabel,
    floorLabel,
    startLabel,
    endLabel,
    purposeLabel,
    noteLabel,
    statusLabel,
    cancelReasonLabel,
    cancelActorText,
    feedbackLabel,
    mergedDetail,
    handleLogout,
    handleForceCancel,
    submitForceCancel
  };
};
