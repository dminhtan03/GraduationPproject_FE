import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "antd";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { ROUTES } from "../../constants";
import { logout } from "../../services/authService";
import { reservationService } from "../../services/reservationService";
import { roomService } from "../../services/roomService";
import { extractApiMessage } from "../../utils/errorHandlers";

type UnknownRecord = Record<string, unknown>;

interface LocationState {
  booking?: UnknownRecord;
}

interface TimelineItem {
  key: string;
  label: string;
  time: string;
  actor?: string;
  sourceOrder: number;
}

const imagePattern = /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i;
const notFoundText = "Not found";

const toNonEmptyString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed || "";
};

const toDisplayText = (value: unknown): string => {
  if (value == null) return notFoundText;
  if (typeof value === "string") {
    return value.trim() ? value : notFoundText;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return notFoundText;
};

const pickFirstText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
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

    Object.entries(node as UnknownRecord).forEach(([key, value]) => {
      const lower = key.toLowerCase();
      if (typeof value === "string") {
        const trimmed = value.trim();
        const isUrl = /^https?:\/\//i.test(trimmed);
        if (
          isUrl &&
          (lower.includes("image") ||
            lower.includes("photo") ||
            imagePattern.test(trimmed))
        ) {
          urls.add(trimmed);
        }
      }
      visit(value);
    });
  };

  visit(source);
  return [...urls];
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const getStatusPillClass = (status?: string) => {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  if (normalized === "RESERVED") {
    return "border-emerald-300 bg-emerald-100 text-emerald-700";
  }
  if (normalized === "IN_USE" || normalized === "CHECKED_IN") {
    return "border-sky-300 bg-sky-100 text-sky-700";
  }
  if (normalized === "COMPLETED") {
    return "border-cyan-300 bg-cyan-100 text-cyan-700";
  }
  if (normalized === "CANCELLED" || normalized === "FORCE_CANCELLED") {
    return "border-rose-300 bg-rose-100 text-rose-700";
  }
  if (normalized === "NO_SHOW" || normalized === "FAILED") {
    return "border-amber-300 bg-amber-100 text-amber-700";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
};

const AdminBookingDetailPage: React.FC = () => {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<UnknownRecord | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [roomImageUrls, setRoomImageUrls] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const fetchedDetailIdRef = useRef<string>("");

  const loadAdminProfile = async () => {
    try {
      const response = await fetch("/api/v1/auth/profile");
      if (!response.ok) {
        setAdminName("Admin User");
        return;
      }

      const payload = (await response.json()) as {
        data?: {
          firstName?: string;
          lastName?: string;
        };
        firstName?: string;
        lastName?: string;
      };

      const firstName = payload.data?.firstName || payload.firstName || "";
      const lastName = payload.data?.lastName || payload.lastName || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      setAdminName(fullName || "Admin User");
    } catch {
      setAdminName("Admin User");
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
      toNonEmptyString(
        mergedDetail.cancelledBy ||
          mergedDetail.canceledBy ||
          mergedDetail.cancelBy,
      ),
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
  }, [mergedDetail]);

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
  const statusLabel = toDisplayText(mergedDetail.status);
  const cancelReasonLabel = toDisplayText(
    mergedDetail.cancelReason || mergedDetail.reason,
  );
  const feedbackNode =
    mergedDetail.feedback && typeof mergedDetail.feedback === "object"
      ? (mergedDetail.feedback as UnknownRecord)
      : null;
  const feedbackLabel = toDisplayText(feedbackNode?.description);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-orange-50">
      <AdminSidebar
        adminName={adminName}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="ml-72 flex-1 overflow-hidden">
        <main className="h-full overflow-auto px-4 pb-8 pt-5 lg:px-8">
          <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Booking Detail
                </h1>
              </div>

              <button
                type="button"
                onClick={() => navigate(ROUTES.ADMIN_ALL_BOOKINGS)}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to All Bookings
              </button>
            </div>
          </section>

          {error && (
            <Alert
              className="mb-4"
              type="warning"
              showIcon
              message="Some booking data could not be refreshed"
              description="The screen is displaying available fallback data from list and cache."
            />
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <section className="space-y-5 xl:col-span-8">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="h-full min-h-[280px] border-b border-slate-200 bg-slate-100 lg:border-b-0 lg:border-r">
                    {loading ? (
                      <div className="h-full animate-pulse bg-slate-200" />
                    ) : firstImageUrl && !failedImages[firstImageUrl] ? (
                      <img
                        src={firstImageUrl}
                        alt="Room"
                        className="h-full min-h-[280px] w-full object-cover"
                        loading="lazy"
                        onError={() =>
                          setFailedImages((prev) => ({
                            ...prev,
                            [firstImageUrl]: true,
                          }))
                        }
                      />
                    ) : (
                      <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-sm font-semibold text-slate-500">
                        {loadingImages
                          ? "Loading room images..."
                          : notFoundText}
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                        {roomLabel}
                      </h2>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getStatusPillClass(
                          String(mergedDetail.status || ""),
                        )}`}
                      >
                        {statusLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Building
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {buildingLabel}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Floor
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {floorLabel}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Start Time
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {startLabel}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          End Time
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {endLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-lg font-semibold tracking-tight text-slate-900">
                    Purpose
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {purposeLabel}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-lg font-semibold tracking-tight text-slate-900">
                    Note
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {noteLabel}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  Feedback
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {feedbackLabel}
                </p>

                {cancelReasonLabel !== notFoundText && (
                  <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                      Cancel Reason
                    </p>
                    <p className="mt-1 text-sm font-bold text-orange-800">
                      {cancelReasonLabel}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  Operation Timeline
                </p>

                {timelineItems.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">{notFoundText}</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {timelineItems.map((item, index) => {
                      const isLast = index === timelineItems.length - 1;

                      return (
                        <div key={item.key} className="flex items-start gap-3">
                          <div className="flex flex-col items-center pt-1">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                              {index + 1}
                            </span>
                            {!isLast && (
                              <span className="mt-1 h-10 w-px bg-slate-200" />
                            )}
                          </div>

                          <div className="flex-1 rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50/50 to-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {item.label}
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                              {getDateTimeText(item.time)}
                            </p>
                            {item.actor ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Actor ID: {item.actor}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4 xl:col-span-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  Booking Snapshot
                </p>

                <div className="mt-4 space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl bg-orange-50/50 p-3">
                    <UserCircleIcon className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Requester
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {requesterNameLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-orange-50/50 p-3">
                    <EnvelopeIcon className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Email
                      </p>
                      <p className="text-sm font-bold text-slate-900 break-all">
                        {requesterEmailLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-orange-50/50 p-3">
                    <BuildingOffice2Icon className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Building
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {buildingLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-orange-50/50 p-3">
                    <MapPinIcon className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Room
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {roomLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-orange-50/50 p-3">
                    <CalendarDaysIcon className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Start
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {startLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl bg-orange-50/50 p-3">
                    <ClockIcon className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        End
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {endLabel}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-orange-800">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Admin Action
                </p>
                <p className="mt-2 text-sm leading-6 text-orange-900">
                  Verify purpose, timeline, and participant details before
                  executing force-cancel or any manual action.
                </p>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminBookingDetailPage;
