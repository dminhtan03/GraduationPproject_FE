import React from "react";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ServiceLine } from "../../types/adminEventBooking";
import ServiceStatusBadge from "./ServiceStatusBadge";

interface AdminServiceTableProps {
  lines: ServiceLine[];
  editable: boolean;
  emptyText: string;
  showDot?: boolean;
  updatingStatus?: string | null;
  onUpdateStatus?: (item: ServiceLine, newStatus: string) => void;
}

const AdminServiceTable: React.FC<AdminServiceTableProps> = ({
  lines,
  editable,
  emptyText,
  showDot = true,
  updatingStatus,
  onUpdateStatus,
}) => {
  const columns: ColumnsType<ServiceLine> = [
    {
      title: "Service",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 60,
      align: "center",
    },
    {
      title: "Note",
      dataIndex: "note",
      key: "note",
      render: (text: string | undefined) => text || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string | undefined) => (
        <ServiceStatusBadge status={status} showDot={showDot} />
      ),
    },
    ...(editable && onUpdateStatus
      ? [
          {
            title: "Update",
            key: "action",
            width: 220,
            align: "center" as const,
            render: (_: unknown, record: ServiceLine) => {
              const st = (record.status || "PENDING").toUpperCase();
              return (
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {st === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={updatingStatus === record.id}
                        onClick={() => onUpdateStatus(record, "CONFIRMED")}
                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={updatingStatus === record.id}
                        onClick={() => onUpdateStatus(record, "CANCELLED")}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        Cancelled
                      </button>
                    </>
                  )}
                  {st === "CONFIRMED" && (
                    <button
                      type="button"
                      disabled={updatingStatus === record.id}
                      onClick={() => onUpdateStatus(record, "IN_PROGRESS")}
                      className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
                    >
                      In Progress
                    </button>
                  )}
                  {st === "IN_PROGRESS" && (
                    <button
                      type="button"
                      disabled={updatingStatus === record.id}
                      onClick={() => onUpdateStatus(record, "DONE")}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Done
                    </button>
                  )}
                  {(st === "CONFIRMED" || st === "IN_PROGRESS") && (
                    <button
                      type="button"
                      disabled={updatingStatus === record.id}
                      onClick={() => onUpdateStatus(record, "CANCELLED")}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Cancelled
                    </button>
                  )}
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <Table<ServiceLine>
      rowKey={(record) => record.id}
      dataSource={lines}
      columns={columns}
      pagination={false}
      locale={{ emptyText }}
    />
  );
};

export default AdminServiceTable;
