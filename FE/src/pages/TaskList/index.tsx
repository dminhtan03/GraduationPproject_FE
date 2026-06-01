import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Tabs, Empty, Spin, Select, Modal, Input, DatePicker, Button, Tooltip, Dropdown, MenuProps } from "antd";
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  ViewColumnsIcon,
  InboxStackIcon,
  ChartBarIcon,
  ArrowRightIcon,
  CheckIcon,
  BoltIcon,
  TrashIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { taskService } from "../../services/taskService";
import { getProfile } from "../../services/authService";
import { userService } from "../../services/userService";
import { useTaskNotifications } from "../../hooks/useTaskNotifications";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import DatePickerField from "../../components/common/DatePickerField";
import AnimatedDropdown from "../../components/common/AnimatedDropdown";

ChartJS.register(ArcElement, ChartTooltip, Legend, CategoryScale, LinearScale, BarElement);

const PRIORITY_COLOR: Record<string, string> = { LOW: "default", MEDIUM: "blue", HIGH: "orange", URGENT: "red" };
const STATUS_COLOR: Record<string, string> = { TODO: "default", DOING: "processing", WAITING_REVIEW: "warning", DONE: "success", CANCELLED: "error", REWORK: "magenta" };

const fmt = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("vi-VN");
};

const getInitials = (name?: string) => {
  if (!name || name === "Unassigned") return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

type TabKey = "tasks" | "board" | "backlog" | "analytics";

const TaskListPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [tasks, setTasks] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState({ name: "", startDate: null as any, endDate: null as any });
  const [isEndingSprint, setIsEndingSprint] = useState(false);
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string | null>(null);

  // Backlog filters
  const [backlogAssigneeFilter, setBacklogAssigneeFilter] = useState("");
  const [backlogDateFrom, setBacklogDateFrom] = useState<any>(null);
  const [backlogDateTo, setBacklogDateTo] = useState<any>(null);
  
  // Review & Submit Modals
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedTaskForAction, setSelectedTaskForAction] = useState<any>(null);
  const [resultNote, setResultNote] = useState("");
  const [reviewComment, setReviewComment] = useState("");

  // Workplace API state
  const [workplaceItems, setWorkplaceItems] = useState<any[]>([]);
  const [workplaceLoading, setWorkplaceLoading] = useState(false);

  // Quick assign modal
  const [quickAssignModal, setQuickAssignModal] = useState(false);
  const [quickAssignTaskId, setQuickAssignTaskId] = useState<string | null>(null);
  const [quickAssignSearch, setQuickAssignSearch] = useState("");
  const [quickAssignResults, setQuickAssignResults] = useState<any[]>([]);

  // AI task highlight
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());

  // Delete confirm modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const workplaceSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const quickAssignSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tData, sData] = await Promise.all([
        taskService.listMyTasks(),
        taskService.listSprints()
      ]);
      setTasks(tData);
      setSprints(sData);
    } catch {
      show("error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkplaceItems = useCallback(async (search?: string, status?: string) => {
    setWorkplaceLoading(true);
    try {
      const data = await taskService.listMyTasks(undefined, search, status !== "ALL" ? status : undefined);
      setWorkplaceItems(data);
    } catch { /* silent */ }
    finally { setWorkplaceLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Load current user ID for role-based status menu
  useEffect(() => {
    userService.getMe().then(me => setUserId(me?.id ?? null)).catch(() => {});
  }, []);

  // Auto-reload khi có task notification
  useTaskNotifications(userId, () => { void loadData(); });

  // Debounced workplace API search/filter
  useEffect(() => {
    clearTimeout(workplaceSearchTimer.current);
    workplaceSearchTimer.current = setTimeout(() => {
      void loadWorkplaceItems(searchQuery, statusFilter);
    }, 300);
    return () => clearTimeout(workplaceSearchTimer.current);
  }, [searchQuery, statusFilter, loadWorkplaceItems]);

  // Read AI-created task IDs from localStorage and highlight them
  useEffect(() => {
    try {
      const stored = localStorage.getItem("new_tasks_from_ai");
      if (stored) {
        const ids: string[] = JSON.parse(stored);
        setNewTaskIds(new Set(ids));
        localStorage.removeItem("new_tasks_from_ai");
        setTimeout(() => setNewTaskIds(new Set()), 30000);
      }
    } catch { /* non-fatal */ }
  }, []);

  const activeSprint = useMemo(() => sprints.find(s => s.status === "ACTIVE"), [sprints]);
  const backlogTasks = useMemo(() => tasks.filter(t => !t.sprintId), [tasks]);

  const applyBacklogFilters = (taskList: any[]) => {
    return taskList.filter(t => {
      const assigneeName = t.assignments?.[0]?.assigneeName || "";
      const matchAssignee = !backlogAssigneeFilter || assigneeName.toLowerCase().includes(backlogAssigneeFilter.toLowerCase());
      const dueTs = t.dueAt ? new Date(t.dueAt).getTime() : null;
      const matchFrom = !backlogDateFrom || (dueTs && dueTs >= backlogDateFrom.startOf("day").valueOf());
      const matchTo = !backlogDateTo || (dueTs && dueTs <= backlogDateTo.endOf("day").valueOf());
      return matchAssignee && matchFrom && matchTo;
    });
  };

  const endOfDay = (dueAt: string) => {
    const d = new Date(dueAt);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };

  const isNearDeadline = (dueAt?: string) => {
    if (!dueAt) return false;
    const ms = endOfDay(dueAt) - Date.now();
    return ms > 0 && ms <= 3 * 24 * 60 * 60 * 1000;
  };

  const isOverdue = (dueAt?: string, status?: string) => {
    if (!dueAt || status === "DONE" || status === "CANCELLED") return false;
    return endOfDay(dueAt) < Date.now();
  };


  // Sprint Handlers
  const handleCreateSprint = async () => {
    if (!sprintForm.name) return show("error", "Sprint name is required");
    try {
      await taskService.createSprint({
        name: sprintForm.name,
        startDate: sprintForm.startDate ? dayjs(sprintForm.startDate).format("YYYY-MM-DD") : undefined,
        endDate: sprintForm.endDate ? dayjs(sprintForm.endDate).format("YYYY-MM-DD") : undefined,
      });
      show("success", "Sprint created");
      setIsSprintModalOpen(false);
      setSprintForm({ name: "", startDate: null, endDate: null });
      void loadData();
    } catch {
      show("error", "Failed to create sprint");
    }
  };

  const handleStartSprint = async (sprintId: string) => {
    try {
      if (activeSprint) {
        show("error", "Another sprint is already active. Complete it first.");
        return;
      }
      await taskService.updateSprint(sprintId, { status: "ACTIVE" });
      show("success", "Sprint started");
      void loadData();
    } catch {
      show("error", "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async () => {
    if (!activeSprint) return;
    try {
      await taskService.endSprint(activeSprint.id);
      show("success", "Sprint completed");
      setIsEndingSprint(false);
      void loadData();
    } catch {
      show("error", "Failed to complete sprint");
    }
  };

  const handleDeleteSprint = async (sprintId: string) => {
    if (!window.confirm("Are you sure you want to delete this sprint? Tasks will be moved to backlog.")) return;
    try {
      await taskService.deleteSprint(sprintId);
      show("success", "Sprint deleted");
      void loadData();
    } catch {
      show("error", "Failed to delete sprint");
    }
  };

  // Drag & Drop Handlers
  const onDragStart = (e: React.DragEvent, task: any) => {
    e.dataTransfer.setData("taskId", task.id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDropColumn = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    try {
      await taskService.changeStatus(taskId, targetStatus);
      show("success", "Task status updated");
      void loadData();
    } catch {
      show("error", "Failed to update status");
    }
  };

  const handleMoveToSprint = async (taskId: string, targetSprintId: string | null) => {
    try {
      await taskService.updateTask(taskId, { sprintId: targetSprintId });
      show("success", "Task moved successfully");
      void loadData();
    } catch {
      show("error", "Failed to move task");
    }
  };

  // Status & Role Handlers
  const getStatusMenuItems = (t: any): MenuProps['items'] => {
    const isAssignee = t.assignments?.some((a: any) => a.assigneeId === userId);
    const isReviewer = t.reviewerUserId === userId;
    const isTaskCreator = t.createdById === userId;
    
    // Check sprint creator
    const sprint = sprints.find(s => s.id === t.sprintId);
    const isSprintCreator = sprint && sprint.createdById === userId;

    const hasFullPower = isTaskCreator || isSprintCreator;

    const items: any[] = [];

    if (hasFullPower) {
      if (t.status !== "TODO") items.push({ key: "TODO", label: "TO DO" });
      if (t.status !== "DOING") items.push({ key: "DOING", label: "IN PROGRESS" });
      if (t.status !== "WAITING_REVIEW") items.push({ key: "WAITING_REVIEW", label: "IN REVIEW" });
      if (t.status !== "DONE") items.push({ key: "DONE", label: "DONE" });
      if (t.status !== "REWORK") items.push({ key: "REWORK", label: "REWORK" });
      if (t.status !== "CANCELLED") items.push({ key: "CANCELLED", label: "CANCELLED" });
    } else {
      if (t.status === "TODO" && isAssignee) {
        items.push({ key: "DOING", label: "START PROGRESS" });
      } else if (t.status === "DOING" && isAssignee) {
        items.push({ key: "TODO", label: "BACK TO TO DO" });
        if (t.reviewerUserId) {
          items.push({ key: "WAITING_REVIEW", label: "SUBMIT FOR REVIEW" });
        } else {
          items.push({ key: "DONE", label: "MARK AS DONE" });
        }
      } else if (t.status === "REWORK" && isAssignee) {
        if (t.reviewerUserId) {
          items.push({ key: "WAITING_REVIEW", label: "SUBMIT FOR REVIEW" });
        } else {
          items.push({ key: "DONE", label: "MARK AS DONE" });
        }
      } else if (t.status === "WAITING_REVIEW" && isReviewer) {
        items.push({ key: "OPEN_REVIEW_MODAL", label: "REVIEW TASK" });
      } else if (t.status === "DONE" && isReviewer) {
        items.push({ key: "WAITING_REVIEW", label: "REVERT TO REVIEW" });
      }
    }
    return items;
  };

  const handleStatusMenuClick = async (taskId: string, key: string, task: any) => {
    if (key === "WAITING_REVIEW" && (task.status === "DOING" || task.status === "REWORK")) {
      setSelectedTaskForAction(task);
      setResultNote("");
      setSubmitModalOpen(true);
    } else if (key === "OPEN_REVIEW_MODAL") {
      setSelectedTaskForAction(task);
      setReviewComment("");
      setReviewModalOpen(true);
    } else {
      try {
        await taskService.changeStatus(taskId, key);
        show("success", "Task status updated");
        void loadData();
      } catch {
        show("error", "Failed to update status");
      }
    }
  };

  // Action Submissions
  const handleSubmitTask = async () => {
    try {
      await taskService.submitForReview(selectedTaskForAction.id, resultNote);
      show("success", "Task submitted for review");
      setSubmitModalOpen(false);
      void loadData();
    } catch {
      show("error", "Failed to submit task");
    }
  };

  const handleReviewTask = async (decision: "APPROVED" | "REJECTED") => {
    try {
      await taskService.reviewTask(selectedTaskForAction.id, decision, reviewComment);
      show("success", `Task ${decision.toLowerCase()}`);
      setReviewModalOpen(false);
      void loadData();
    } catch {
      show("error", "Failed to review task");
    }
  };

  const handleDeleteTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTaskId(taskId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTaskId) return;
    try {
      await taskService.deleteTask(deleteTaskId);
      show("success", "Task deleted");
      setDeleteModalOpen(false);
      setDeleteTaskId(null);
      void loadData();
      void loadWorkplaceItems(searchQuery, statusFilter);
    } catch {
      show("error", "Failed to delete task");
      setDeleteModalOpen(false);
      setDeleteTaskId(null);
    }
  };

  const handleQuickAssignSearch = (val: string) => {
    setQuickAssignSearch(val);
    clearTimeout(quickAssignSearchTimer.current);
    if (!val.trim()) { setQuickAssignResults([]); return; }
    quickAssignSearchTimer.current = setTimeout(async () => {
      const r = await userService.searchUsers(val);
      setQuickAssignResults(r);
    }, 350);
  };

  const handleQuickAssign = (user: { id: string; fullName: string }) => {
    const taskId = quickAssignTaskId;
    if (!taskId) return;

    // Optimistic update — reflect immediately in UI
    const patchAssignment = (t: any) => t.id !== taskId ? t
      : { ...t, assignments: [{ assigneeId: user.id, assigneeName: user.fullName, status: "ACCEPTED" }] };
    setTasks(prev => prev.map(patchAssignment));
    setWorkplaceItems(prev => prev.map(patchAssignment));

    setQuickAssignModal(false);
    setQuickAssignTaskId(null);
    setQuickAssignSearch("");
    setQuickAssignResults([]);

    // Fire API in background — email sends on server side asynchronously
    taskService.assignTask(taskId, { assigneeId: user.id }).then(() => {
      void loadData();
      void loadWorkplaceItems(searchQuery, statusFilter);
    }).catch(() => {
      show("error", "Failed to assign task");
      void loadData();
      void loadWorkplaceItems(searchQuery, statusFilter);
    });
  };

  // Analytics Data
  const analyticsData = useMemo(() => {
    const statusCounts = { TODO: 0, DOING: 0, WAITING_REVIEW: 0, DONE: 0, CANCELLED: 0, REWORK: 0 };
    const priorityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    tasks.forEach(t => {
      if (t.status in statusCounts) statusCounts[t.status as keyof typeof statusCounts]++;
      if (t.priority in priorityCounts) priorityCounts[t.priority as keyof typeof priorityCounts]++;
    });

    const activeSprintTasks = activeSprint ? tasks.filter(t => t.sprintId === activeSprint.id) : [];
    const activeSprintCompleted = activeSprintTasks.filter(t => t.status === "DONE").length;
    
    return {
      statusData: {
        labels: ['To Do', 'Doing', 'Waiting Review', 'Done', 'Cancelled', 'Rework'],
        datasets: [{
          data: [statusCounts.TODO, statusCounts.DOING, statusCounts.WAITING_REVIEW, statusCounts.DONE, statusCounts.CANCELLED, statusCounts.REWORK],
          backgroundColor: ['#94a3b8', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#d946ef'],
          borderWidth: 0,
        }]
      },
      priorityData: {
        labels: ['Low', 'Medium', 'High', 'Urgent'],
        datasets: [{
          label: 'Tasks by Priority',
          data: [priorityCounts.LOW, priorityCounts.MEDIUM, priorityCounts.HIGH, priorityCounts.URGENT],
          backgroundColor: ['#cbd5e1', '#60a5fa', '#fb923c', '#f87171'],
          borderRadius: 4,
        }]
      },
      activeSprintTotal: activeSprintTasks.length,
      activeSprintCompleted,
      activeSprintRate: activeSprintTasks.length ? Math.round((activeSprintCompleted / activeSprintTasks.length) * 100) : 0
    };
  }, [tasks, activeSprint]);

  return (
    <div className="fade-in p-6 max-w-[1400px] mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Task Workspace</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Plan, track, and ship your next big thing.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsSprintModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition">
            <PlusIcon className="h-4 w-4 text-slate-500" />
            Create Sprint
          </button>
          <button type="button" onClick={() => navigate("/tasks/create")}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition">
            <PlusIcon className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Main Glassmorphic Navigation Tabs */}
      <div className="mb-6 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-wrap gap-1">
        <button type="button" onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === "tasks" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
          <ClipboardDocumentListIcon className="h-4 w-4" />
          Workplace List
        </button>
        <button type="button" onClick={() => setActiveTab("board")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === "board" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
          <ViewColumnsIcon className="h-4 w-4" />
          Sprint Kanban Board
          {activeSprint && <span className="ml-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full font-bold">Active</span>}
        </button>
        <button type="button" onClick={() => setActiveTab("backlog")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === "backlog" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
          <InboxStackIcon className="h-4 w-4" />
          Backlog Pool
          {backlogTasks.length > 0 && <span className="ml-1 px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded-full font-bold">{backlogTasks.length}</span>}
        </button>
        <button type="button" onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === "analytics" ? "bg-orange-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
          <ChartBarIcon className="h-4 w-4" />
          Analytics & Metrics
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-32"><Spin size="large" /></div>
      ) : (
        <>
          {/* TAB 1: Workplace List View */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 flex-1 max-w-2xl">
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-80 rounded-xl font-medium"
                    allowClear
                    prefix={<MagnifyingGlassIcon className="h-4 w-4 text-slate-400 mr-1 shrink-0" />}
                  />
                  <AnimatedDropdown
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="w-full sm:w-48"
                    options={[
                      { value: "ALL", label: "All Statuses" },
                      { value: "TODO", label: "To Do" },
                      { value: "DOING", label: "In Progress" },
                      { value: "WAITING_REVIEW", label: "Waiting Review" },
                      { value: "DONE", label: "Done" },
                      { value: "CANCELLED", label: "Cancelled" },
                      { value: "REWORK", label: "Rework" },
                    ]}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total:</span>
                  <span className="px-3 py-1 bg-orange-50 border border-orange-100 text-orange-600 text-sm font-bold rounded-xl shadow-sm">
                    {workplaceItems.length} tasks
                  </span>
                </div>
              </div>

              {workplaceLoading ? (
                <div className="flex justify-center py-16"><Spin /></div>
              ) : workplaceItems.length === 0 ? (
                <Empty className="py-20 bg-white rounded-3xl border border-slate-100 shadow-sm"
                  image={<ClipboardDocumentListIcon className="h-16 w-16 text-slate-200 mx-auto" />}
                  description="No tasks found." />
              ) : (
                <div className="grid gap-3.5">
                  {workplaceItems.map((task) => {
                    const near = isNearDeadline(task.dueAt);
                    const over = isOverdue(task.dueAt, task.status);
                    const isNew = newTaskIds.has(task.id);
                    return (
                      <div key={task.id} onClick={() => navigate(`/tasks/${task.id}`)}
                        className={`cursor-pointer rounded-2xl border p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
                          isNew ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-300/50"
                          : over ? "border-red-300 bg-red-50/60"
                          : near ? "border-orange-300 bg-orange-50/40"
                          : "border-slate-200/75 bg-white"
                        }`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1.5">
                            <p className="font-bold text-slate-900 text-base truncate">{task.title}</p>
                            <Tag color={PRIORITY_COLOR[task.priority]} className="m-0 text-xs font-bold px-2 py-0.5 border-0 rounded-md">{task.priority}</Tag>
                            {isNew && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full animate-pulse">NEW</span>}
                            {over && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">OVERDUE</span>}
                            {near && !over && <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">NEAR DEADLINE</span>}
                          </div>
                          {task.description && <p className="text-sm text-slate-500 line-clamp-1">{task.description}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
                            <span className={`flex items-center gap-1.5 ${over ? "text-red-600 font-bold" : near ? "text-orange-600 font-bold" : ""}`}>
                              <div className={`w-2 h-2 rounded-full ${over ? "bg-red-400" : near ? "bg-orange-400" : "bg-slate-300"}`} />
                              Due: <span>{fmt(task.dueAt)}</span>
                            </span>
                            {task.assignments?.[0] && <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-300" />Assignee: <span className="text-slate-700">{task.assignments[0].assigneeName}</span></span>}
                            {task.reviewerName && <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-300" />Reviewer: <span className="text-slate-700">{task.reviewerName}</span></span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Dropdown
                            menu={{ items: getStatusMenuItems(task), onClick: (e) => { e.domEvent.stopPropagation(); handleStatusMenuClick(task.id, e.key, task); } }}
                            trigger={['click']}
                            disabled={(getStatusMenuItems(task)?.length || 0) === 0}
                          >
                            <Tag color={STATUS_COLOR[task.status]} onClick={e => e.stopPropagation()}
                              className={`m-0 text-xs uppercase font-bold px-3 py-1.5 border-0 shadow-sm rounded-lg ${(getStatusMenuItems(task)?.length || 0) > 0 ? "cursor-pointer hover:opacity-80" : ""}`}>
                              {task.status?.replace(/_/g, " ")}
                            </Tag>
                          </Dropdown>
                          {task.createdById === userId && (
                            <button type="button" onClick={(e) => handleDeleteTask(task.id, e)}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Sprint Kanban Board */}
          {activeTab === "board" && (
            <div className="space-y-4">
              {activeSprint ? (
                <>
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold text-slate-900">{activeSprint.name}</h2>
                        <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 font-bold rounded-full border border-emerald-200">Active</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Timeline: <span className="font-semibold text-slate-600">{fmt(activeSprint.startDate)}</span> - <span className="font-semibold text-slate-600">{fmt(activeSprint.endDate)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-400">Sprint Progress</p>
                        <p className="text-sm font-bold text-slate-700">{analyticsData.activeSprintCompleted} / {analyticsData.activeSprintTotal} completed ({analyticsData.activeSprintRate}%)</p>
                      </div>
                      <button type="button" onClick={() => setIsEndingSprint(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition">
                        Complete Sprint
                      </button>
                    </div>
                  </div>

                  {/* Kanban Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                      { title: "To Do", status: "TODO", color: "border-t-4 border-t-slate-400 bg-slate-100/50" },
                      { title: "In Progress", status: "DOING", color: "border-t-4 border-t-blue-500 bg-blue-50/20" },
                      { title: "Currently Reviewing", status: "WAITING_REVIEW", color: "border-t-4 border-t-amber-500 bg-amber-50/20" },
                      { title: "Done", status: "DONE", color: "border-t-4 border-t-emerald-500 bg-emerald-50/20" }
                    ].map(col => {
                      const colTasks = tasks.filter(t => t.sprintId === activeSprint.id && t.status === col.status);
                      return (
                        <div key={col.status} onDragOver={onDragOver} onDrop={(e) => onDropColumn(e, col.status)}
                          className={`rounded-2xl p-4 border border-slate-200 min-h-[500px] flex flex-col gap-3 ${col.color}`}>
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
                            <span className="font-bold text-slate-700 text-sm">{col.title}</span>
                            <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded-full font-bold">{colTasks.length}</span>
                          </div>

                          <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1">
                            {colTasks.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl py-12 text-xs text-slate-400 text-center">
                                Drop tasks here
                              </div>
                            ) : (
                              colTasks.map(task => (
                                <div key={task.id} draggable onDragStart={(e) => onDragStart(e, task)}
                                  onClick={() => navigate(`/tasks/${task.id}`)}
                                  className="cursor-pointer bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-orange-200 transition duration-150 relative group">
                                  <p className="font-semibold text-slate-800 text-sm leading-snug truncate">{task.title}</p>
                                  {task.description && (
                                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
                                  )}
                                  
                                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px]">
                                    <span className="text-slate-400 font-medium">{task.assignments?.[0]?.assigneeName || "Unassigned"}</span>
                                    <Tag color={PRIORITY_COLOR[task.priority]} className="m-0 text-[9px] px-1">{task.priority}</Tag>
                                  </div>

                                  {/* Hover actions menu */}
                                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    {col.status === "TODO" && (
                                      <Tooltip title="Start Working">
                                        <button type="button" onClick={async (e) => {
                                          e.stopPropagation();
                                          await taskService.changeStatus(task.id, "DOING");
                                          show("success", "Moved to In Progress");
                                          void loadData();
                                        }} className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
                                          <ArrowRightIcon className="h-3 w-3" />
                                        </button>
                                      </Tooltip>
                                    )}
                                    {col.status === "DOING" && (
                                      <Tooltip title="Submit for Review">
                                        <button type="button" onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTaskForAction(task);
                                          setResultNote("");
                                          setSubmitModalOpen(true);
                                        }} className="p-1 bg-amber-500 text-white rounded hover:bg-amber-600 transition">
                                          <CheckIcon className="h-3 w-3" />
                                        </button>
                                      </Tooltip>
                                    )}
                                    {col.status === "WAITING_REVIEW" && (
                                      <Tooltip title="Review Approval">
                                        <button type="button" onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTaskForAction(task);
                                          setReviewComment("");
                                          setReviewModalOpen(true);
                                        }} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition">
                                          <BoltIcon className="h-3 w-3" />
                                        </button>
                                      </Tooltip>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Empty className="py-24 bg-white rounded-3xl border border-slate-100 shadow-sm"
                  image={<ClipboardDocumentListIcon className="h-16 w-16 text-slate-200 mx-auto" />}
                  description={
                    <div>
                      <p className="text-slate-500 font-medium">No Active Sprint found.</p>
                      <p className="text-slate-400 text-xs mt-1">Sprints are stages of development. Go to Backlog tab to create and start a Sprint.</p>
                    </div>
                  }
                />
              )}
            </div>
          )}

          {/* TAB 3: Jira-Style Backlog & Sprints Organizer */}
          {activeTab === "backlog" && (
            <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
              {/* Backlog Header + Filters */}
              {/* Backlog Header + Filters */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h3 className="font-bold text-slate-800 text-xl">Backlog Pool</h3>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 max-w-3xl lg:flex-1 lg:justify-end">
                  <div className="w-full sm:w-48">
                    <Input
                      placeholder="Filter by assignee..."
                      value={backlogAssigneeFilter}
                      onChange={e => setBacklogAssigneeFilter(e.target.value)}
                      allowClear
                      className="w-full rounded-xl"
                      prefix={<MagnifyingGlassIcon className="h-4 w-4 text-slate-400 mr-1 shrink-0" />}
                    />
                  </div>
                  <div className="w-full sm:w-40 h-[38px]">
                    <DatePickerField
                      value={backlogDateFrom ? backlogDateFrom.format("YYYY-MM-DD") : ""}
                      onChange={(d) => setBacklogDateFrom(d ? dayjs(d) : null)}
                      placeholder="From date"
                    />
                  </div>
                  <div className="w-full sm:w-40 h-[38px]">
                    <DatePickerField
                      value={backlogDateTo ? backlogDateTo.format("YYYY-MM-DD") : ""}
                      onChange={(d) => setBacklogDateTo(d ? dayjs(d) : null)}
                      placeholder="To date"
                    />
                  </div>
                  {(backlogAssigneeFilter || backlogDateFrom || backlogDateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setBacklogAssigneeFilter("");
                        setBacklogDateFrom(null);
                        setBacklogDateTo(null);
                      }}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 hover:underline px-2.5 py-1.5 bg-red-50 rounded-lg self-end sm:self-center transition"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* Sprints List */}
              <div className="space-y-8">
                {sprints.map(sprint => {
                  const sprintTasks = applyBacklogFilters(tasks.filter(t => t.sprintId === sprint.id));
                  const isCollapsed = collapsedSprints[sprint.id];
                  
                  // Task counts
                  const todoCount = sprintTasks.filter(t => t.status === "TODO").length;
                  const doingCount = sprintTasks.filter(t => t.status === "DOING" || t.status === "WAITING_REVIEW").length;
                  const doneCount = sprintTasks.filter(t => t.status === "DONE").length;

                  return (
                    <div key={sprint.id} className="bg-white rounded border border-slate-200"
                         onDragOver={onDragOver}
                         onDrop={async (e) => {
                           e.preventDefault();
                           const taskId = e.dataTransfer.getData("taskId");
                           if (taskId) await handleMoveToSprint(taskId, sprint.id);
                         }}>
                      
                      {/* Jira-style Sprint Header */}
                      <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-200 flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setCollapsedSprints(prev => ({ ...prev, [sprint.id]: !prev[sprint.id] }))} className="text-slate-500 hover:bg-slate-200 rounded p-0.5 transition">
                            {isCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                          </button>
                          <h4 className="font-semibold text-slate-800 text-sm">{sprint.name}</h4>
                          <span className="text-xs text-slate-500 font-medium ml-2">({sprintTasks.length} work items)</span>
                          
                          {sprint.status === "ACTIVE" && <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 uppercase font-bold rounded">Active</span>}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold">
                            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{todoCount}</span>
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{doingCount}</span>
                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">{doneCount}</span>
                          </div>
                          
                          {sprint.status === "PLANNED" && (
                            <button onClick={() => handleStartSprint(sprint.id)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded transition">Start sprint</button>
                          )}
                          {sprint.status === "ACTIVE" && (
                            <button onClick={() => setIsEndingSprint(true)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded transition">Complete sprint</button>
                          )}
                          <button onClick={() => handleDeleteSprint(sprint.id)} className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded transition opacity-0 group-hover:opacity-100"><TrashIcon className="h-4 w-4" /></button>
                        </div>
                      </div>

                      {/* Jira-style Task List */}
                      {!isCollapsed && (
                        <div className="min-h-[40px] flex flex-col bg-white">
                          {sprintTasks.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg m-2 bg-slate-50/50">
                              Plan a sprint by dragging issues here
                            </div>
                          ) : (
                            sprintTasks.map(t => {
                              const isDone = t.status === "DONE";
                              const assigneeName = t.assignments?.[0]?.assigneeName || "Unassigned";
                              const isNew = newTaskIds.has(t.id);

                              return (
                                <div key={t.id} draggable onDragStart={(e) => onDragStart(e, t)}
                                  className={`flex items-center justify-between gap-3 py-2 px-4 border-b border-slate-100 hover:bg-slate-50 cursor-grab active:cursor-grabbing group ${isNew ? "bg-emerald-50/60" : "bg-white"}`}>
                                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                                    {/* Issue Type Icon */}
                                    <div className="w-4 h-4 rounded-sm bg-blue-500 flex items-center justify-center shrink-0">
                                      <CheckIcon className="w-3 h-3 text-white font-bold" />
                                    </div>

                                    <span className={`text-[11px] font-medium shrink-0 ${isDone ? 'line-through text-slate-400' : 'text-slate-500'}`}>TSK-{t.id.toString().slice(-4).toUpperCase()}</span>
                                    {isNew && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded-full shrink-0">NEW</span>}
                                    <span className={`text-[13px] truncate hover:underline cursor-pointer ${isDone ? 'line-through text-slate-500' : 'text-slate-800'}`} onClick={() => navigate(`/tasks/${t.id}`)}>
                                      {t.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-4 shrink-0">
                                    <Dropdown menu={{ items: getStatusMenuItems(t), onClick: (e) => { e.domEvent.stopPropagation(); handleStatusMenuClick(t.id, e.key, t); } }} trigger={['click']} disabled={(getStatusMenuItems(t)?.length || 0) === 0}>
                                      <div className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer uppercase border ${
                                        isDone ? 'bg-green-50 text-green-700 border-green-200' :
                                        t.status === 'DOING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                      }`}>
                                        {t.status.replace(/_/g, " ")}
                                        <ChevronDownIcon className="w-2.5 h-2.5 inline-block ml-1 mb-0.5" />
                                      </div>
                                    </Dropdown>

                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium w-20">
                                      {t.dueAt ? (
                                        <>
                                          <CalendarIcon className="w-3.5 h-3.5" />
                                          <span>{dayjs(t.dueAt).format("MMM D")}</span>
                                        </>
                                      ) : <span>-</span>}
                                    </div>

                                    {/* Priority Icon */}
                                    <div className={`w-4 h-4 rounded flex items-center justify-center ${t.priority === 'URGENT' ? 'text-red-500' : t.priority === 'HIGH' ? 'text-orange-500' : 'text-slate-400'}`}>
                                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L14 14H2L8 2Z" /></svg>
                                    </div>

                                    <Tooltip title={`${assigneeName} — click to assign`}>
                                      <div onClick={(e) => { e.stopPropagation(); setQuickAssignTaskId(t.id); setQuickAssignModal(true); setQuickAssignSearch(""); setQuickAssignResults([]); }}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm cursor-pointer hover:ring-2 hover:ring-orange-400 transition ${assigneeName === 'Unassigned' ? 'bg-slate-300' : 'bg-[#172b4d]'}`}>
                                        {getInitials(assigneeName)}
                                      </div>
                                    </Tooltip>

                                    {t.createdById === userId && (
                                      <button type="button" onClick={(e) => handleDeleteTask(t.id, e)}
                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100">
                                        <TrashIcon className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div className="px-4 py-2 text-xs text-slate-500 font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-2 transition"
                               onClick={() => navigate('/tasks/create')}>
                            <PlusIcon className="h-3.5 w-3.5 font-bold" /> Create issue
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unplanned Backlog */}
              <div className="mt-8 bg-white rounded border border-slate-200"
                   onDragOver={onDragOver}
                   onDrop={async (e) => {
                     e.preventDefault();
                     const taskId = e.dataTransfer.getData("taskId");
                     if (taskId) await handleMoveToSprint(taskId, "backlog");
                   }}>
                
                {/* Backlog Header */}
                <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-200 flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCollapsedSprints(prev => ({ ...prev, backlog: !prev.backlog }))} className="text-slate-500 hover:bg-slate-200 rounded p-0.5 transition">
                      {collapsedSprints.backlog ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    </button>
                    <h4 className="font-semibold text-slate-800 text-sm">Backlog</h4>
                    <span className="text-xs text-slate-500 font-medium ml-2">({backlogTasks.length} work items)</span>
                  </div>
                  <button onClick={() => setIsSprintModalOpen(true)} className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded transition">Create sprint</button>
                </div>

                {!collapsedSprints.backlog && (
                  <div className="min-h-[60px] flex flex-col bg-white">
                    {backlogTasks.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg m-4 bg-slate-50/50">
                        Your backlog is empty.
                      </div>
                    ) : (
                      applyBacklogFilters(backlogTasks).map(t => {
                        const isDone = t.status === "DONE";
                        const assigneeName = t.assignments?.[0]?.assigneeName || "Unassigned";
                        const isNew = newTaskIds.has(t.id);

                        return (
                          <div key={t.id} draggable onDragStart={(e) => onDragStart(e, t)}
                            className={`flex items-center justify-between gap-3 py-2 px-4 border-b border-slate-100 hover:bg-slate-50 cursor-grab active:cursor-grabbing group ${isNew ? "bg-emerald-50/60" : "bg-white"}`}>
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                              <div className="w-4 h-4 rounded-sm bg-blue-500 flex items-center justify-center shrink-0">
                                <CheckIcon className="w-3 h-3 text-white font-bold" />
                              </div>
                              <span className={`text-[11px] font-medium shrink-0 ${isDone ? 'line-through text-slate-400' : 'text-slate-500'}`}>TSK-{t.id.toString().slice(-4).toUpperCase()}</span>
                              {isNew && <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded-full shrink-0">NEW</span>}
                              <span className={`text-[13px] truncate hover:underline cursor-pointer ${isDone ? 'line-through text-slate-500' : 'text-slate-800'}`} onClick={() => navigate(`/tasks/${t.id}`)}>{t.title}</span>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              <Dropdown menu={{ items: getStatusMenuItems(t), onClick: (e) => { e.domEvent.stopPropagation(); handleStatusMenuClick(t.id, e.key, t); } }} trigger={['click']} disabled={(getStatusMenuItems(t)?.length || 0) === 0}>
                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer uppercase border ${
                                  isDone ? 'bg-green-50 text-green-700 border-green-200' :
                                  t.status === 'DOING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}>
                                  {t.status.replace(/_/g, " ")}
                                  <ChevronDownIcon className="w-2.5 h-2.5 inline-block ml-1 mb-0.5" />
                                </div>
                              </Dropdown>

                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium w-20">
                                {t.dueAt ? (
                                  <>
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span>{dayjs(t.dueAt).format("MMM D")}</span>
                                  </>
                                ) : <span>-</span>}
                              </div>
                              
                              <div className={`w-4 h-4 rounded flex items-center justify-center ${t.priority === 'URGENT' ? 'text-red-500' : t.priority === 'HIGH' ? 'text-orange-500' : 'text-slate-400'}`}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L14 14H2L8 2Z" /></svg>
                              </div>

                              <Tooltip title={`${assigneeName} — click to assign`}>
                                <div onClick={(e) => { e.stopPropagation(); setQuickAssignTaskId(t.id); setQuickAssignModal(true); setQuickAssignSearch(""); setQuickAssignResults([]); }}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm cursor-pointer hover:ring-2 hover:ring-orange-400 transition ${assigneeName === 'Unassigned' ? 'bg-slate-300' : 'bg-[#172b4d]'}`}>
                                  {getInitials(assigneeName)}
                                </div>
                              </Tooltip>

                              {t.createdById === userId && (
                                <button type="button" onClick={(e) => handleDeleteTask(t.id, e)}
                                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition opacity-0 group-hover:opacity-100">
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div className="px-4 py-2 text-xs text-slate-500 font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-2 transition"
                         onClick={() => navigate('/tasks/create')}>
                      <PlusIcon className="h-3.5 w-3.5 font-bold" /> Create issue
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Analytics */}
          {activeTab === "analytics" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto pb-12">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
                <h3 className="text-base font-bold text-slate-800 mb-6">Task Status Distribution</h3>
                <div className="h-64 flex justify-center">
                  <Doughnut data={analyticsData.statusData} options={{ maintainAspectRatio: false, cutout: '75%' }} />
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80">
                <h3 className="text-base font-bold text-slate-800 mb-6">Task Priority Levels</h3>
                <div className="h-64 flex justify-center">
                  <Bar data={analyticsData.priorityData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-orange-50 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-orange-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Create Sprint</span>
          </div>
        }
        open={isSprintModalOpen}
        onCancel={() => setIsSprintModalOpen(false)}
        onOk={handleCreateSprint}
        okText="Create Sprint"
        cancelText="Cancel"
        className="rounded-2xl [&>.ant-modal-content]:!rounded-2xl"
        okButtonProps={{ className: "!bg-orange-500 hover:!bg-orange-600 !border-none rounded-xl h-10 px-5 text-sm font-semibold text-white" }}
        cancelButtonProps={{ className: "rounded-xl h-10 px-5 text-sm font-semibold border-slate-200" }}
      >
        <div className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sprint Name</label>
            <Input
              placeholder="e.g. Sprint 1, Q3 Planning..."
              value={sprintForm.name}
              onChange={e => setSprintForm({ ...sprintForm, name: e.target.value })}
              className="rounded-xl h-[38px] border-slate-200 hover:border-orange-400 focus:border-orange-400 transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <DatePickerField
                label="Start Date"
                value={sprintForm.startDate ? dayjs(sprintForm.startDate).format("YYYY-MM-DD") : ""}
                onChange={dStr => setSprintForm({ ...sprintForm, startDate: dStr ? dayjs(dStr).toDate() : null })}
              />
            </div>
            <div>
              <DatePickerField
                label="End Date"
                value={sprintForm.endDate ? dayjs(sprintForm.endDate).format("YYYY-MM-DD") : ""}
                onChange={dStr => setSprintForm({ ...sprintForm, endDate: dStr ? dayjs(dStr).toDate() : null })}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal title="Complete Sprint" open={isEndingSprint} onCancel={() => setIsEndingSprint(false)} onOk={handleCompleteSprint} okText="Complete Sprint" okButtonProps={{ danger: true }}>
        <p className="text-slate-600 mt-2">Are you sure you want to complete this sprint? All unresolved tasks will be automatically moved to the Backlog pool.</p>
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-sm font-bold text-slate-800">Sprint Summary</p>
          <div className="flex gap-4 mt-2">
            <div className="flex-1 text-center p-2 bg-white rounded-md border border-slate-100">
              <span className="block text-xl font-bold text-emerald-500">{analyticsData.activeSprintCompleted}</span>
              <span className="text-xs text-slate-500">Completed</span>
            </div>
            <div className="flex-1 text-center p-2 bg-white rounded-md border border-slate-100">
              <span className="block text-xl font-bold text-amber-500">{analyticsData.activeSprintTotal - analyticsData.activeSprintCompleted}</span>
              <span className="text-xs text-slate-500">Incomplete</span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-orange-50 rounded-lg">
              <BoltIcon className="h-5 w-5 text-orange-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Submit for Review</span>
          </div>
        }
        open={submitModalOpen}
        onCancel={() => setSubmitModalOpen(false)}
        onOk={handleSubmitTask}
        okText="Submit for Review"
        cancelText="Cancel"
        className="rounded-2xl overflow-hidden [&>.ant-modal-content]:!rounded-2xl"
        okButtonProps={{ className: "bg-orange-500 hover:bg-orange-600 border-none rounded-xl h-10 px-5 text-sm font-semibold" }}
        cancelButtonProps={{ className: "rounded-xl h-10 px-5 text-sm font-semibold border-slate-200" }}
      >
        <div className="space-y-3.5 pt-3">
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Provide any result notes, links to pull requests, or key deliverables for the reviewer.
          </p>
          <Input.TextArea
            rows={4}
            placeholder="e.g. Completed page styling. PR link: github.com/..."
            value={resultNote}
            onChange={e => setResultNote(e.target.value)}
            className="rounded-xl border-slate-200 hover:border-orange-400 focus:border-orange-400 transition"
          />
        </div>
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-emerald-50 rounded-lg">
              <CheckIcon className="h-5 w-5 text-emerald-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Review Task Completion</span>
          </div>
        }
        open={reviewModalOpen}
        onCancel={() => setReviewModalOpen(false)}
        footer={null}
        className="rounded-2xl overflow-hidden [&>.ant-modal-content]:!rounded-2xl"
      >
        <div className="space-y-4 pt-3">
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Please evaluate the submitted deliverables. You can either approve and complete the task or request a rework with comments.
          </p>
          <Input.TextArea
            rows={3}
            placeholder="Add a review comment (optional)..."
            value={reviewComment}
            onChange={e => setReviewComment(e.target.value)}
            className="rounded-xl border-slate-200 hover:border-orange-400 focus:border-orange-400 transition"
          />
          <div className="flex items-center gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleReviewTask("REJECTED")}
              className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition"
            >
              Request Rework
            </button>
            <button
              type="button"
              onClick={() => handleReviewTask("APPROVED")}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition"
            >
              Approve & Complete
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Assign Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-orange-50 rounded-lg">
              <PlusIcon className="h-5 w-5 text-orange-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Assign Task</span>
          </div>
        }
        open={quickAssignModal}
        onCancel={() => { setQuickAssignModal(false); setQuickAssignTaskId(null); setQuickAssignSearch(""); setQuickAssignResults([]); }}
        footer={null}
        className="rounded-2xl overflow-hidden [&>.ant-modal-content]:!rounded-2xl"
      >
        <div className="space-y-4 pt-3">
          <Input
            placeholder="Search user by name or email..."
            value={quickAssignSearch}
            onChange={(e) => handleQuickAssignSearch(e.target.value)}
            className="w-full rounded-xl h-[42px] border-slate-200 hover:border-orange-400 focus:border-orange-400 transition"
            prefix={<MagnifyingGlassIcon className="h-4 w-4 text-slate-400 mr-1.5 shrink-0" />}
            autoFocus
          />
          {quickAssignResults.length > 0 && (
            <div className="border border-slate-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-sm bg-slate-50/50">
              {quickAssignResults.map((u) => {
                const initials = getInitials(u.fullName);
                return (
                  <div key={u.id} onClick={() => handleQuickAssign(u)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-orange-50/60 cursor-pointer border-b border-slate-100/70 last:border-0 transition duration-150">
                    <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 leading-tight m-0">{u.fullName}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{u.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {quickAssignSearch && quickAssignResults.length === 0 && (
            <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-sm font-semibold text-slate-400">No users found</p>
              <p className="text-xs text-slate-400/80 mt-1">Try another search term</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title="Delete Task"
        open={deleteModalOpen}
        onCancel={() => { setDeleteModalOpen(false); setDeleteTaskId(null); }}
        onOk={confirmDelete}
        okText="Delete"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
      >
        <p className="text-slate-600 mt-2">Are you sure you want to delete this task? This action cannot be undone.</p>
      </Modal>

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TaskListPage;
