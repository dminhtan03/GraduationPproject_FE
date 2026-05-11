import React from "react";
import { Table, Space, Tooltip, Input, Select, Modal } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Bars3Icon,
  EyeIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { ClockIcon } from "@heroicons/react/24/solid";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import CustomMessage from "../../components/common/CustomMessage";
import { CustomPagination } from "../../components/common";
import DatePickerField from "../../components/common/DatePickerField";
import TimeSelectField from "../../components/common/TimeSelectField";
import { EventRow } from "../../types/adminEventBookingList";
import { canForceCancel } from "../../utils/adminBookingDetailUtils";
import { useAdminEventBookingList } from "../../hooks/useAdminEventBookingList";

const AdminEventBookingListPage: React.FC = () => {
  const {
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
    handleLogout,
  } = useAdminEventBookingList();

  const columns: ColumnsType<EventRow> = [
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      render: (text) => (
        <div className="inline-block rounded-lg bg-orange-50 px-3 py-1.5">
          <span className="font-semibold text-orange-700">{text}</span>
        </div>
      ),
    },
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {record.userName}
          </div>
          <div className="text-xs text-slate-500">{record.userEmail}</div>
        </div>
      ),
    },
    {
      title: "Room",
      key: "room",
      render: (_, record) => (
        <div className="inline-block rounded-lg bg-slate-100 px-3 py-1.5">
          <span className="text-sm font-semibold text-slate-900">
            {record.roomCode || record.roomName || "N/A"}
          </span>
        </div>
      ),
    },
    {
      title: "Time",
      key: "time",
      render: (_, record) => {
        try {
          const start = new Date(record.startTime);
          const end = new Date(record.endTime);

          const startDateStr = start.toLocaleDateString("vi-VN");
          const startTimeStr = start.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          const endTimeStr = end.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          return (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500">
                {startDateStr}
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 shadow-sm">
                <ClockIcon className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold text-orange-700">
                  {startTimeStr} - {endTimeStr}
                </span>
              </div>
            </div>
          );
        } catch {
          return <span className="text-sm text-slate-500">Invalid time</span>;
        }
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string | undefined) => {
        const normalized = String(status || "").toUpperCase();
        const showAdminNote = normalized === "FORCE_CANCELLED";
        const label =
          normalized === "IN_USE" || normalized === "CHECKED_IN"
            ? "On-going"
            : normalized === "FORCE_CANCELLED"
              ? "Force Cancelled (Admin)"
              : normalized === "APPROVED" || normalized === "RESERVED"
                ? "In-coming"
                : normalized === "COMPLETED"
                  ? "Completed"
                  : normalized === "CANCELLED" || normalized === "NO_SHOW"
                    ? "Cancelled"
                    : normalized === "PENDING"
                      ? "Pending"
                      : status || "—";
        const cls =
          normalized === "IN_USE" || normalized === "CHECKED_IN"
            ? "bg-emerald-50 text-emerald-700"
            : normalized === "APPROVED" || normalized === "RESERVED"
              ? "bg-blue-50 text-blue-700"
              : normalized === "COMPLETED"
                ? "bg-slate-100 text-slate-700"
                : normalized === "CANCELLED" ||
                    normalized === "NO_SHOW" ||
                    normalized === "FORCE_CANCELLED"
                  ? "bg-red-50 text-red-600"
                  : normalized === "PENDING"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-500";
        return (
          <div className="flex flex-col items-start gap-1">
            <span
              className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
            >
              {label}
            </span>
            {showAdminNote && (
              <span className="text-[11px] font-semibold text-slate-500">
                By admin
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="View booking detail">
            <button
              type="button"
              onClick={() =>
                navigate(`/admin/event-bookings/${record.reservationId}`)
              }
              className="group inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-100 hover:shadow"
            >
              <EyeIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110" />
              View
            </button>
          </Tooltip>
          {canForceCancel(record.status) && Boolean(record.reservationId) && (
            <Tooltip title="Force cancel booking">
              <button
                type="button"
                onClick={() => handleForceCancel(record)}
                disabled={forceCancelLoadingId === record.reservationId}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-100 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forceCancelLoadingId === record.reservationId
                  ? "Cancelling..."
                  : "Force Cancel"}
              </button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="flex-1 lg:pl-72">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
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
                    Cancel an active event reservation and notify the user.
                  </p>
                </div>
              </div>
            }
            open={forceCancelModalOpen}
            onCancel={() => {
              if (!forceCancelLoadingId) {
                setForceCancelModalOpen(false);
              }
            }}
            footer={null}
            width={700}
            centered
            maskClosable={!forceCancelLoadingId}
            className="[&_.ant-modal-content]:rounded-3xl [&_.ant-modal-content]:border [&_.ant-modal-content]:border-slate-200 [&_.ant-modal-content]:p-0 [&_.ant-modal-header]:mb-0 [&_.ant-modal-header]:rounded-t-3xl [&_.ant-modal-header]:border-b [&_.ant-modal-header]:border-slate-200 [&_.ant-modal-header]:px-6 [&_.ant-modal-header]:py-5 [&_.ant-modal-body]:px-6 [&_.ant-modal-body]:pb-6 [&_.ant-modal-body]:pt-5 [&_.ant-modal-close]:right-5 [&_.ant-modal-close]:top-5 [&_.ant-modal-close]:text-slate-400"
          >
            <div className="space-y-5">
              <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  This action will force cancel the selected event booking.
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
                    disabled={!!forceCancelLoadingId}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitForceCancel}
                    disabled={!!forceCancelLoadingId}
                    className="h-10 min-w-44 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {forceCancelLoadingId
                      ? "Processing..."
                      : "Confirm Force Cancel"}
                  </button>
                </div>
              </div>
            </div>
          </Modal>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open admin sidebar"
                >
                  <Bars3Icon className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-bold text-slate-900">
                  Event Booking Management
                </h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                View and manage all event-related room bookings.
              </p>
            </div>
          </div>

          {toastPopup && (
            <CustomMessage
              type={toastPopup.type}
              message={toastPopup.message}
              onClose={() => setToastPopup(null)}
            />
          )}

          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
              <div>
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Start time
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-2">
                  <DatePickerField
                    value={startDate}
                    onChange={(nextDate) => {
                      setStartDate(nextDate);
                      if (endDate && nextDate > endDate) {
                        setEndDate(nextDate);
                      }
                    }}
                  />
                  <TimeSelectField
                    value={startClock}
                    onChange={setStartClock}
                    minuteStep={10}
                  />
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  End time
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-2">
                  <DatePickerField
                    value={endDate}
                    minDate={startDate}
                    onChange={setEndDate}
                  />
                  <TimeSelectField
                    value={endClock}
                    onChange={setEndClock}
                    minuteStep={10}
                  />
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Status
                </div>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  className="w-full [&_.ant-select-selector]:!h-11 [&_.ant-select-selector]:!rounded-xl [&_.ant-select-selector]:!border-slate-200 [&_.ant-select-selector]:!bg-slate-50 [&_.ant-select-selector]:!px-3 [&_.ant-select-selector]:!text-slate-700 [&_.ant-select-selector]:hover:!border-slate-300"
                  options={[
                    { label: "All", value: "All" },
                    { label: "Reserved", value: "RESERVED" },
                    { label: "In Use", value: "IN_USE" },
                    { label: "Completed", value: "COMPLETED" },
                    { label: "Cancelled", value: "CANCELLED" },
                    { label: "Force Cancelled", value: "FORCE_CANCELLED" },
                    { label: "No Show", value: "NO_SHOW" },
                    { label: "Failed", value: "FAILED" },
                  ]}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-4">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Event Title
                </div>
                <Input
                  value={titleFilter}
                  onChange={(event) => setTitleFilter(event.target.value)}
                  placeholder="Search title..."
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 transition-all duration-300 hover:border-slate-300 focus:border-slate-400 focus:ring-slate-200"
                />
              </div>
              <div className="md:col-span-4">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  Room
                </div>
                <Input
                  value={roomFilter}
                  onChange={(event) => setRoomFilter(event.target.value)}
                  placeholder="Search room..."
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 transition-all duration-300 hover:border-slate-300 focus:border-slate-400 focus:ring-slate-200"
                />
              </div>
              <div className="md:col-span-4">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500 mb-1">
                  User Email
                </div>
                <Input
                  value={emailFilter}
                  onChange={(event) => setEmailFilter(event.target.value)}
                  placeholder="Search email..."
                  className="h-11 rounded-xl border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 transition-all duration-300 hover:border-slate-300 focus:border-slate-400 focus:ring-slate-200"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="h-10 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-600"
              >
                Apply Filters
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Table
              columns={columns}
              dataSource={pagedEvents}
              rowKey="eventId"
              loading={loading}
              pagination={false}
              className="overflow-hidden"
            />
            {sortedEvents.length > 0 && totalPages > 1 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <CustomPagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(p) => setPage(p)}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminEventBookingListPage;
