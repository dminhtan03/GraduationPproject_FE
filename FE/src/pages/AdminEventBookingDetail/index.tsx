import React from "react";
import { Badge } from "antd";
import {
  ArrowLeftIcon,
  SparklesIcon,
  CheckCircleIcon,
  QueueListIcon,
} from "@heroicons/react/24/outline";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage from "../../components/common/CustomMessage";
import { formatDateTime24 } from "../../utils/helpers";
import AdminServiceTable from "../../components/ui/AdminServiceTable";
import { useAdminEventBookingDetail } from "../../hooks/useAdminEventBookingDetail";

const AdminEventBookingDetailPage: React.FC = () => {
  const {
    navigate,
    eventData,
    loading,
    adminName,
    adminEmail,
    toast,
    setToast,
    updatingStatus,
    cancelModal,
    setCancelModal,
    handleUpdateStatus,
    confirmCancel,
    activeLines,
    historyLines,
    summaryRows,
    amenities,
    roomCode,
    handleLogout,
    startTime,
    endTime,
  } = useAdminEventBookingDetail();

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={false}
        onCloseMobile={() => {}}
      />

      <main className="flex-1 lg:pl-72">
        <div className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Event Details
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Room:{" "}
                <span className="font-semibold text-slate-800">{roomCode}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>
          </div>

          {/* Event info + Amenities */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
            {/* Event Information */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <SparklesIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Event Information
                </p>
              </div>
              <div className="p-5">
                {eventData ? (
                  <div className="space-y-4 text-sm">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Title
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {eventData.title}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Visibility
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {eventData.visibility}
                      </p>
                    </div>
                    {eventData.description && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Description
                        </p>
                        <p className="mt-1 text-slate-700 leading-relaxed">
                          {eventData.description}
                        </p>
                      </div>
                    )}
                    <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                        Time
                      </p>
                      <p className="mt-1 font-semibold text-slate-800">
                        {formatDateTime24(startTime)} →{" "}
                        {formatDateTime24(endTime)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-500">Event not found.</span>
                )}
              </div>
            </div>

            {/* Room Amenities */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <SparklesIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Room Amenities
                </p>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  {amenities.length ? (
                    amenities.map((a) => (
                      <span
                        key={a.id}
                        className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 border border-orange-100"
                      >
                        {a.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">
                      No amenities.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── ACTIVE ORDERS ── */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm mb-6">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Active Service Orders
                </p>
              </div>
              {activeLines.length > 0 && (
                <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  {activeLines.length}
                </span>
              )}
            </div>
            <div className="p-5">
              <p className="mb-4 text-sm text-slate-500">
                Latest requests from users. Admin updates the status of each
                line.
              </p>
              {loading ? (
                <span className="text-slate-400">Loading...</span>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <AdminServiceTable
                    lines={activeLines}
                    editable={true}
                    emptyText="No active service orders."
                    updatingStatus={updatingStatus}
                    onUpdateStatus={handleUpdateStatus}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── HISTORY (DONE / CANCELLED) ── */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm mb-6">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <QueueListIcon className="h-5 w-5 text-slate-400" />
                <p className="text-base font-semibold text-slate-900">
                  Completed / Cancelled History
                </p>
              </div>
              {historyLines.length > 0 && (
                <span className="rounded-full bg-slate-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  {historyLines.length}
                </span>
              )}
            </div>
            <div className="p-5">
              <p className="mb-4 text-sm text-slate-500">
                Processed orders. Status cannot be changed.
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <AdminServiceTable
                  lines={historyLines}
                  editable={false}
                  emptyText="No completed or cancelled orders yet."
                  showDot={false}
                />
              </div>
            </div>
          </div>

          {/* ── SUMMARY TABLE ── */}
          {summaryRows.length > 0 && (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm mb-6">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <QueueListIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-semibold text-slate-900">
                  Service Summary
                </p>
              </div>
              <div className="p-5">
                <p className="mb-4 text-sm text-slate-500">
                  Aggregated service requests for this event.
                </p>
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                          Service
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          Total Qty
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          In Progress
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          Completed
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-center">
                          Cancelled
                        </th>
                        <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">
                          Estimated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryRows.map((row) => (
                        <tr key={row.name} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {row.name}
                            {row.unit && (
                              <span className="ml-1 text-xs font-normal text-slate-400">
                                /{row.unit}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-slate-800">
                            {row.totalQty}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.activeQty > 0 ? (
                              <Badge
                                count={row.activeQty}
                                style={{ backgroundColor: "#f97316" }}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.doneQty > 0 ? (
                              <Badge
                                count={row.doneQty}
                                style={{ backgroundColor: "#10b981" }}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.cancelledQty > 0 ? (
                              <Badge
                                count={row.cancelledQty}
                                style={{ backgroundColor: "#ef4444" }}
                              />
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {row.estimatedTotal != null
                              ? row.estimatedTotal.toLocaleString("vi-VN") +
                                " đ"
                              : "-"}
                          </td>
                        </tr>
                      ))}

                      {/* Grand total row */}
                      {summaryRows.length > 1 && (
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            Total
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-900">
                            {summaryRows.reduce((s, r) => s + r.totalQty, 0)}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-orange-700">
                            {summaryRows.reduce((s, r) => s + r.activeQty, 0) ||
                              "-"}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-green-700">
                            {summaryRows.reduce((s, r) => s + r.doneQty, 0) ||
                              "-"}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-red-700">
                            {summaryRows.reduce(
                              (s, r) => s + r.cancelledQty,
                              0,
                            ) || "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {summaryRows.some((r) => r.estimatedTotal != null)
                              ? summaryRows
                                  .reduce(
                                    (s, r) => s + (r.estimatedTotal ?? 0),
                                    0,
                                  )
                                  .toLocaleString("vi-VN") + " đ"
                              : "-"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {toast && (
          <CustomMessage
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        {/* start+ cancel reason modal */}
        {cancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-slate-900">
                Cancel Service Request
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Service:{" "}
                <span className="font-semibold">{cancelModal.item.name}</span>
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Reason <span className="text-red-500">*</span>
              </p>
              <textarea
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal((prev) =>
                    prev ? { ...prev, reason: e.target.value } : prev,
                  )
                }
                rows={3}
                placeholder="Explain why this service request is being cancelled..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCancelModal(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Go back
                </button>
                <button
                  type="button"
                  onClick={confirmCancel}
                  disabled={updatingStatus !== null}
                  className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  Confirm Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* end+ cancel reason modal */}
      </main>
    </div>
  );
};

export default AdminEventBookingDetailPage;
