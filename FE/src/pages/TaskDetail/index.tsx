import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tag, Spin, Modal, Input, Select, DatePicker, Button, Tooltip, Upload } from "antd";
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
  const [supporterModal, setSupporterModal] = useState(false);

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

  const handleAddSupporter = () =>
    doAction(async () => {
      await taskService.addSupporter(taskId!, selectedUserId);
      setSupporterModal(false); setSelectedUserId("");
    }, "Supporter added");

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
        dueAt: subtaskDueDate ? subtaskDueDate.toISOString() : undefined,
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
  const canSubmit = !!myAssignment && myAssignment.status === "ACCEPTED"
    && (task.status === "DOING" || task.status === "REWORK");
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
              <Tag color={PRIORITY_COLOR[task.priority]}>{task.priority}</Tag>
              <Tag color={STATUS_COLOR[task.status]}>{task.status?.replace(/_/g, " ")}</Tag>
              {task.sprintName && (
                <span className="px-2 py-0.5 text-xs bg-orange-50 text-orange-600 rounded-lg border border-orange-100 font-bold">{task.sprintName}</span>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Task details and subtasks) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Details Section */}
          <Section title="Task Description">
            <div className="space-y-4">
              {task.description ? (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No description provided.</p>
              )}

              {task.goal && <Field label="Target Goals" value={task.goal} />}
              {task.expectedResult && <Field label="Expected Deliverables" value={task.expectedResult} />}
              {task.assignmentBrief && <Field label="Assignment Brief" value={task.assignmentBrief} />}
              {task.assignmentHow && <Field label="Execution Guidelines (How-to)" value={task.assignmentHow} />}
              {task.resultNote && (
                <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 mt-4">
                  <Field label="Deliverable Results Submitted" value={task.resultNote} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
                <InfoItem icon={<CalendarIcon className="h-4 w-4 text-orange-400" />}
                  label="Deadline" value={fmt(task.dueAt)} />
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
                        <div className="flex gap-2.5 items-center text-[10px] text-slate-400 mt-1">
                          <span>Assignee: <span className="font-semibold text-slate-600">{sub.assignments?.[0]?.assigneeName || "Unassigned"}</span></span>
                          <span>Due: {fmt(sub.dueAt)}</span>
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
            <div className="space-y-4">
              {/* Comment Input */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-inner">
                  {getInitials(me?.fullName)}
                </div>
                <div className="flex-1 space-y-2">
                  <Input.TextArea rows={2} placeholder="Write comments or collaborate with team members... Select team member below to mention."
                    value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                  <div className="flex justify-between items-center gap-2">
                    <Select placeholder="Mention team member..." size="small" className="w-48"
                      onChange={(val) => setCommentText(prev => prev ? `${prev} @${val} ` : `@${val} `)}
                      options={users.map(u => ({ value: u.fullName, label: u.fullName }))}
                    />
                    <button type="button" onClick={handleAddComment}
                      className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition">
                      <PaperAirplaneIcon className="h-3 w-3" />
                      Post Comment
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments Feed */}
              <div className="space-y-3.5 border-t border-slate-100 pt-4 max-h-[400px] overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-400 italic">No comments yet. Start collaborative chat!</p>
                ) : (
                  comments.map(c => (
                    <div key={c.id} className="flex gap-3 group">
                      <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {getInitials(c.authorName)}
                      </div>
                      <div className="flex-1 bg-slate-50/70 border border-slate-200/50 rounded-xl p-3 space-y-1 relative">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800">{c.authorName}</span>
                          <span className="text-[10px] text-slate-400">{fmt(c.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                        
                        {/* Delete comment */}
                        {me?.id === c.authorId && (
                          <button type="button" onClick={() => handleDeleteComment(c.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition">
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
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
                      <p className="font-bold text-slate-800 text-sm">{task.reviewerName}</p>
                      <p className="text-[10px] text-slate-400">Review status: <span className="font-bold">{task.reviewerStatus}</span></p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <Tag color={task.reviewerStatus === "ACCEPTED" ? "success"
                      : task.reviewerStatus === "REJECTED" ? "error" : "processing"}>
                      {task.reviewerStatus}
                    </Tag>
                    {task.reviewDecision && (
                      <Tag color={task.reviewDecision === "APPROVED" ? "success" : "error"}>
                        {task.reviewDecision}
                      </Tag>
                    )}
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
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                          {getInitials(a.assigneeName)}
                        </div>
                        <span className="font-bold text-slate-800">{a.assigneeName}</span>
                      </div>
                      <Tag color={a.status === "ACCEPTED" ? "success" : a.status === "REJECTED" ? "error" : "default"}>{a.status}</Tag>
                    </div>
                    {a.brief && <p className="text-slate-500 text-[11px] leading-relaxed italic">{a.brief}</p>}
                    
                    {/* Respond buttons for active user */}
                    {me?.id === a.assigneeId && a.status === "PENDING" && (
                      <div className="flex gap-2 pt-1.5 border-t border-slate-200/50">
                        <button type="button"
                          onClick={() => doAction(() => taskService.respondToAssignment(taskId!, a.id, "ACCEPT"), "Assignment accepted")}
                          className="flex-1 rounded bg-green-600 text-white font-semibold py-1 text-center hover:bg-green-700 transition">
                          Accept
                        </button>
                        <button type="button"
                          onClick={() => doAction(() => taskService.respondToAssignment(taskId!, a.id, "REJECT"), "Assignment declined")}
                          className="flex-1 border border-red-200 text-red-600 font-semibold py-1 text-center hover:bg-red-50 transition">
                          Decline
                        </button>
                      </div>
                    )}

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

              {isCreator && task.status !== "DONE" && task.status !== "CANCELLED" && (
                <button type="button" onClick={() => { setSelectedUserId(""); setAssignBrief(""); setAssignHow(""); setAssignModal(true); }}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition w-full bg-white shadow-sm mt-1">
                  <PlusIcon className="h-3.5 w-3.5" /> Assign to Someone
                </button>
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
                      <Tag color={s.status === "ACCEPTED" ? "success" : s.status === "REJECTED" ? "error" : "default"}>{s.status}</Tag>
                      
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

              {(isCreator || myAssignment?.status === "ACCEPTED") && task.status !== "DONE" && task.status !== "CANCELLED" && (
                <button type="button" onClick={() => { setSelectedUserId(""); setSupporterModal(true); }}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition w-full bg-white shadow-sm mt-1">
                  <PlusIcon className="h-3.5 w-3.5" /> Add Supporter
                </button>
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
              <DatePicker className="w-full" value={subtaskDueDate} onChange={setSubtaskDueDate} />
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

      {/* User picker modal (shared for assign / invite reviewer / add supporter) */}
      {[
        { open: assignModal, title: "Assign Task", onOk: handleAssign, onCancel: () => setAssignModal(false), extra: (
          <div className="space-y-3 mt-3">
            <Input placeholder="Brief / reason for choosing this person"
              value={assignBrief} onChange={(e) => setAssignBrief(e.target.value)} />
            <Input placeholder="How-to guidance"
              value={assignHow} onChange={(e) => setAssignHow(e.target.value)} />
          </div>
        )},
        { open: inviteReviewerModal, title: "Invite Reviewer", onOk: handleInviteReviewer, onCancel: () => setInviteReviewerModal(false), extra: null },
        { open: supporterModal, title: "Add Supporter", onOk: handleAddSupporter, onCancel: () => setSupporterModal(false), extra: null },
      ].map(({ open, title, onOk, onCancel, extra }) => (
        <Modal key={title} title={title} open={open} onCancel={onCancel}
          onOk={onOk} confirmLoading={busy} okText="Confirm"
          okButtonProps={{ disabled: !selectedUserId, className: "bg-orange-500 hover:bg-orange-600 border-none" }}>
          <div className="space-y-3">
            <Select
              showSearch filterOption={false}
              placeholder="Search user by name or email..."
              className="w-full"
              value={selectedUserId || undefined}
              onSearch={handleSearchUsers}
              onChange={setSelectedUserId}
              options={userSelectOptions}
              notFoundContent={userSearch ? "No users found" : "Type to search"}
            />
            {extra}
          </div>
        </Modal>
      ))}

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase text-slate-400 mb-0.5 tracking-wider text-[9px]">{label}</p>
    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{value}</p>
  </div>
);

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 text-slate-600">
    {icon}
    <span>{label}: <span className="font-semibold text-slate-800">{value}</span></span>
  </div>
);

export default TaskDetailPage;
