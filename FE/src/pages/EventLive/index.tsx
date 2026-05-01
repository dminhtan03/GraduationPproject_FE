import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Table,
  Tag,
  Space,
  Card,
  Input,
  InputNumber,
  Empty,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowLeftIcon,
  Cog6ToothIcon,
  ClockIcon,
  MapPinIcon,
  UserGroupIcon,
  SparklesIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";
import { useAppSelector, selectAuthUser } from "../../store";
import { isAdminUser } from "../../services/authService";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { formatDateTime24, formatPriceVN } from "../../utils/helpers";

type Amenity = { id: string; name: string };

type Participant = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  inviteStatus?: string | null;
  checkInStatus?: string | null;
  checkInTime?: string | null;
};

type EventData = {
  id: string;
  reservationId: string;
  title: string;
  description?: string | null;
  visibility: string;
  participants?: Participant[];
};

type ServiceLine = {
  id: string;
  serviceItemId: string;
  name: string;
  unit?: string | null;
  priceSnapshot?: number | null;
  quantity: number;
  note?: string | null;
};

type ServiceItem = {
  id: string;
  name: string;
  unit?: string | null;
  price?: number | null;
};

const extractData = (res: any) => (res?.data?.data ?? res?.data) as any;

const getRoomInfo = (detail: any) => {
  const room = detail?.room ?? detail?.reservation?.room ?? null;
  const code = room?.locationCode ?? room?.roomCode ?? room?.code ?? "";
  const amenities = Array.isArray(room?.amenities) ? (room.amenities as Amenity[]) : [];
  return { room, code, amenities };
};

