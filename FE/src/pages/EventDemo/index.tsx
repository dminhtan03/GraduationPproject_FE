import React, { useMemo, useState } from "react";
import { api } from "../../services/api";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

type Participant = {
  id: string;
  userId?: string | null;
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
  visibility: "INVITE_ONLY" | "PUBLIC" | string;
  participants?: Participant[];
};

// start+ chức năng đặt phòng theo sự kiện (demo UI + invite-only participants + check-in list + QR token)
const EventDemoPage: React.FC = () => {
  const [reservationId, setReservationId] = useState("");
  const [title, setTitle] = useState("Meeting Event");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"INVITE_ONLY" | "PUBLIC">(
    "INVITE_ONLY",
  );

  const [eventData, setEventData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(
    null,
  );

  const [inviteMode, setInviteMode] = useState<"email" | "userId">("email");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");

  const canLoad = useMemo(() => reservationId.trim().length > 0, [reservationId]);

  const extract = (res: any) => (res?.data?.data ?? res?.data) as any;

  const createEvent = async () => {
    if (!canLoad) return;
    setLoading(true);
    try {
      const res = await api.post(API_ENDPOINTS.EVENTS.CREATE, {
        reservationId: reservationId.trim(),
        title: title.trim(),
        description: description.trim() || null,
        visibility,
      });
      const data = extract(res) as EventData;
      setEventData(data);
      setToast({ type: "success", message: "Event created" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Create event failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const loadEvent = async () => {
    if (!canLoad) return;
    setLoading(true);
    try {
      const res = await api.get(
        buildUrl(API_ENDPOINTS.EVENTS.BY_RESERVATION, {
          reservationId: reservationId.trim(),
        }),
      );
      const data = extract(res) as EventData;
      setEventData(data);
      setToast({ type: "success", message: "Event loaded" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Load event failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const invite = async () => {
    if (!eventData?.id) return;
    setLoading(true);
    try {
      const payload =
        inviteMode === "userId"
          ? { eventId: eventData.id, userId: inviteUserId.trim() }
          : {
              eventId: eventData.id,
              email: inviteEmail.trim(),
              fullName: inviteFullName.trim() || null,
            };
      await api.post(API_ENDPOINTS.EVENTS.INVITE_PARTICIPANT, payload);
      await loadEvent();
      setInviteEmail("");
      setInviteFullName("");
      setInviteUserId("");
      setToast({ type: "success", message: "Participant invited" });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Invite failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!window.confirm("Remove this participant?")) return;
    setLoading(true);
    try {
      await api.delete(
        buildUrl(API_ENDPOINTS.EVENTS.REMOVE_PARTICIPANT, { participantId }),
      );
      await loadEvent();
      setToast({ type: "success", message: "Participant removed" });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Remove participant failed";
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
      const data = extract(res) as { token: string; expiresAt: string };
      setToast({
        type: "success",
        message: `Token: ${data.token} (expiresAt: ${data.expiresAt})`,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Generate QR failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Event Demo</h1>
      <p className="mt-1 text-sm text-slate-500">
        Demo tạo event gắn Reservation, invite-only participants, và generate QR cho participant.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={reservationId}
            onChange={(e) => setReservationId(e.target.value)}
            placeholder="Reservation ID..."
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
          />
          <button
            disabled={loading || !canLoad}
            onClick={loadEvent}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Load event
          </button>
          <button
            disabled={loading || !canLoad}
            onClick={createEvent}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            Create event
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
          />
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
          >
            <option value="INVITE_ONLY">INVITE_ONLY</option>
            <option value="PUBLIC">PUBLIC</option>
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">Invite participant</h2>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
          <select
            value={inviteMode}
            onChange={(e) => setInviteMode(e.target.value as any)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 md:w-40"
          >
            <option value="email">By email</option>
            <option value="userId">By userId</option>
          </select>

          {inviteMode === "userId" ? (
            <input
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
              placeholder="User ID..."
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
            />
          ) : (
            <>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email..."
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              />
              <input
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                placeholder="Full name (optional)"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              />
            </>
          )}

          <button
            disabled={loading || !eventData?.id}
            onClick={invite}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            Invite
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Participants</h2>
          <p className="text-sm text-slate-500">
            Check-in list: checkInStatus / checkInTime.
          </p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-xs font-bold uppercase text-slate-500">Email</th>
              <th className="px-5 py-3 text-xs font-bold uppercase text-slate-500">Name</th>
              <th className="px-5 py-3 text-xs font-bold uppercase text-slate-500">Invite</th>
              <th className="px-5 py-3 text-xs font-bold uppercase text-slate-500">Check-in</th>
              <th className="px-5 py-3 text-xs font-bold uppercase text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {eventData?.participants?.length ? (
              eventData.participants.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-3 text-sm text-slate-700">{p.email || "-"}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">{p.fullName || "-"}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">{p.inviteStatus || "-"}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">
                    {p.checkInStatus || "-"} {p.checkInTime ? `(${p.checkInTime})` : ""}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        disabled={loading}
                        onClick={() => generateParticipantQr(p.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        Generate QR
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => removeParticipant(p.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                  No participants.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toast ? (
        <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
};

export default EventDemoPage;
// end+ chức năng đặt phòng theo sự kiện (demo UI + invite-only participants + check-in list + QR token)

