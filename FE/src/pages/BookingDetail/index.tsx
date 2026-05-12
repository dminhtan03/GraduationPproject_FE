import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Tag, Typography } from "antd";
import MeetingRecorder from "../../components/meeting/MeetingRecorder";
import { reservationService } from "../../services/reservationService";
import { roomService } from "../../services/roomService";
import { getProfile } from "../../services/authService";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { api } from "../../services/api";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { Reservation } from "../../types";

const { Title, Text } = Typography;

interface LocationState {
  booking?: Reservation;
}

const imagePattern = /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i;
const notFoundText = "Not found";

const toDisplayText = (value: unknown): string => {
  if (value == null) return notFoundText;
  if (typeof value === "string") {
    return value.trim() ? value : notFoundText;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return notFoundText;
};

const getDateTimeText = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    return notFoundText;
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const collectImageUrls = (source: unknown): string[] => {
  const urls = new Set<string>();

  const visit = (node: unknown) => {
    if (typeof node === "string") {
      const trimmed = node.trim();
      const isUrl = /^https?:\/\//i.test(trimmed);
      if (isUrl && imagePattern.test(trimmed)) {
        urls.add(trimmed);
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== "object") return;

    Object.entries(node as Record<string, unknown>).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      if (typeof value === "string") {
        const trimmed = value.trim();
        const isUrl = /^https?:\/\//i.test(trimmed);
        if (isUrl && (lower.includes("image") || lower.includes("photo") || imagePattern.test(trimmed))) {
          urls.add(trimmed);
        }
      }
      visit(value);
    });
  };

  visit(source);
  return [...urls];
};

const statusColor = (status?: string) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "RESERVED") return "green";
  if (normalized === "IN_USE" || normalized === "CHECKED_IN") return "blue";
  if (normalized === "COMPLETED") return "cyan";
  if (normalized === "CANCELLED") return "red";
  if (normalized === "NO_SHOW") return "volcano";
  return "default";
};

const toNonEmptyString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed || "";
};

interface TimelineItem {
  key: string;
  label: string;
  time: string;
  actorId?: string;
  sourceOrder: number;
}

const BookingDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { state } = useLocation();

  const bookingFromState = (state as LocationState | null)?.booking;
  const normalizedBookingId = bookingId || bookingFromState?.id || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [eventData, setEventData] = useState<Record<string, unknown> | null>(null);
  const [profileId, setProfileId] = useState<string>("");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [roomImageUrls, setRoomImageUrls] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const fetchedDetailIdRef = useRef<string>("");

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await getProfile();
        const payload = (response.data as { data?: unknown })?.data ?? response.data;
        const source = payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;

        const resolvedId =
          toNonEmptyString(source?.id) ||
          toNonEmptyString(source?.userId) ||
          toNonEmptyString(source?.uid);

        setProfileId(resolvedId);
      } catch {
        setProfileId("");
      }
    };

    void loadProfile();
  }, []);

  useEffect(() => {
    if (!normalizedBookingId) return;
    if (fetchedDetailIdRef.current === normalizedBookingId) return;
    fetchedDetailIdRef.current = normalizedBookingId;

    const loadDetail = async () => {
      if (!normalizedBookingId) {
        setError("Missing booking id");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await reservationService.getBookingDetail(normalizedBookingId);
        setDetail(data);
      } catch (err) {
        if (bookingFromState?.rawData || bookingFromState?.id) {
          // Keep UI usable with state data when backend has no detail endpoint.
          setDetail((bookingFromState?.rawData as Record<string, unknown>) || null);
          setError(null);
        } else {
          setError(extractApiMessage(err, "Unable to load booking details"));
        }
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [bookingFromState?.id, bookingFromState?.rawData, normalizedBookingId]);

  useEffect(() => {
    if (!normalizedBookingId) return;

    const loadEventForReservation = async () => {
      try {
        const response = await api.get<Record<string, unknown>>(
          buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, { reservationId: normalizedBookingId }),
        );
        const payload = response?.data?.data ?? response?.data ?? null;
        if (payload && typeof payload === "object") {
          setEventData(payload as Record<string, unknown>);
        } else {
          setEventData(null);
        }
      } catch {
        setEventData(null);
      }
    };

    void loadEventForReservation();
  }, [normalizedBookingId]);

  const mergedDetail = useMemo(() => {
    const reservationNode =
      detail?.reservation && typeof detail.reservation === "object"
        ? (detail.reservation as Record<string, unknown>)
        : null;
    const roomNode =
      reservationNode?.room && typeof reservationNode.room === "object"
        ? (reservationNode.room as Record<string, unknown>)
        : null;
    const floorNode =
      reservationNode?.floor && typeof reservationNode.floor === "object"
        ? (reservationNode.floor as Record<string, unknown>)
        : null;
    const buildingNode =
      reservationNode?.building && typeof reservationNode.building === "object"
        ? (reservationNode.building as Record<string, unknown>)
        : null;

    return {
      ...(bookingFromState?.rawData || {}),
      ...(detail || {}),
      ...(reservationNode || {}),
      reservationId: normalizedBookingId,
      roomId:
        (roomNode?.roomId as string | undefined) ||
        (reservationNode?.roomId as string | undefined) ||
        (detail?.roomId as string | undefined) ||
        bookingFromState?.roomId,
      locationCode:
        (roomNode?.locationCode as string | undefined) ||
        (reservationNode?.locationCode as string | undefined) ||
        (detail?.locationCode as string | undefined) ||
        bookingFromState?.locationCode,
      floor:
        (floorNode?.name as string | undefined) ||
        (reservationNode?.floorName as string | undefined) ||
        (detail?.floorName as string | undefined) ||
        (detail?.floor as string | undefined) ||
        bookingFromState?.floor,
      buildingName:
        (buildingNode?.name as string | undefined) ||
        (detail?.buildingName as string | undefined) ||
        bookingFromState?.buildingName ||
        bookingFromState?.address ||
        notFoundText,
      startTime:
        (reservationNode?.startTime as string | undefined) ||
        (detail?.startTime as string | undefined) ||
        bookingFromState?.startTime,
      endTime:
        (reservationNode?.endTime as string | undefined) ||
        (detail?.endTime as string | undefined) ||
        bookingFromState?.endTime,
      status:
        (reservationNode?.status as string | undefined) ||
        (detail?.status as string | undefined) ||
        bookingFromState?.status,
      purpose:
        (reservationNode?.purpose as string | undefined) ||
        (detail?.purpose as string | undefined) ||
        bookingFromState?.purpose,
      note:
        (reservationNode?.note as string | undefined) ||
        (detail?.note as string | undefined) ||
        bookingFromState?.note,
      roomImages:
        (Array.isArray(detail?.roomImages) ? detail.roomImages : undefined) ||
        (Array.isArray(reservationNode?.roomImages) ? reservationNode.roomImages : undefined),
    } as Record<string, unknown>;
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
      if (typeof candidate === "string" && candidate.trim() && isUuid(candidate.trim())) {
        return candidate.trim();
      }
    }

    return "";
  }, [bookingFromState?.roomId, detail, mergedDetail.roomId, mergedDetail.seatId]);

  const locationCodeForLookup = useMemo(
    () =>
      toDisplayText(
        mergedDetail.locationCode || mergedDetail.roomName || mergedDetail.roomCode,
      ),
    [mergedDetail.locationCode, mergedDetail.roomCode, mergedDetail.roomName],
  );

  useEffect(() => {
    const resolveRoomIdFromMap = async (locationCode: string): Promise<string> => {
      if (!locationCode || locationCode === notFoundText) return "";

      const roomsMap = await roomService.getRoomsMap();
      const buildings = Array.isArray(roomsMap?.buildingResponse)
        ? roomsMap.buildingResponse
        : [];

      for (const building of buildings) {
        const floors = Array.isArray(building?.floors) ? building.floors : [];
        for (const floor of floors) {
          const rooms = Array.isArray(floor?.rooms) ? floor.rooms : [];
          const foundRoom = rooms.find(
            (room: any) =>
              String(room?.locationCode || "").trim().toLowerCase() ===
              locationCode.trim().toLowerCase(),
          );

          const idCandidates = [foundRoom?.roomId, foundRoom?.seatId, foundRoom?.id];
          const validId = idCandidates.find(
            (candidate) => typeof candidate === "string" && isUuid(candidate),
          );

          if (validId) {
            return String(validId);
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
        const urls = await reservationService.getRoomImagesByRoomId(resolvedRoomId);
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
        const imageObject = item as Record<string, unknown>;
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

  const roomLabel = toDisplayText(
    mergedDetail.locationCode || mergedDetail.roomName || mergedDetail.roomCode,
  );
  const buildingLabel = toDisplayText(mergedDetail.buildingName || mergedDetail.address);
  const floorLabel = toDisplayText(mergedDetail.floor || mergedDetail.floorName);
  const purposeLabel = toDisplayText(mergedDetail.purpose);
  const startLabel = getDateTimeText(mergedDetail.startTime);
  const endLabel = getDateTimeText(mergedDetail.endTime);
  const noteLabel = toDisplayText(mergedDetail.note);
  const cancelReasonLabel = toDisplayText(mergedDetail.cancelReason || mergedDetail.reason);
  const statusLabel = toDisplayText(mergedDetail.status);
  const eventIdValue =
    toNonEmptyString(mergedDetail.eventId) ||
    toNonEmptyString(mergedDetail.rawData && typeof mergedDetail.rawData === "object"
      ? (mergedDetail.rawData as Record<string, unknown>).eventId
      : undefined) ||
    toNonEmptyString(eventData?.eventId) ||
    toNonEmptyString(eventData?.id);
  const canManageEvent = Boolean(eventIdValue || eventData);
  
  // Extract feedback from detail.feedback
  const feedbackLabel = useMemo(() => {
    const feedbackNode = detail?.feedback && typeof detail.feedback === "object"
      ? (detail.feedback as Record<string, unknown>)
      : null;
    
    if (feedbackNode && feedbackNode.description) {
      return toDisplayText(feedbackNode.description);
    }
    
    return notFoundText;
  }, [detail?.feedback]);
  
  const firstImageUrl = imageUrls[0] || "";

  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    const pushItem = (
      key: string,
      label: string,
      timeValue: unknown,
      sourceOrder: number,
      actorId?: string,
    ) => {
      const time = toNonEmptyString(timeValue);
      if (!time) return;
      items.push({ key, label, time, actorId, sourceOrder });
    };

    pushItem("created", "Created", mergedDetail.createAt || mergedDetail.createdAt, 1);
    // Note: Check-in events should only come from history, not from direct checkinTime field
    // to avoid duplicate timelines. History list is the authoritative source.
    // pushItem("checkin", "Check-in", mergedDetail.checkinTime || mergedDetail.checkInTime, 2);

    const historyList = Array.isArray(mergedDetail.history) ? mergedDetail.history : [];
    let extendIndex = 0;
    historyList.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      const row = entry as Record<string, unknown>;
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
        pushItem("history-checkin", "Check-in", row.performAt, 2, toNonEmptyString(row.performBy));
      }
    });

    pushItem("return", "Return room", mergedDetail.returnTime, 4);
    pushItem(
      "cancelled",
      "Cancelled",
      mergedDetail.cancelTime || mergedDetail.cancelledTime || mergedDetail.canceledAt,
      5,
      toNonEmptyString(mergedDetail.cancelledBy || mergedDetail.canceledBy || mergedDetail.cancelBy),
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
        if (Number.isNaN(timeA) && Number.isNaN(timeB)) return a.sourceOrder - b.sourceOrder;
        if (Number.isNaN(timeA)) return 1;
        if (Number.isNaN(timeB)) return -1;
        return timeA - timeB;
      });
  }, [mergedDetail]);

  const cancelledByLabel = useMemo(() => {
    const normalizedStatus = String(mergedDetail.status || "").toUpperCase();
    const isCancelledStatus =
      normalizedStatus === "CANCELLED" || normalizedStatus === "FORCE_CANCELLED";

    if (!isCancelledStatus) return notFoundText;

    const explicitRole = toNonEmptyString(
      mergedDetail.cancelledByRole || mergedDetail.canceledByRole || mergedDetail.cancelByRole,
    ).toUpperCase();

    if (explicitRole.includes("ADMIN")) return "Admin";
    if (explicitRole.includes("USER")) return "User";

    const actorIdFromReservation = toNonEmptyString(
      mergedDetail.cancelledBy || mergedDetail.canceledBy || mergedDetail.cancelBy,
    );

    const historyList = Array.isArray(mergedDetail.history) ? mergedDetail.history : [];
    const cancelHistoryActor = historyList
      .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null))
      .find((row) => {
        const action = toNonEmptyString(row?.action).toUpperCase();
        return action === "CANCEL" || action === "FORCE_CANCEL";
      });

    const actorIdFromHistory = toNonEmptyString(cancelHistoryActor?.performBy);
    const actorId = actorIdFromReservation || actorIdFromHistory;

    if (!actorId) return notFoundText;
    if (profileId && actorId === profileId) return "User";
    return "Admin";
  }, [mergedDetail, profileId]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Title level={2} className="!mb-1 text-slate-900 font-semibold tracking-tight">
            Booking Detail
          </Title>
          <Text className="text-slate-500">{roomLabel}</Text>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(ROUTES.MY_BOOKINGS)}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to My Bookings
          </button>
        </div>
      </div>

      {error && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Some booking details could not be refreshed"
          description="Showing available data. Please try again later for full sync."
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section className="space-y-4 lg:col-span-9">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
              <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:w-80 sm:min-w-80">
                {firstImageUrl && !failedImages[firstImageUrl] ? (
                  <img
                    src={firstImageUrl}
                    alt="Room"
                    className="h-80 w-full object-cover"
                    loading="lazy"
                    onError={() =>
                      setFailedImages((prev) => ({
                        ...prev,
                        [firstImageUrl]: true,
                      }))
                    }
                  />
                ) : (
                  <div className="flex h-80 w-full items-center justify-center text-sm font-semibold text-slate-500">
                    {notFoundText}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-2xl font-semibold text-slate-900">{roomLabel}</h3>
                  <Tag color={statusColor(String(mergedDetail.status || ""))}>{statusLabel}</Tag>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">
                    {buildingLabel}
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
                    Floor: {floorLabel}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Time slot</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {startLabel} - {endLabel}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Purpose</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 break-words">{purposeLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meeting recording — visible only when room is IN_USE */}
          {String(mergedDetail.status || "").toUpperCase() === "IN_USE" && (
            <MeetingRecorder
              reservationId={normalizedBookingId}
              meetingTitle={purposeLabel !== "Not found" ? purposeLabel : undefined}
            />
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">Feedback</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {feedbackLabel}
            </p>

            {cancelReasonLabel !== notFoundText && (
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-wide text-rose-600">Cancel reason</p>
                <p className="mt-1 text-sm font-semibold text-rose-800">{cancelReasonLabel}</p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">Event Timeline</p>
            {timelineItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{notFoundText}</p>
            ) : (
              <div className="mt-4">
                <div className="hidden overflow-x-auto pb-1 md:block">
                  <div className="flex min-w-max items-start gap-3">
                    {timelineItems.map((item, index) => {
                      const isLast = index === timelineItems.length - 1;
                      return (
                        <React.Fragment key={item.key}>
                          <div className="w-44 shrink-0 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white px-3 py-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                              {item.label}
                            </p>
                            <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">
                              {getDateTimeText(item.time)}
                            </p>
                          </div>
                          {!isLast && (
                            <div className="pt-8 text-lg font-bold text-orange-400">→</div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 md:hidden">
                  {timelineItems.map((item, index) => {
                    const isLast = index === timelineItems.length - 1;
                    return (
                      <div key={item.key} className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                          {!isLast && <span className="mt-1 h-8 w-px bg-orange-200" />}
                        </div>
                        <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {getDateTimeText(item.time)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-3 lg:max-w-[300px] lg:justify-self-end">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-lg font-semibold text-slate-900">Quick Actions</p>
            </div>

            <div className="space-y-3 p-5">
              <button
                type="button"
                onClick={() => navigate(ROUTES.MY_BOOKINGS)}
                className="w-full rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
              >
                Back to My Bookings
              </button>

              <button
                type="button"
                onClick={() => navigate(ROUTES.ROOM_LIST)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Book Another Room
              </button>

              {canManageEvent ? (
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.EVENT_SETUP.replace(":reservationId", normalizedBookingId))}
                  className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Event setup
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-lg font-semibold text-slate-900">Booking Snapshot</p>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold text-slate-800">{statusLabel}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">Building</span>
                <span className="font-semibold text-slate-800 text-right">{buildingLabel}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">Floor</span>
                <span className="font-semibold text-slate-800">{floorLabel}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">Start</span>
                <span className="font-semibold text-slate-800 text-right">{startLabel}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">End</span>
                <span className="font-semibold text-slate-800 text-right">{endLabel}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">Cancelled by</span>
                <span className="font-semibold text-slate-800 text-right">{cancelledByLabel}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
};

export default BookingDetailPage;