// start+ chức năng sự kiện đang diễn ra (màn hình chi tiết + gọi thêm dịch vụ/tiện ích)
const EventLivePage: React.FC = () => {
  const navigate = useNavigate();
  const { reservationId } = useParams();
  const normalizedReservationId = useMemo(() => String(reservationId || "").trim(), [reservationId]);

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [addDraft, setAddDraft] = useState<Record<string, { quantity: string; note: string }>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [liveCode, setLiveCode] = useState<string>("");
  const [codeCountdown, setCodeCountdown] = useState<number>(0);
  const [checkInInput, setCheckInInput] = useState<string>("");

  const user = useAppSelector(selectAuthUser);
  const isOwnerOrAdmin = useMemo(() => {
    if (!user) return false;
    if (isAdminUser(user)) return true;
    const reservationUserId = (detail as any)?.reservation?.userId || (detail as any)?.userId;
    return String(reservationUserId) === String(user.id) || (user.email && (detail as any)?.reservation?.userEmail === user.email);
  }, [user, detail]);

  const isOwnerCheckedIn = useMemo(() => {
    const status = String((detail as any)?.status || (detail as any)?.reservation?.status || "").toUpperCase();
    return status === "IN_USE" || status === "CHECKED_IN";
  }, [detail]);

  const loadReservationDetail = async () => {
    if (!normalizedReservationId) return;
    const res = await reservationService.getBookingDetail(normalizedReservationId);
    setDetail(res);
  };

  const loadEvent = async () => {
    if (!normalizedReservationId) return;
    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, { reservationId: normalizedReservationId }),
      );
      setEventData(extractData(res) as EventData);
    } catch {
      setEventData(null);
    }
  };

  const loadLiveCode = async () => {
    if (!normalizedReservationId || !isOwnerOrAdmin) return;
    try {
      const res = await api.get(buildUrl(API_ENDPOINTS.CHECKIN_QR.GET_LIVE_CODE, { reservationId: normalizedReservationId }));
      const data = extractData(res);
      setLiveCode(data.token);
      const expiresAt = new Date(data.expiresAt).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setCodeCountdown(diff);
    } catch (err) {
      console.error("Load live code failed", err);
    }
  };

  useEffect(() => {
    if (isOwnerOrAdmin && normalizedReservationId) {
      loadLiveCode();
      const timer = setInterval(loadLiveCode, 30000);
      return () => clearInterval(timer);
    }
  }, [isOwnerOrAdmin, normalizedReservationId]);

  useEffect(() => {
    if (codeCountdown > 0) {
      const timer = setTimeout(() => setCodeCountdown(codeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isOwnerOrAdmin) {
      loadLiveCode();
    }
  }, [codeCountdown, isOwnerOrAdmin]);

  const loadServiceItems = async () => {
    const res = await api.get(API_ENDPOINTS.SERVICE_ITEMS.LIST, { params: { activeOnly: true } });
    const raw = extractData(res);
    const list = Array.isArray(raw) ? (raw as any[]) : [];
    setServiceItems(
      list
        .map((row) => ({
          id: String(row?.id ?? ""),
          name: String(row?.name ?? ""),
          unit: row?.unit == null ? null : String(row.unit),
          price: typeof row?.price === "number" ? row.price : row?.price == null ? null : Number(row.price),
        }))
        .filter((i) => i.id && i.name),
    );
  };

  useEffect(() => {
    if (!normalizedReservationId) return;
    setLoading(true);
    Promise.all([loadReservationDetail(), loadEvent(), loadServiceItems()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [normalizedReservationId]);

  const currentServiceLines: ServiceLine[] = useMemo(() => {
    const raw = (detail as any)?.serviceItems ?? (detail as any)?.reservation?.serviceItems ?? [];
    return Array.isArray(raw) ? (raw as ServiceLine[]) : [];
  }, [detail]);

  const saveMergedServices = async () => {
    if (!normalizedReservationId) return;
    setLoading(true);
    try {
      const existing = new Map<string, { quantity: number; note: string | null }>();
      for (const line of currentServiceLines) {
        existing.set(String(line.serviceItemId), {
          quantity: Number(line.quantity || 0),
          note: typeof line.note === "string" ? line.note : null,
        });
      }

      for (const [serviceItemId, draft] of Object.entries(addDraft)) {
        const qty = Number(draft.quantity);
        if (!serviceItemId || !Number.isFinite(qty) || qty <= 0) continue;
        const prev = existing.get(serviceItemId);
        existing.set(serviceItemId, {
          quantity: (prev?.quantity || 0) + qty,
          note: draft.note?.trim() || prev?.note || null,
        });
      }

      const payload = Array.from(existing.entries())
        .map(([serviceItemId, v]) => ({
          serviceItemId,
          quantity: v.quantity,
          note: v.note,
        }))
        .filter((x) => x.serviceItemId && x.quantity > 0);

      await api.put(buildUrl(API_ENDPOINTS.ROOMS.RESERVATION_SERVICE_ITEMS, { id: normalizedReservationId }), {
        serviceItems: payload,
      });

      setAddDraft({});
      setToast({ type: "success", message: "Services updated" });
      await loadReservationDetail();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Update services failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const handleCodeCheckIn = async () => {
    if (!normalizedReservationId || !checkInInput) return;
    setLoading(true);
    try {
      await api.post(
        buildUrl(API_ENDPOINTS.CHECKIN_QR.CHECK_IN_CODE, { reservationId: normalizedReservationId }),
        null,
        { params: { code: checkInInput } }
      );
      setToast({ type: "success", message: "Check-in successful!" });
      setCheckInInput("");
      await loadEvent();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Check-in failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerCheckIn = async () => {
    if (!normalizedReservationId) return;
    setLoading(true);
    try {
      await reservationService.checkInBooking(normalizedReservationId);
      setToast({ type: "success", message: "Check-in successful!" });
      await loadReservationDetail();
      await loadLiveCode();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Check-in failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const { code: roomCode, amenities } = getRoomInfo(detail);
  const building = (detail as any)?.building ?? (detail as any)?.reservation?.building ?? null;
  const address = building?.address || building?.name || "";

  const reservationNode: any = (detail as any)?.reservation ?? detail;
  const startTime = reservationNode?.startTime ?? reservationNode?.start_time ?? "";
  const endTime = reservationNode?.endTime ?? reservationNode?.end_time ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Event Live</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPinIcon className="h-4 w-4 text-orange-400" />
            Room: <span className="font-semibold text-slate-700">{roomCode || "—"}</span>
          </p>
        </div>

        <Space>
          {isOwnerOrAdmin && (
            <button
              type="button"
              disabled={loading}
              onClick={() => navigate(`/events/setup/${normalizedReservationId}`)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              Setup
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back
          </button>
        </Space>
      </div>

      {/* ── Row 1: Event Info + Room Amenities ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Event Information */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <SparklesIcon className="h-5 w-5 text-orange-500" />
            <p className="text-base font-semibold text-slate-900">Event Information</p>
          </div>

          <div className="p-5">
            {eventData ? (
              <div className="space-y-4 text-sm">
                {/* Title */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Title</p>
                  <p className="mt-1 font-semibold text-slate-800">{eventData.title}</p>
                </div>

                {/* Visibility */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Visibility</p>
                  <p className="mt-1 font-semibold text-slate-800">{eventData.visibility}</p>
                </div>

                {/* Description */}
                {eventData.description && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p>
                    <p className="mt-1 text-slate-700 leading-relaxed">{eventData.description}</p>
                  </div>
                )}

                {/* Time */}
                <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-500">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Time Slot
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {formatDateTime24(startTime)} → {formatDateTime24(endTime)}
                  </p>
                </div>

                {/* Room */}
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <MapPinIcon className="h-3.5 w-3.5" />
                    Room
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">{roomCode || "—"}</p>
                </div>

                {/* Address */}
                {address && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address</p>
                    <p className="mt-1 font-semibold text-slate-800">{address}</p>
                  </div>
                )}

                {/* Live Code (checked-in) */}
                {isOwnerOrAdmin && isOwnerCheckedIn && (
                  <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <KeyIcon className="h-4 w-4 text-green-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Live Check-in Code</p>
                    </div>
                    <div className="text-3xl font-mono font-bold text-orange-600 tracking-[0.3em] text-center py-2">
                      {liveCode || "------"}
                    </div>
                    <p className="text-center text-xs text-slate-500 mt-2">
                      Refreshes in <span className="font-bold text-orange-500">{codeCountdown}s</span> · Share this code with participants
                    </p>
                  </div>
                )}

                {/* Check-in prompt (not yet checked-in) */}
                {isOwnerOrAdmin && !isOwnerCheckedIn && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <ExclamationCircleIcon className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">Check-in Required</p>
                        <p className="text-xs text-amber-600 mt-0.5">Please check-in to this booking first to see the event code.</p>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={handleOwnerCheckIn}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                          Check-in Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Empty description="Event not found for this reservation." />
            )}
          </div>
        </div>

        {/* Right Column: Room Amenities & Participants */}
        <div className="flex flex-col gap-6">
          {/* Room Amenities */}
          {isOwnerOrAdmin && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <SparklesIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">Room Amenities</p>
              </div>
              <div className="p-5">
                {amenities.length ? (
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-100"
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">No amenities listed for this room.</span>
                )}
              </div>
            </div>
          )}

          {/* ── Participants ── */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <UserGroupIcon className="h-5 w-5 text-orange-500" />
              <p className="text-base font-semibold text-slate-900">
                {isOwnerOrAdmin ? "Participants (Check-in List)" : "My Check-in Status"}
              </p>
            </div>

            <div className="p-4">
              <Table<Participant>
                rowKey={(record) => record.id}
                dataSource={
                  eventData?.participants?.filter((p: any) =>
                    isOwnerOrAdmin || (user?.email && p.email === user.email)
                  ) || []
                }
                pagination={false}
                columns={[
                  {
                    title: "EMAIL",
                    dataIndex: "email",
                    key: "email",
                    render: (value: string | undefined) => value || "—",
                  },
                  {
                    title: "NAME",
                    dataIndex: "fullName",
                    key: "fullName",
                    render: (value: string | undefined) => value || "—",
                  },
                  {
                    title: "CHECK-IN",
                    dataIndex: "checkInStatus",
                    key: "checkInStatus",
                    render: (value: string | undefined, record: Participant) => {
                      const normalized = String(value || "NOT_CHECKED_IN").toUpperCase();
                      const isCheckedIn = normalized === "CHECKED_IN";
                      const label = isCheckedIn ? "Checked In" : "Not Checked In";
                      return (
                        <div>
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isCheckedIn
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {label}
                          </span>
                          {record.checkInTime && (
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(record.checkInTime).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      );
                    },
                  },
                  ...(isOwnerOrAdmin
                    ? [
                        {
                          title: "ACTION",
                          key: "action",
                          render: () => (
                            <span className="text-xs text-slate-400">Owner View</span>
                          ),
                        },
                      ]
                    : []),
                ] as ColumnsType<Participant>}
                locale={{ emptyText: "No participants." }}
              />

              {/* Participant self check-in via code */}
              {!isOwnerOrAdmin &&
                eventData?.participants?.some(
                  (p: any) =>
                    user?.email && p.email === user.email && p.checkInStatus !== "CHECKED_IN"
                ) &&
                isOwnerCheckedIn && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <KeyIcon className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-800">Enter Check-in Code</p>
                        <p className="text-xs text-blue-600 mt-0.5">Enter the 6-digit code provided by the host.</p>
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            size="small"
                            value={checkInInput}
                            onChange={(e) =>
                              setCheckInInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            placeholder="6-digit code"
                            style={{ width: 130 }}
                          />
                          <button
                            type="button"
                            disabled={loading || checkInInput.length !== 6}
                            onClick={handleCodeCheckIn}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Check-in
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Services (owner/admin only) ── */}
      {isOwnerOrAdmin && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Current Services */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <CheckCircleIcon className="h-5 w-5 text-orange-500" />
              <p className="text-base font-semibold text-slate-900">Current Services</p>
            </div>
            <div className="p-4">
              <Table<ServiceLine>
                rowKey={(record) => record.id}
                dataSource={currentServiceLines}
                pagination={false}
                columns={[
                  {
                    title: "SERVICE",
                    dataIndex: "name",
                    key: "name",
                  },
                  {
                    title: "QTY",
                    dataIndex: "quantity",
                    key: "quantity",
                    width: 80,
                  },
                  {
                    title: "NOTE",
                    dataIndex: "note",
                    key: "note",
                    render: (value: string | undefined) => value || "—",
                  },
                ]}
                locale={{ emptyText: "No services selected." }}
              />
            </div>
          </div>

          {/* Call Additional Services */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <PlusCircleIcon className="h-5 w-5 text-orange-500" />
              <p className="text-base font-semibold text-slate-900">Call Additional Services</p>
            </div>
            <div className="p-5">
              <p className="mb-4 text-sm text-slate-500">
                Add services during the event. Quantities will be accumulated.
              </p>

              {serviceItems.length ? (
                <div className="space-y-3">
                  {serviceItems.map((s) => {
                    const draft = addDraft[s.id] || { quantity: "", note: "" };
                    return (
                      <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-800 truncate">{s.name}</div>
                          <div className="text-xs text-slate-400">
                            {s.price != null ? formatPriceVN(s.price) : "—"}{s.unit ? ` / ${s.unit}` : ""}
                          </div>
                        </div>
                        <InputNumber
                          size="small"
                          min={0}
                          value={draft.quantity ? Number(draft.quantity) : undefined}
                          onChange={(value) =>
                            setAddDraft((prev) => ({
                              ...prev,
                              [s.id]: { ...draft, quantity: value ? String(value) : "" },
                            }))
                          }
                          placeholder="Qty"
                          style={{ width: 64 }}
                        />
                        <Input
                          size="small"
                          value={draft.note}
                          onChange={(e) =>
                            setAddDraft((prev) => ({
                              ...prev,
                              [s.id]: { ...draft, note: e.target.value },
                            }))
                          }
                          placeholder="Note"
                          style={{ width: 100 }}
                        />
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={saveMergedServices}
                    className="mt-2 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    {loading ? "Saving…" : "Save Additional Services"}
                  </button>
                </div>
              ) : (
                <Empty description="No active service items." />
              )}
            </div>
          </div>
        </div>
      )}



      {toast ? (
        <CustomMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
};

export default EventLivePage;
// end+ chức năng sự kiện đang diễn ra (màn hình chi tiết + gọi thêm dịch vụ/tiện ích)
