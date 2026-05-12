import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Tabs, Empty, Spin, Select } from "antd";
import { PlusIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { taskService } from "../../services/taskService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "default", MEDIUM: "blue", HIGH: "orange", URGENT: "red",
};
const STATUS_COLOR: Record<string, string> = {
  TODO: "default", DOING: "processing", WAITING_REVIEW: "warning",
  DONE: "success", CANCELLED: "error", REWORK: "magenta",
};

const fmt = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("vi-VN");
};

type TabKey = "my" | "assigned" | "pending" | "approvals" | "personal";

const TaskListPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("my");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (tab: TabKey) => {
    setLoading(true);
    setTasks([]);
    try {
      let data: any[] = [];
      if (tab === "assigned") data = await taskService.listAssignedToMe();
      else if (tab === "pending") data = await taskService.listPendingAssignments();
      else if (tab === "approvals") data = await taskService.listPendingApprovals();
      else if (tab === "personal") data = await taskService.listMyTasks("personal");
      else data = await taskService.listMyTasks();
      setTasks(data);
    } catch {
      show("error", "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(activeTab); }, [activeTab, load]);

  const filtered = useMemo(() =>
    statusFilter === "ALL" ? tasks : tasks.filter((t) => t.status === statusFilter),
    [tasks, statusFilter]);

  const tabItems = [
    { key: "my", label: "Tasks I Created" },
    { key: "assigned", label: "Assigned to Me" },
    { key: "pending", label: "Pending Invites" },
    { key: "approvals", label: "Pending Approvals" },
    { key: "personal", label: "Personal" },
  ];

  return (
    <div className="fade-in p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track your tasks</p>
        </div>
        <button type="button" onClick={() => navigate("/tasks/create")}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition">
          <PlusIcon className="h-4 w-4" />
          New Task
        </button>
      </div>

      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as TabKey)} items={tabItems} className="mb-4" />

      <div className="mb-4 flex items-center gap-3">
        <Select value={statusFilter} onChange={setStatusFilter} className="w-44"
          options={[
            { value: "ALL", label: "All Status" },
            { value: "TODO", label: "To Do" },
            { value: "DOING", label: "Doing" },
            { value: "WAITING_REVIEW", label: "Waiting Review" },
            { value: "DONE", label: "Done" },
            { value: "CANCELLED", label: "Cancelled" },
            { value: "REWORK", label: "Rework" },
          ]} />
        <span className="text-sm text-slate-500">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <Empty image={<ClipboardDocumentListIcon className="h-16 w-16 text-slate-200 mx-auto" />}
          description="No tasks found." />
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <div key={task.id} onClick={() => navigate(`/tasks/${task.id}`)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Tag color={PRIORITY_COLOR[task.priority] ?? "default"}>{task.priority}</Tag>
                  <Tag color={STATUS_COLOR[task.status] ?? "default"}>{task.status?.replace(/_/g, " ")}</Tag>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>Due: <span className="font-medium text-slate-600">{fmt(task.dueAt)}</span></span>
                {task.assignments?.length > 0 && (
                  <span>Assignee: <span className="font-medium text-slate-600">{task.assignments[0]?.assigneeName || "-"}</span></span>
                )}
                {task.reviewerName && (
                  <span>Reviewer: <span className="font-medium text-slate-600">{task.reviewerName}</span></span>
                )}
                <span>By: <span className="font-medium text-slate-600">{task.createdByName}</span></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TaskListPage;
