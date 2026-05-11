import React from "react";
import { Alert, Input, Modal } from "antd";
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
import AdminSidebar from "../../../components/Layout/AdminSidebar";
import CustomMessage from "../../../components/common/CustomMessage";
import { ROUTES } from "../../../constants";
import { notFoundText } from "../../../constants/adminBookingDetail";
import { getStatusPillClass } from "../../../styles/adminBookingDetailStyles";
import {
  canForceCancel,
  getDateTimeText,
} from "../../../utils/adminBookingDetailUtils";
import { useAdminBookingDetail } from "../../../hooks/useAdminBookingDetail";

const AdminBookingDetailPage: React.FC = () => {
  const {
    navigate,
    mobileOpen,
    setMobileOpen,
    adminName,
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
    submitForceCancel,
  } = useAdminBookingDetail();

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
          <Modal
            title={
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600">
                  <ExclamationTriangleIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Force Cancel Booking
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    Cancel an active reservation and notify the user via email.
                  </p>
                </div>
              </div>
            }
            open={forceCancelModalOpen}
            onCancel={() => {
              if (!forceCancelLoading) {
                setForceCancelModalOpen(false);
              }
            }}
            footer={null}
            width={700}
            centered
            maskClosable={!forceCancelLoading}
            className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:border [&_.ant-modal-content]:border-slate-200 [&_.ant-modal-content]:p-0 [&_.ant-modal-header]:mb-0 [&_.ant-modal-header]:rounded-t-3xl [&_.ant-modal-header]:border-b [&_.ant-modal-header]:border-slate-200 [&_.ant-modal-header]:px-6 [&_.ant-modal-header]:py-5 [&_.ant-modal-body]:px-6 [&_.ant-modal-body]:pb-6 [&_.ant-modal-body]:pt-5 [&_.ant-modal-close]:right-5 [&_.ant-modal-close]:top-5 [&_.ant-modal-close]:text-slate-400"
          >
            <div className="space-y-5">
              <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  This action will force cancel the selected booking.
                </p>
                <p className="mt-1 text-sm text-red-700/90">
                  A notification email will be sent to the user with the
                  selected reason.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Reason
                  </label>
                  <Input.TextArea
                    value={forceCancelReason}
                    placeholder="Enter reason for force cancel (max 500 characters)"
                    autoSize={{ minRows: 4, maxRows: 6 }}
                    maxLength={500}
                    showCount
                    onChange={(event) =>
                      setForceCancelReason(event.target.value)
                    }
                    className="rounded-xl border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:ring-orange-100"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={() => setForceCancelModalOpen(false)}
                    disabled={forceCancelLoading}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitForceCancel}
                    disabled={forceCancelLoading}
                    className="h-10 min-w-44 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {forceCancelLoading
                      ? "Processing..."
                      : "Confirm Force Cancel"}
                  </button>
                </div>
              </div>
            </div>
          </Modal>
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

          {toastPopup && (
            <CustomMessage
              type={toastPopup.type}
              message={toastPopup.message}
              onClose={() => setToastPopup(null)}
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

                {(cancelReasonLabel !== notFoundText || cancelActorText) && (
                  <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                      Cancel Reason
                    </p>
                    <p className="mt-1 text-sm font-bold text-orange-800">
                      {cancelReasonLabel !== notFoundText
                        ? cancelReasonLabel
                        : "Not provided"}
                    </p>
                    {cancelActorText ? (
                      <p className="mt-1 text-xs font-medium text-orange-700">
                        By: {cancelActorText}
                      </p>
                    ) : null}
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
                {canForceCancel(mergedDetail.status as string) ? (
                  <button
                    type="button"
                    onClick={handleForceCancel}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    Force Cancel Booking
                  </button>
                ) : (
                  <p className="mt-3 text-xs font-medium text-orange-800/80">
                    Force cancel is available for Reserved or In Use bookings.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminBookingDetailPage;
