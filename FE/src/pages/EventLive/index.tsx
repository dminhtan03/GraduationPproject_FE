import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Table,
  Tag,
  Button,
  Space,
  Card,
  Divider,
  Input,
  InputNumber,
  Empty,
  Alert,
} from "antd";
import type { ColumnsType } from "antd/es/table";
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
    // user.id in store is usually string from sub or numeric id 0. 
    // Let's use string comparison for safety.
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
      const timer = setInterval(loadLiveCode, 30000); // Refresh every 30s for safety
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

  const generateParticipantQr = async (participantId: string) => {
    setLoading(true);
    try {
      const res = await api.post(
        buildUrl(API_ENDPOINTS.CHECKIN_QR.GENERATE_PARTICIPANT, { participantId }),
      );
      const data = extractData(res) as { token: string; expiresAt: string };
      setToast({ type: "success", message: `Token: ${data.token} (expires: ${data.expiresAt})` });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Generate QR failed";
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

  const { code: roomCode, amenities, room } = getRoomInfo(detail);
  const building = (detail as any)?.building ?? (detail as any)?.reservation?.building ?? room?.floor?.building ?? null;
  const address = building?.address || building?.name || "";

  const reservationNode: any = (detail as any)?.reservation ?? detail;
  const startTime = reservationNode?.startTime ?? reservationNode?.start_time ?? "";
  const endTime = reservationNode?.endTime ?? reservationNode?.end_time ?? "";

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Live</h1>
          <p className="mt-1 text-sm text-slate-500">
            Room: <span className="font-semibold">{roomCode || "-"}</span>
          </p>
        </div>
        <Space>
          {isOwnerOrAdmin && (
            <Button
              type="default"
              disabled={loading}
              onClick={() => navigate(`/events/setup/${normalizedReservationId}`)}
            >
              Setup
            </Button>
          )}
          <Button
            type="primary"
            disabled={loading}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Space>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Event Information"
          bordered={false}
          className="shadow-sm"
        >
          {eventData ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Title:</span>
                <div className="text-slate-700 mt-1">{eventData.title}</div>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <div>
                <span className="font-semibold">Visibility:</span>
                <div className="text-slate-700 mt-1">{eventData.visibility}</div>
              </div>
              {eventData.description && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <div>
                    <span className="font-semibold">Description:</span>
                    <div className="text-slate-700 mt-1">{eventData.description}</div>
                  </div>
                </>
              )}
              <Divider style={{ margin: "8px 0" }} />
              <div>
                <span className="font-semibold">Time:</span>
                <div className="text-slate-700 mt-1">
                  {formatDateTime24(startTime)} → {formatDateTime24(endTime)}
                </div>
              </div>
              <Divider style={{ margin: "8px 0" }} />
              <div>
                <span className="font-semibold">Room:</span>
                <div className="text-slate-700 mt-1">{roomCode || "-"}</div>
              </div>
              {address && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <div>
                    <span className="font-semibold">Address:</span>
                    <div className="text-slate-700 mt-1">{address}</div>
                  </div>
                </>
              )}
              {isOwnerOrAdmin && isOwnerCheckedIn && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <Alert
                    type="info"
                    showIcon
                    message="Live Check-in Code"
                    description={
                      <div className="mt-2">
                        <div className="text-2xl font-mono font-bold text-orange-600 tracking-widest">
                          {liveCode || "------"}
                        </div>
                        <div className="text-xs text-slate-600 mt-2">
                          ({codeCountdown}s) Give this 6-digit code to participants for check-in. It refreshes every minute.
                        </div>
                      </div>
                    }
                  />
                </>
              )}
              {isOwnerOrAdmin && !isOwnerCheckedIn && (
                <>
                  <Divider style={{ margin: "8px 0" }} />
                  <Alert
                    type="warning"
                    showIcon
                    message="Please check-in to this booking first to see the event code."
                    action={
                      <Button
                        size="small"
                        type="primary"
                        loading={loading}
                        onClick={handleOwnerCheckIn}
                      >
                        Check-in now
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          ) : (
            <Empty description="Event not found for this reservation." />
          )}
        </Card>

        {isOwnerOrAdmin && (
          <Card
            title="Room Amenities"
            bordered={false}
            className="shadow-sm"
          >
            <div className="flex flex-wrap gap-2">
              {amenities.length ? (
                amenities.map((a) => (
                  <Tag key={a.id} color="blue">
                    {a.name}
                  </Tag>
                ))
              ) : (
                <span className="text-sm text-slate-500">No amenities.</span>
              )}
            </div>
          </Card>
        )}
      </div>

      {isOwnerOrAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
          <Card
            title="Current Services"
            bordered={false}
            className="shadow-sm"
          >
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
                  render: (value: string | undefined) => value || "-",
                },
              ]}
              locale={{
                emptyText: "No services selected.",
              }}
            />
          </Card>

          <Card
            title="Call Additional Services"
            bordered={false}
            className="shadow-sm"
          >
            <div className="text-sm text-slate-600 mb-4">
              Add services during the event (quantities will be accumulated).
            </div>

            {serviceItems.length ? (
              <div className="space-y-3">
                {serviceItems.map((s) => {
                  const draft = addDraft[s.id] || { quantity: "", note: "" };
                  return (
                    <div key={s.id} className="flex items-center gap-2 pb-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{s.name}</div>
                        <div className="text-xs text-slate-500">
                          {s.price != null ? formatPriceVN(s.price) : "-"} {s.unit ? `/${s.unit}` : ""}
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
                        style={{ width: 60 }}
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
                <Button
                  type="primary"
                  block
                  loading={loading}
                  onClick={saveMergedServices}
                  className="mt-4"
                >
                  Save Additional Services
                </Button>
              </div>
            ) : (
              <Empty description="No active service items." />
            )}
          </Card>
        </div>
      )}

      <Card
        title={
          isOwnerOrAdmin ? "Participants (Check-in List)" : "My Check-in Status"
        }
        bordered={false}
        className="shadow-sm mt-6"
      >
        <Table<Participant>
          rowKey={(record) => record.id}
          dataSource={eventData?.participants?.filter((p: any) =>
            isOwnerOrAdmin || (user?.email && p.email === user.email)
          ) || []}
          pagination={false}
          columns={[
            {
              title: "EMAIL",
              dataIndex: "email",
              key: "email",
              render: (value: string | undefined) => value || "-",
            },
            {
              title: "NAME",
              dataIndex: "fullName",
              key: "fullName",
              render: (value: string | undefined) => value || "-",
            },
            {
              title: "CHECK-IN",
              dataIndex: "checkInStatus",
              key: "checkInStatus",
              render: (value: string | undefined, record: Participant) => (
                <div>
                  <Tag
                    color={
                      value === "CHECKED_IN"
                        ? "green"
                        : "orange"
                    }
                  >
                    {value || "NOT_CHECKED_IN"}
                  </Tag>
                  {record.checkInTime && (
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(record.checkInTime).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              ),
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
          ]}
          locale={{
            emptyText: "No participants.",
          }}
        />

        {!isOwnerOrAdmin &&
          eventData?.participants?.some(
            (p: any) =>
              user?.email && p.email === user.email && p.checkInStatus !== "CHECKED_IN"
          ) &&
          isOwnerCheckedIn && (
            <Alert
              type="info"
              showIcon
              message="Enter the 6-digit code provided by the host to check in"
              action={
                <div className="flex gap-2">
                  <Input
                    size="small"
                    value={checkInInput}
                    onChange={(e) =>
                      setCheckInInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    style={{ width: 120 }}
                  />
                  <Button
                    size="small"
                    type="primary"
                    loading={loading}
                    disabled={checkInInput.length !== 6}
                    onClick={handleCodeCheckIn}
                  >
                    Check-in
                  </Button>
                </div>
              }
              className="mt-4"
            />
          )}
      </Card>

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
