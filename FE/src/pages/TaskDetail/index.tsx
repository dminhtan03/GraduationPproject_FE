import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tag, Spin, Modal, Input, Select, Button, Tooltip, Upload } from "antd";
import DatePickerField from "../../components/common/DatePickerField";
import {
  ArrowLeftIcon,
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  ListBulletIcon,
  TrashIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import { taskService } from "../../services/taskService";
import { userService } from "../../services/userService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { useTaskNotifications } from "../../hooks/useTaskNotifications";
import dayjs from "dayjs";

const STATUS_COLOR: Record<string, string> = {
  TODO: "default", DOING: "processing", WAITING_REVIEW: "warning",
  DONE: "success", CANCELLED: "error", REWORK: "magenta",
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "default", MEDIUM: "blue", HIGH: "orange", URGENT: "red",
};

const fmt = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("vi-VN", { hour12: false });
};

const Section: React.FC<{ title: string; extra?: React.ReactNode; children: React.ReactNode }> = ({ title, extra, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {extra}
    </div>
    {children}
  </div>
);

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  
  // Basic states
  const [task, setTask] = useState<any>(null);
  const [me, setMe] = useState<{ id: string; fullName: string; email: string } | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  // Comments state
  const [commentText, setCommentText] = useState("");

  // Modals state
  const [submitModal, setSubmitModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [inviteReviewerModal, setInviteReviewerModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [editDueDate, setEditDueDate] = useState(false);
  const [editingSubtaskDueId, setEditingSubtaskDueId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Subtask modal state
  const [subtaskModal, setSubtaskModal] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskDesc, setSubtaskDesc] = useState("");
  const [subtaskPriority, setSubtaskPriority] = useState("MEDIUM");
  const [subtaskDueDate, setSubtaskDueDate] = useState<dayjs.Dayjs | null>(null);
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState("");

  // Form values
  const [resultNote, setResultNote] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewComment, setReviewComment] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // User search
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignBrief, setAssignBrief] = useState("");
  const [assignHow, setAssignHow] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllDetails = useCallback(async () => {
    if (!taskId) return;
    try {
      const [tData, meData, commentList, allUsers] = await Promise.all([
        taskService.getTask(taskId),
        userService.getMe(),
        taskService.getComments(taskId),
        userService.searchUsers("")
      ]);
      setTask(tData);
      setMe(meData);
      setComments(commentList);
      setUsers(allUsers);
    } catch {
      show("error", "Failed to load task details");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadAllDetails();
  }, [loadAllDetails]);

  // Real-time: reload khi có notification liên quan đến task này
  useTaskNotifications(me?.id, (n) => {
    if (n.content?.includes(task?.title ?? "___NEVER___")) {
      void loadAllDetails();
    }
    show("info" as MessageType, n.title + ": " + n.content);
  });

  const doAction = async (fn: () => Promise<any>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await loadAllDetails();
      show("success", successMsg);
    } catch (e: any) {
      show("error", e?.response?.data?.meta?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSearchUsers = (val: string) => {
    setUserSearch(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setUserResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const r = await userService.searchUsers(val);
      setUserResults(r);
    }, 350);
  };

  const handleAssign = () =>
    doAction(async () => {
      await taskService.assignTask(taskId!, { assigneeId: selectedUserId, brief: assignBrief, how: assignHow });
      setAssignModal(false); setSelectedUserId(""); setAssignBrief(""); setAssignHow("");
    }, "Task assigned");

  const handleInviteReviewer = () =>
    doAction(async () => {
      await taskService.inviteReviewer(taskId!, selectedUserId);
      setInviteReviewerModal(false); setSelectedUserId("");
    }, "Reviewer invited");

  const handleDueDateChange = (date: dayjs.Dayjs | null) => {
    if (!date) return;
    doAction(async () => {
      await taskService.updateTask(taskId!, { dueAt: date.format("YYYY-MM-DDTHH:mm:ss") });
      setEditDueDate(false);
    }, "Due date updated");
  };

  const handleSubtaskDueDateChange = (subtaskId: string, date: dayjs.Dayjs | null) => {
    setEditingSubtaskDueId(null);
    if (!date) return;
    doAction(() => taskService.updateTask(subtaskId, { dueAt: date.format("YYYY-MM-DDTHH:mm:ss") }), "Due date updated");
  };

  const handleDeleteTask = () => setDeleteConfirmOpen(true);

  const confirmDeleteTask = async () => {
    try {
      await taskService.deleteTask(taskId!);
      navigate("/tasks");
    } catch {
      show("error", "Failed to delete task");
      setDeleteConfirmOpen(false);
    }
  };

  const handleFileAttach = async (file: File) => {
    setUploadingFile(true);
    try {
      const res = await taskService.uploadFile(file);
      setAttachedFiles(prev => [...prev, res]);
    } catch { show("error", "Upload file thất bại"); }
    finally { setUploadingFile(false); }
    return false; // prevent antd auto-upload
  };

  const handleSubmit = () =>
    doAction(async () => {
      const fileLinks = attachedFiles.map(f => `📎 [${f.name}](${f.url})`).join("\n");
      const fullNote = resultNote + (fileLinks ? "\n\n" + fileLinks : "");
      await taskService.submitForReview(taskId!, fullNote);
      setSubmitModal(false); setResultNote(""); setAttachedFiles([]);
    }, "Submitted for review");

  const handleDeleteSubtask = async (e: React.MouseEvent, subtaskId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Xóa subtask này?")) return;
    setBusy(true);
    try {
      await taskService.cancelTask(subtaskId);
      show("success", "Đã xóa subtask");
      await loadAllDetails();
    } catch {
      show("error", "Không thể xóa subtask");
    } finally {
      setBusy(false);
    }
  };

  const handleSubtaskStatusChange = async (subtaskId: string, newStatus: string) => {
    try {
      await taskService.changeStatus(subtaskId, newStatus);
      show("success", "Cập nhật trạng thái thành công");
      void loadAllDetails();
    } catch { show("error", "Không thể đổi trạng thái"); }
  };

  const handleReview = () =>
    doAction(async () => {
      await taskService.reviewTask(taskId!, reviewDecision, reviewComment);
      setReviewModal(false); setReviewComment("");
    }, reviewDecision === "APPROVED" ? "Task approved" : "Sent back for rework");

  // Create Subtask
  const handleCreateSubtask = async () => {
    if (!subtaskTitle.trim()) {
      show("warning", "Please enter subtask title");
      return;
    }
    await doAction(async () => {
      await taskService.createTask({
        title: subtaskTitle,
        description: subtaskDesc,
        priority: subtaskPriority,
        dueAt: subtaskDueDate ? subtaskDueDate.format("YYYY-MM-DDTHH:mm:ss") : undefined,
        parentTaskId: taskId,
        sprintId: task.sprintId || "", // inherit sprint from parent
        assigneeId: subtaskAssigneeId || undefined
      });
      setSubtaskModal(false);
      setSubtaskTitle("");
      setSubtaskDesc("");
      setSubtaskPriority("MEDIUM");
      setSubtaskDueDate(null);
      setSubtaskAssigneeId("");
    }, "Subtask created successfully");
  };

  // Add Comment
  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await taskService.addComment(taskId!, commentText);
      setCommentText("");
      show("success", "Comment posted");
      const list = await taskService.getComments(taskId!);
      setComments(list);
    } catch {
      show("error", "Failed to post comment");
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await taskService.deleteComment(taskId!, commentId);
      show("success", "Comment deleted");
      const list = await taskService.getComments(taskId!);
      setComments(list);
    } catch {
      show("error", "Failed to delete comment");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spin size="large" /></div>;
  if (!task) return <div className="p-6 text-center text-slate-500">Task not found.</div>;

  const isCreator = me?.id === task.createdById;
  const isReviewer = me?.id === task.reviewerUserId;
  const myAssignment = task.assignments?.find((a: any) => a.assigneeId === me?.id);
  const mySupporter = task.supporters?.find((s: any) => s.userId === me?.id);
  const canSubmit = !!myAssignment && (task.status === "DOING" || task.status === "REWORK");
  const canReview = isReviewer && task.status === "WAITING_REVIEW"
    && task.reviewerStatus === "ACCEPTED";

  const userSelectOptions = userResults.map((u) => ({
    value: u.id,
    label: `${u.fullName} (${u.email})`,
  }));

  // Initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="fade-in p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/tasks")}
            className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition bg-white shadow-sm">
            <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
          </button>
          <div className="min-w-0">
            {task.parentTaskId && (
              <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-1 inline-block cursor-pointer hover:bg-slate-200"
                onClick={() => navigate(`/tasks/${task.parentTaskId}`)}>
                ← Subtask of: {task.parentTaskTitle}
              </span>
            )}
            <h1 className="text-xl font-bold text-slate-900 truncate leading-snug">{task.title}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Priority Badge */}
              <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold tracking-wider uppercase border shadow-sm transition duration-150 select-none ${
                task.priority === "URGENT" ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100/60" :
                task.priority === "HIGH" ? "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100/60" :
                task.priority === "MEDIUM" ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100/60" :
                "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}>
                {task.priority}
              </span>

              {/* Status Select or Badge */}
              {(isCreator || !!myAssignment) ? (
                <Select
                  size="middle"
                  value={task.status}
                  disabled={busy}
                  onChange={(v) => doAction(() => taskService.changeStatus(taskId!, v), "Status updated")}
                  className={`w-40 font-extrabold text-xs rounded-xl shadow-md transition [&>.ant-select-selector]:!rounded-xl [&>.ant-select-selector]:!border-none [&_.ant-select-selection-item]:!font-bold [&_.ant-select-selection-item]:!text-white [&_.ant-select-arrow]:!text-white ${
                    task.status === "DONE" ? "[&>.ant-select-selector]:!bg-emerald-600 hover:[&>.ant-select-selector]:!bg-emerald-700" :
                    task.status === "CANCELLED" ? "[&>.ant-select-selector]:!bg-red-600 hover:[&>.ant-select-selector]:!bg-red-700" :
                    task.status === "WAITING_REVIEW" ? "[&>.ant-select-selector]:!bg-amber-500 hover:[&>.ant-select-selector]:!bg-amber-600" :
                    task.status === "DOING" ? "[&>.ant-select-selector]:!bg-blue-600 hover:[&>.ant-select-selector]:!bg-blue-700" :
                    task.status === "REWORK" ? "[&>.ant-select-selector]:!bg-purple-600 hover:[&>.ant-select-selector]:!bg-purple-700" :
                    "[&>.ant-select-selector]:!bg-slate-500 hover:[&>.ant-select-selector]:!bg-slate-600"
                  }`}
                  optionLabelProp="label"
                >
                  {(isCreator
                    ? [
                        { value: "TODO", label: "TO DO", color: "bg-slate-500" },
                        { value: "DOING", label: "IN PROGRESS", color: "bg-blue-600" },
                        { value: "WAITING_REVIEW", label: "IN REVIEW", color: "bg-amber-500" },
                        { value: "DONE", label: "DONE", color: "bg-emerald-600" },
                        { value: "REWORK", label: "REWORK", color: "bg-purple-600" },
                        { value: "CANCELLED", label: "CANCELLED", color: "bg-red-600" },
                      ]
                    : [
                        { value: "TODO", label: "TO DO", color: "bg-slate-500" },
                        { value: "DOING", label: "IN PROGRESS", color: "bg-blue-600" },
                        ...(task.reviewerUserId
                          ? [{ value: "WAITING_REVIEW", label: "SUBMIT FOR REVIEW", color: "bg-amber-500" }]
                          : [{ value: "DONE", label: "MARK AS DONE", color: "bg-emerald-600" }]),
                      ]
                  ).map((opt) => (
                    <Select.Option key={opt.value} value={opt.value} label={opt.label}>
                      <div className="flex items-center gap-2 py-0.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${opt.color} shrink-0 shadow-sm`} />
                        <span className="text-xs font-bold text-slate-700">{opt.label}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                <span className={`inline-flex items-center px-3 py-1.5 text-xs font-extrabold text-white rounded-xl shadow-md select-none ${
                  task.status === "DONE" ? "bg-emerald-600" :
                  task.status === "CANCELLED" ? "bg-red-600" :
                  task.status === "WAITING_REVIEW" ? "bg-amber-500" :
                  task.status === "DOING" ? "bg-blue-600" :
                  task.status === "REWORK" ? "bg-purple-600" :
                  "bg-slate-500"
                }`}>
                  {task.status?.replace(/_/g, " ")}
                </span>
              )}

              {/* Sprint Badge */}
              {task.sprintName && (
                <span className="inline-flex items-center px-3 py-1 text-xs bg-gradient-to-r from-orange-50 to-amber-50/50 text-orange-600 rounded-xl border border-orange-100 font-bold shadow-sm select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5 animate-pulse" />
                  {task.sprintName}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          {canSubmit && (
            <button type="button" onClick={() => setSubmitModal(true)} disabled={busy}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition">
              Submit Work Results
            </button>
          )}
          {canReview && (
            <button type="button" onClick={() => setReviewModal(true)} disabled={busy}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition">
              Review Work
            </button>
          )}
          {isCreator && (
            <button type="button" onClick={handleDeleteTask} disabled={busy}
              className="rounded-xl border border-red-200 p-2 text-red-400 hover:bg-red-50 hover:text-red-600 transition">
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Task details and subtasks) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Details Section */}
          <Section title="Task Description">
            <div className="space-y-6">
              {/* Main Description */}
              {task.description ? (
                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50/30 p-4 rounded-xl border border-slate-100">
                  {task.description}
                </div>
              ) : (
                <div className="text-sm text-slate-400 italic bg-slate-50/30 p-4 rounded-xl border border-slate-100 border-dashed">
                  No description provided.
                </div>
              )}

              {/* Grid or stack for structured fields */}
              <div className="space-y-4">
                {task.goal && (
                  <div className="p-4 rounded-xl border border-slate-100 bg-amber-50/20 border-l-4 border-l-amber-500 transition duration-150 hover:shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircleIcon className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Target Goals</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed pl-6">{task.goal}</p>
                  </div>
                )}

                {task.expectedResult && (
                  <div className="p-4 rounded-xl border border-slate-100 bg-indigo-50/20 border-l-4 border-l-indigo-500 transition duration-150 hover:shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ListBulletIcon className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Expected Deliverables</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed pl-6">{task.expectedResult}</p>
                  </div>
                )}

                {task.assignmentBrief && (
                  <div className="p-4 rounded-xl border border-slate-100 bg-sky-50/20 border-l-4 border-l-sky-500 transition duration-150 hover:shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <UserIcon className="h-4.5 w-4.5 text-sky-500 shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assignment Brief</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed pl-6">{task.assignmentBrief}</p>
                  </div>
                )}

                {task.assignmentHow && (
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 border-l-4 border-l-slate-400 transition duration-150 hover:shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ChatBubbleLeftRightIcon className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Execution Guidelines (How-to)</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed pl-6">{task.assignmentHow}</p>
                  </div>
                )}

                {task.resultNote && (
                  <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 border-l-4 border-l-emerald-500 transition duration-150 hover:shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <CheckCircleIcon className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Deliverable Results Submitted</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed pl-6">{task.resultNote}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                {(isCreator || !!myAssignment) ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <CalendarIcon className="h-4 w-4 text-orange-400 shrink-0" />
                    {editDueDate ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-40 h-[38px]">
                          <DatePickerField
                            value={task.dueAt ? dayjs(task.dueAt).format("YYYY-MM-DD") : ""}
                            onChange={(dStr) => {
                              if (dStr) {
                                handleDueDateChange(dayjs(dStr));
                              }
                              setEditDueDate(false);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditDueDate(false)}
                          className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition h-[38px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-orange-500 transition"
                        onClick={() => setEditDueDate(true)}
                        title="Click to edit due date"
                      >
                        Deadline: <span className="font-semibold text-slate-800">{fmt(task.dueAt)}</span>
                        <span className="ml-1 text-orange-400">[edit]</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <InfoItem icon={<CalendarIcon className="h-4 w-4 text-orange-400" />}
                    label="Deadline" value={fmt(task.dueAt)} />
                )}
                <InfoItem icon={<UserIcon className="h-4 w-4 text-blue-400" />}
                  label="Creator" value={task.createdByName} />
                {task.submittedAt && (
                  <InfoItem icon={<CalendarIcon className="h-4 w-4 text-blue-400" />}
                    label="Submitted At" value={fmt(task.submittedAt)} />
                )}
                {task.reviewedAt && (
                  <InfoItem icon={<CalendarIcon className="h-4 w-4 text-emerald-400" />}
                    label="Reviewed At" value={fmt(task.reviewedAt)} />
                )}
              </div>
            </div>
          </Section>

          {/* Subtasks Section */}
          <Section title="Subtasks Breakdown"
            extra={
              task.status !== "DONE" && task.status !== "CANCELLED" && (
                <button type="button" onClick={() => setSubtaskModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 transition">
                  <PlusIcon className="h-3.5 w-3.5" /> Add Subtask
                </button>
              )
            }>
            <div className="space-y-2">
              {!task.subtasks || task.subtasks.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  No subtasks broken down yet. Break large tasks into subtasks to distribute work.
                </div>
              ) : (
                task.subtasks.map((sub: any) => {
                  const isSubCreator = me?.id === task.createdById;
                  const isSubAssignee = sub.assignments?.some((a: any) => a.assigneeId === me?.id && a.status === "ACCEPTED");
                  const canChangeSubStatus = isSubCreator || isSubAssignee;
                  return (
                    <div key={sub.id}
                      className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 hover:bg-white hover:border-orange-200 hover:shadow-sm transition flex justify-between items-center gap-3 group">
                      <div className="min-w-0 flex-1 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); navigate(`/tasks/${sub.id}`); }}>
                        <p className="font-semibold text-slate-800 text-sm leading-snug truncate">{sub.title}</p>
                        <div className="flex gap-2.5 items-center text-[10px] text-slate-400 mt-1" onClick={e => e.stopPropagation()}>
                          <span>Assignee: <span className="font-semibold text-slate-600">{sub.assignments?.[0]?.assigneeName || "Unassigned"}</span></span>
                          {canChangeSubStatus ? (
                            editingSubtaskDueId === sub.id ? (
                              <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                <div className="w-36 h-[34px]">
                                  <DatePickerField
                                    value={sub.dueAt ? dayjs(sub.dueAt).format("YYYY-MM-DD") : ""}
                                    onChange={(dStr) => {
                                      if (dStr) {
                                        handleSubtaskDueDateChange(sub.id, dayjs(dStr));
                                      }
                                      setEditingSubtaskDueId(null);
                                    }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setEditingSubtaskDueId(null)}
                                  className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition h-[34px] flex items-center"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span className="cursor-pointer hover:text-orange-500 transition"
                                onClick={() => setEditingSubtaskDueId(sub.id)}>
                                Due: <span className="font-semibold text-slate-600">{fmt(sub.dueAt)}</span>
                                <span className="ml-1 text-orange-400">[edit]</span>
                              </span>
                            )
                          ) : (
                            <span>Due: {fmt(sub.dueAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Tag color={PRIORITY_COLOR[sub.priority]} className="m-0 text-[9px]">{sub.priority}</Tag>
                        {canChangeSubStatus ? (
                          <Select
                            size="small"
                            value={sub.status}
                            onChange={(v) => handleSubtaskStatusChange(sub.id, v)}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[9px]"
                            style={{ width: 110 }}
                            options={[
                              { value: "TODO", label: "TO DO" },
                              { value: "DOING", label: "IN PROGRESS" },
                              { value: "WAITING_REVIEW", label: "IN REVIEW" },
                              { value: "DONE", label: "DONE" },
                              { value: "REWORK", label: "REWORK" },
                            ]}
                          />
                        ) : (
                          <Tag color={STATUS_COLOR[sub.status]} className="m-0 text-[9px]">{sub.status?.replace(/_/g, " ")}</Tag>
                        )}
                        {isSubCreator && (
                          <button type="button"
                            onClick={(e) => handleDeleteSubtask(e, sub.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition">
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Section>

          {/* Collaborative Discussions Section */}
          <Section title="Collaboration Discussion">
            <div className="space-y-6">
              {/* Comment Input Card */}
              <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-inner">
                    {getInitials(me?.fullName)}
                  </div>
                  <div className="flex-1">
                    <Input.TextArea
                      rows={3}
                      placeholder="Write a reply or collaborate with team members... Type @ to mention."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="rounded-xl border-slate-200 hover:border-orange-400 focus:border-orange-400 transition"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mention:</span>
                    <Select
                      placeholder="Select team member..."
                      size="middle"
                      className="w-48 [&>.ant-select-selector]:!rounded-xl [&>.ant-select-selector]:!border-slate-200 hover:[&>.ant-select-selector]:!border-orange-400 focus:[&>.ant-select-selector]:!border-orange-400"
                      onChange={(val) => setCommentText(prev => prev ? `${prev} @${val} ` : `@${val} `)}
                      value={undefined}
                      optionLabelProp="label"
                    >
                      {users.map(u => {
                        const initials = getInitials(u.fullName);
                        return (
                          <Select.Option key={u.id} value={u.fullName} label={u.fullName}>
                            <div className="flex items-center gap-2 py-0.5">
                              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-sm">
                                {initials}
                              </div>
                              <span className="text-sm font-medium text-slate-700">{u.fullName}</span>
                            </div>
                          </Select.Option>
                        );
                      })}
                    </Select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddComment}
                    className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:shadow transition duration-150 shrink-0"
                  >
                    <PaperAirplaneIcon className="h-3.5 w-3.5" />
                    Post Comment
                  </button>
                </div>
              </div>

              {/* Comments Feed */}
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin">
                {comments.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-sm font-semibold text-slate-400">No discussions yet</p>
                    <p className="text-xs text-slate-400/80 mt-1">Start the conversation by posting a comment above.</p>
                  </div>
                ) : (
                  comments.map(c => {
                    const initials = getInitials(c.authorName);
                    return (
                      <div key={c.id} className="flex gap-3 group">
                        <div className="w-9 h-9 rounded-full bg-[#172b4d] text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                          {initials}
                        </div>
                        <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-200 relative">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-bold text-slate-800 text-sm">{c.authorName}</span>
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{fmt(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap m-0 pr-6">{c.content}</p>
                          
                          {/* Delete comment */}
                          {me?.id === c.authorId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition duration-150"
                              title="Delete comment"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Section>
        </div>

        {/* Right Column (Reviewer and Assignees sidebar) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Reviewer Sidebar Box */}
          <Section title="Quality Reviewer">
            <div className="space-y-3">
              {task.reviewerUserId ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                      {getInitials(task.reviewerName)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm leading-normal">{task.reviewerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {task.reviewDecision ? (
                          <Badge value={task.reviewDecision} />
                        ) : (
                          <Badge value={task.reviewerStatus ?? ""} />
                        )}
                      </div>
                    </div>
                  </div>
                  {task.reviewComment && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 italic text-slate-500 mt-2">
                      &ldquo;{task.reviewComment}&rdquo;
                    </div>
                  )}

                  {/* Reviewer respond to invite */}
                  {isReviewer && task.reviewerStatus === "PENDING" && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                      <button type="button"
                        onClick={() => doAction(() => taskService.respondReviewerInvite(taskId!, "ACCEPT"), "Accepted reviewer role")}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition w-full text-center">
                        Accept Role
                      </button>
                      <button type="button"
                        onClick={() => doAction(() => taskService.respondReviewerInvite(taskId!, "REJECT"), "Declined reviewer role")}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition w-full text-center">
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">No reviewer has been assigned yet.</p>
                  {isCreator && task.status !== "DONE" && task.status !== "CANCELLED" && (
                    <button type="button" onClick={() => { setSelectedUserId(""); setInviteReviewerModal(true); }}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition w-full bg-white shadow-sm">
                      <PlusIcon className="h-3.5 w-3.5" /> Invite Reviewer
                    </button>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Assignments Sidebar Box */}
          <Section title="Assignees Pool">
            <div className="space-y-3">
              {task.assignments?.length === 0 ? (
                <p className="text-xs text-slate-400">No assignees working on this task.</p>
              ) : (
                task.assignments.map((a: any) => (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                        {getInitials(a.assigneeName)}
                      </div>
                      <span className="font-bold text-slate-800">{a.assigneeName}</span>
                    </div>
                    {a.brief && <p className="text-slate-500 text-[11px] leading-relaxed italic">{a.brief}</p>}
                    

                    {/* Creator approve assignment */}
                    {isCreator && a.approvalStatus === "PENDING" && (
                      <button type="button"
                        onClick={() => doAction(() => taskService.approveAssignment(taskId!, a.id), "Assignment approved")}
                        className="rounded bg-blue-600 text-white font-semibold py-1 w-full text-center hover:bg-blue-700 transition mt-1.5">
                        Approve Join Request
                      </button>
                    )}
                  </div>
                ))
              )}

              {(isCreator || !!myAssignment) && task.status !== "DONE" && task.status !== "CANCELLED" && (
                <div className="space-y-2 mt-1">
                  <button type="button" onClick={() => { setSelectedUserId(""); setAssignBrief(""); setAssignHow(""); setAssignModal(true); }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition w-full bg-white shadow-sm">
                    <PlusIcon className="h-3.5 w-3.5" /> Assign to Someone
                  </button>
                  {isCreator && !task.assignments?.some((a: any) => a.assigneeId === me?.id) && (
                    <button type="button" disabled={busy}
                      onClick={() => doAction(() => taskService.assignTask(taskId!, { assigneeId: me!.id }), "Assigned to you")}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-orange-200 px-3 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 transition w-full bg-white shadow-sm disabled:opacity-60">
                      <UserIcon className="h-3.5 w-3.5" /> Assign to Me
                    </button>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* Supporters Sidebar Box */}
          <Section title="Supporters / Observers">
            <div className="space-y-3">
              {task.supporters?.length === 0 ? (
                <p className="text-xs text-slate-400">No supporting members yet.</p>
              ) : (
                task.supporters.map((s: any) => (
                  <div key={s.id} className="flex justify-between items-center text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-semibold text-slate-700">{s.userName}</span>
                    <div className="flex items-center gap-2">
                      <Badge value={s.status} />
                      
                      {me?.id === s.userId && s.status === "PENDING" && (
                        <div className="flex gap-1">
                          <button type="button"
                            onClick={() => doAction(() => taskService.respondSupporterInvite(taskId!, s.id, "ACCEPT"), "You joined as supporter")}
                            className="bg-green-600 text-white px-2 py-0.5 rounded text-[10px] hover:bg-green-700 transition">
                            Join
                          </button>
                          <button type="button"
                            onClick={() => doAction(() => taskService.respondSupporterInvite(taskId!, s.id, "REJECT"), "Declined invite")}
                            className="border border-red-200 text-red-600 px-2 py-0.5 rounded text-[10px] hover:bg-red-50 transition">
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

            </div>
          </Section>
        </div>
      </div>

      {/* SUBTASK MODAL */}
      <Modal title={<span className="font-bold text-slate-800 text-base">Break Down Subtask</span>}
        open={subtaskModal} onOk={handleCreateSubtask} onCancel={() => setSubtaskModal(false)}
        okText="Create Subtask" okButtonProps={{ className: "bg-orange-500 hover:bg-orange-600 border-none" }}>
        <div className="space-y-4 py-3">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">Subtask Title</span>
            <Input placeholder="Enter subtask title..." value={subtaskTitle} onChange={(e) => setSubtaskTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">Description / Goal</span>
            <Input.TextArea placeholder="Describe the subtask goal..." value={subtaskDesc} onChange={(e) => setSubtaskDesc(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Priority</span>
              <Select value={subtaskPriority} onChange={setSubtaskPriority} className="w-full"
                options={[
                  { value: "LOW", label: "Low" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "HIGH", label: "High" },
                  { value: "URGENT", label: "Urgent" }
                ]}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500">Due Date</span>
              <DatePickerField
                value={subtaskDueDate ? subtaskDueDate.format("YYYY-MM-DD") : ""}
                onChange={(dStr) => setSubtaskDueDate(dStr ? dayjs(dStr) : null)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">Assign To</span>
            <Select placeholder="Select team member..." className="w-full"
              value={subtaskAssigneeId || undefined}
              onChange={setSubtaskAssigneeId}
              options={users.map(u => ({ value: u.id, label: `${u.fullName} (${u.email})` }))}
            />
          </div>
        </div>
      </Modal>

      {/* Submit for review modal */}
      <Modal title="Submit Work Results" open={submitModal} onCancel={() => { setSubmitModal(false); setAttachedFiles([]); }}
        onOk={handleSubmit} confirmLoading={busy || uploadingFile} okText="Submit"
        okButtonProps={{ className: "bg-blue-600 hover:bg-blue-700 border-none" }}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Provide delivered outcomes and summaries:</p>
          <Input.TextArea rows={4} value={resultNote} onChange={(e) => setResultNote(e.target.value)}
            placeholder="Deliverable links, summaries, and outcome notes..." />
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Đính kèm file (gửi đến reviewer + task owner)</p>
            <Upload
              beforeUpload={handleFileAttach}
              showUploadList={false}
              multiple
              disabled={uploadingFile}
            >
              <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                <PaperClipIcon className="h-3.5 w-3.5" />
                {uploadingFile ? "Đang upload..." : "Chọn file"}
              </button>
            </Upload>
            {attachedFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1">
                    <PaperClipIcon className="h-3 w-3 text-blue-400 shrink-0" />
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">{f.name}</a>
                    <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                      className="ml-auto text-red-400 hover:text-red-600"><XCircleIcon className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Review modal */}
      <Modal title="Review Task Deliverables" open={reviewModal} onCancel={() => setReviewModal(false)}
        onOk={handleReview} confirmLoading={busy} okText="Submit Review" okButtonProps={{ className: "bg-emerald-600 hover:bg-emerald-700 border-none" }}>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Decision</p>
            <Select value={reviewDecision} onChange={(v) => setReviewDecision(v)} className="w-full"
              options={[{ value: "APPROVED", label: "Approve — mark DONE" }, { value: "REJECTED", label: "Reject — send back for REWORK" }]} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Feedback Remarks</p>
            <Input.TextArea rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Write feedback comment..." />
          </div>
          {task.resultNote && (
            <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200">
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider text-[9px]">Assignee Submitted Results:</p>
              <p className="text-sm text-slate-700 italic">{task.resultNote}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Assign Task Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-orange-50 rounded-lg">
              <UserIcon className="h-5 w-5 text-orange-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Assign Task</span>
          </div>
        }
        open={assignModal}
        onCancel={() => { setAssignModal(false); setSelectedUserId(""); setAssignBrief(""); setAssignHow(""); setUserResults([]); setUserSearch(""); }}
        onOk={handleAssign}
        confirmLoading={busy}
        okText="Confirm Assignment"
        cancelText="Cancel"
        className="rounded-2xl overflow-hidden [&>.ant-modal-content]:!rounded-2xl"
        okButtonProps={{
          disabled: !selectedUserId,
          className: `rounded-xl h-10 px-5 text-sm font-semibold border-none ${
            selectedUserId ? "bg-orange-500 hover:bg-orange-600" : "bg-slate-100 text-slate-400"
          }`
        }}
        cancelButtonProps={{ className: "rounded-xl h-10 px-5 text-sm font-semibold border-slate-200" }}
      >
        <div className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Search Assignee</label>
            <Select
              showSearch
              filterOption={false}
              optionLabelProp="label"
              placeholder="Search user by name or email..."
              className="w-full [&>.ant-select-selector]:!rounded-xl [&>.ant-select-selector]:!border-slate-200 hover:[&>.ant-select-selector]:!border-orange-400 focus:[&>.ant-select-selector]:!border-orange-400 [&>.ant-select-selector]:!h-[38px] [&>.ant-select-selector]:!flex [&>.ant-select-selector]:!items-center transition"
              value={selectedUserId || undefined}
              onSearch={handleSearchUsers}
              onChange={setSelectedUserId}
              allowClear
              notFoundContent={userSearch ? "No users found" : "Type to search"}
            >
              {userResults.map((u) => {
                const initials = getInitials(u.fullName);
                return (
                  <Select.Option key={u.id} value={u.id} label={u.fullName}>
                    <div className="flex items-center gap-2.5 py-0.5">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 leading-normal m-0">{u.fullName}</p>
                        <p className="text-xs text-slate-400 m-0 truncate">{u.email}</p>
                      </div>
                    </div>
                  </Select.Option>
                );
              })}
            </Select>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-slate-100/60">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Assignment Brief (Optional)</label>
              <Input
                placeholder="Brief / reason for choosing this person"
                value={assignBrief}
                onChange={(e) => setAssignBrief(e.target.value)}
                className="rounded-xl h-[38px] border-slate-200 hover:border-orange-400 focus:border-orange-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">How-to Guidance (Optional)</label>
              <Input
                placeholder="How-to guidance"
                value={assignHow}
                onChange={(e) => setAssignHow(e.target.value)}
                className="rounded-xl h-[38px] border-slate-200 hover:border-orange-400 focus:border-orange-400 transition"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Invite Reviewer Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-orange-50 rounded-lg">
              <UserIcon className="h-5 w-5 text-orange-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Invite Reviewer</span>
          </div>
        }
        open={inviteReviewerModal}
        onCancel={() => { setInviteReviewerModal(false); setSelectedUserId(""); setUserResults([]); setUserSearch(""); }}
        onOk={handleInviteReviewer}
        confirmLoading={busy}
        okText="Invite Reviewer"
        cancelText="Cancel"
        className="rounded-2xl overflow-hidden [&>.ant-modal-content]:!rounded-2xl"
        okButtonProps={{
          disabled: !selectedUserId,
          className: `rounded-xl h-10 px-5 text-sm font-semibold border-none ${
            selectedUserId ? "bg-orange-500 hover:bg-orange-600" : "bg-slate-100 text-slate-400"
          }`
        }}
        cancelButtonProps={{ className: "rounded-xl h-10 px-5 text-sm font-semibold border-slate-200" }}
      >
        <div className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Search Reviewer</label>
            <Select
              showSearch
              filterOption={false}
              optionLabelProp="label"
              placeholder="Search user by name or email..."
              className="w-full [&>.ant-select-selector]:!rounded-xl [&>.ant-select-selector]:!border-slate-200 hover:[&>.ant-select-selector]:!border-orange-400 focus:[&>.ant-select-selector]:!border-orange-400 [&>.ant-select-selector]:!h-[38px] [&>.ant-select-selector]:!flex [&>.ant-select-selector]:!items-center transition"
              value={selectedUserId || undefined}
              onSearch={handleSearchUsers}
              onChange={setSelectedUserId}
              allowClear
              notFoundContent={userSearch ? "No users found" : "Type to search"}
            >
              {userResults.map((u) => {
                const initials = getInitials(u.fullName);
                return (
                  <Select.Option key={u.id} value={u.id} label={u.fullName}>
                    <div className="flex items-center gap-2.5 py-0.5">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 leading-normal m-0">{u.fullName}</p>
                        <p className="text-xs text-slate-400 m-0 truncate">{u.email}</p>
                      </div>
                    </div>
                  </Select.Option>
                );
              })}
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        title="Delete Task"
        open={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onOk={confirmDeleteTask}
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

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="space-y-1">
    <p className="text-xs font-bold uppercase tracking-widest text-orange-500">{label}</p>
    <p className="text-base text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">{value}</p>
  </div>
);

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 text-slate-600">
    {icon}
    <span>{label}: <span className="font-semibold text-slate-800">{value}</span></span>
  </div>
);

const BADGE_STYLE: Record<string, string> = {
  PENDING:          "bg-amber-50 text-amber-700 border border-amber-200",
  ACCEPTED:         "bg-emerald-50 text-emerald-700 border border-emerald-200",
  REJECTED:         "bg-red-50 text-red-700 border border-red-200",
  APPROVED:         "bg-blue-50 text-blue-700 border border-blue-200",
  NOT_REQUIRED:     "bg-slate-100 text-slate-500 border border-slate-200",
  TODO:             "bg-slate-100 text-slate-600 border border-slate-200",
  DOING:            "bg-blue-50 text-blue-700 border border-blue-200",
  WAITING_REVIEW:   "bg-amber-50 text-amber-700 border border-amber-200",
  DONE:             "bg-emerald-50 text-emerald-700 border border-emerald-200",
  CANCELLED:        "bg-red-50 text-red-600 border border-red-200",
  REWORK:           "bg-purple-50 text-purple-700 border border-purple-200",
  LOW:              "bg-slate-100 text-slate-500 border border-slate-200",
  MEDIUM:           "bg-blue-50 text-blue-600 border border-blue-200",
  HIGH:             "bg-orange-50 text-orange-700 border border-orange-200",
  URGENT:           "bg-red-50 text-red-700 border border-red-200",
};

const Badge: React.FC<{ value: string; className?: string }> = ({ value, className = "" }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${BADGE_STYLE[value] ?? "bg-slate-100 text-slate-600"} ${className}`}>
    {value.replace(/_/g, " ")}
  </span>
);

export default TaskDetailPage;
