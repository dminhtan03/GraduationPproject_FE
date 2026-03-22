import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Tag, Typography } from "antd";
import { reservationService } from "../../services/reservationService";
import { ROUTES } from "../../constants";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { Reservation } from "../../types";

const { Title, Text } = Typography;

interface LocationState {
  booking?: Reservation;
}

const imagePattern = /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?.*)?$/i;

const toDisplayText = (value: unknown): string => {
  if (value == null) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.length ? JSON.stringify(value, null, 2) : "[]";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
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
  if (normalized === "REJECTED") return "volcano";
  return "default";
};

const BookingDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { state } = useLocation();

  const bookingFromState = (state as LocationState | null)?.booking;
  const normalizedBookingId = bookingId || bookingFromState?.id || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
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
        setError(extractApiMessage(err, "Unable to load booking details"));
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [normalizedBookingId]);

  const mergedDetail = useMemo(() => {
    return {
      ...(bookingFromState?.rawData || {}),
      ...(detail || {}),
      reservationId: normalizedBookingId,
      buildingName:
        (detail?.buildingName as string | undefined) ||
        bookingFromState?.buildingName ||
        bookingFromState?.address ||
        "-",
    } as Record<string, unknown>;
  }, [bookingFromState, detail, normalizedBookingId]);

  const imageUrls = useMemo(() => collectImageUrls(mergedDetail), [mergedDetail]);

  const entries = useMemo(
    () =>
      Object.entries(mergedDetail).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    [mergedDetail],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Title level={2} className="!mb-1 text-slate-900 font-semibold">
            Booking Detail
          </Title>
          <Text className="text-slate-500">Reservation ID: {normalizedBookingId || "-"}</Text>
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
          type="error"
          showIcon
          message="Unable to load booking detail"
          description={error}
        />
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Location</p>
            <p className="font-semibold text-slate-800">{toDisplayText(mergedDetail.locationCode || mergedDetail.roomName)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Building</p>
            <p className="font-semibold text-slate-800">{toDisplayText(mergedDetail.buildingName || mergedDetail.address)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Attendee Count</p>
            <p className="font-semibold text-slate-800">{toDisplayText(mergedDetail.attendeeCount)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <Tag color={statusColor(String(mergedDetail.status || ""))}>{toDisplayText(mergedDetail.status)}</Tag>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Images</h3>
        {imageUrls.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No images in booking payload.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {imageUrls.map((url) => (
              <div key={url} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img src={url} alt="Booking evidence" className="h-52 w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">All API Fields</h3>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading booking payload...</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{key}</p>
                {typeof value === "object" && value !== null ? (
                  <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-2 text-xs text-slate-100">
                    {toDisplayText(value)}
                  </pre>
                ) : (
                  <p className="mt-1 text-sm text-slate-800 break-all">{toDisplayText(value)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingDetailPage;
