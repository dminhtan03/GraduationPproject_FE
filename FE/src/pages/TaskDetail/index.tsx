import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tag, Spin, Modal, Input, Select } from "antd";
import {
  ArrowLeftIcon, CalendarIcon, UserIcon,
  CheckCircleIcon, XCircleIcon, PlusIcon,
} from "@heroicons/react/24/outline";
import { taskService } from "../../services/taskService";
import { userService } from "../../services/userService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

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
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("vi-VN", { hour12: false });
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
    {children}
  </div>
);

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [me, setMe] = useState<{ id: string; fullName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  // modals
  const [submitModal, setSubmitModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [inviteReviewerModal, setInviteReviewerModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [supporterModal, setSupporterModal] = useState(false);

  const [resultNote, setResultNote] = useState("");
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewComment, setReviewComment] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignBrief, setAssignBrief] = useState("");
  const [assignHow, setAssignHow] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const reload = async () => {
    if (!taskId) return;
    const data = await taskService.getTask(taskId);
    setTask(data);
  };

  useEffect(() => {
    if (!taskId) return;
    Promise.all([taskService.getTask(taskId), userService.getMe()])
      .then(([t, m]) => { setTask(t); setMe(m); })
      .catch(() => show("error", "Failed to load task"))
      .finally(() => setLoading(false));
  }, [taskId]);

  const doAction = async (fn: () => Promise<any>, successMsg: string) => {
    setBusy(true);
    try {
      await fn();
      await reload();
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

  const handleSubmit = () =>
    doAction(async () => {
      await taskService.submitForReview(taskId!, resultNote);
      setSubmitModal(false); setResultNote("");
    }, "Submitted for review");

  const handleReview = () =>
    doAction(async () => {
      await taskService.reviewTask(taskId!, reviewDecision, reviewComment);
      setReviewModal(false); setReviewComment("");
    }, reviewDecision === "APPROVED" ? "Task approved" : "Sent back for rework");

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

  return (
    <div className="fade-in p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={() => navigate("/tasks")}
          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition">
          <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{task.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Tag color={PRIORITY_COLOR[task.priority]}>{task.priority}</Tag>
            <Tag color={STATUS_COLOR[task.status]}>{task.status?.replace(/_/g, " ")}</Tag>
          </div>
        </div>
        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          {canSubmit && (
            <button type="button" onClick={() => setSubmitModal(true)} disabled={busy}
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition">
              Submit for Review
            </button>
          )}
          {canReview && (
            <button type="button" onClick={() => setReviewModal(true)} disabled={busy}
              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 transition">
              Review Task
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5">
        {/* Details */}
        <Section title="Details">
          <div className="space-y-3">
            {task.description && <Field label="Description" value={task.description} />}
            {task.goal && <Field label="Goal" value={task.goal} />}
            {task.expectedResult && <Field label="Expected Result" value={task.expectedResult} />}
            {task.assignmentBrief && <Field label="Assignment Brief" value={task.assignmentBrief} />}
            {task.assignmentHow && <Field label="How to" value={task.assignmentHow} />}
            {task.resultNote && <Field label="Result Note" value={task.resultNote} />}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <InfoItem icon={<CalendarIcon className="h-4 w-4 text-orange-400" />}
                label="Due" value={fmt(task.dueAt)} />
              <InfoItem icon={<UserIcon className="h-4 w-4 text-blue-400" />}
                label="Created by" value={task.createdByName} />
              {task.submittedAt && (
                <InfoItem icon={<CalendarIcon className="h-4 w-4 text-blue-400" />}
                  label="Submitted" value={fmt(task.submittedAt)} />
              )}
              {task.reviewedAt && (
                <InfoItem icon={<CalendarIcon className="h-4 w-4 text-green-400" />}
                  label="Reviewed" value={fmt(task.reviewedAt)} />
              )}
            </div>
          </div>
        </Section>

        {/* Reviewer section */}
        <Section title="Reviewer">
          <div className="flex items-center justify-between">
            {task.reviewerUserId ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-800">{task.reviewerName}</p>
                <div className="flex items-center gap-2">
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
                  <p className="text-sm text-slate-500 italic">&ldquo;{task.reviewComment}&rdquo;</p>
                )}
                {/* Reviewer respond to invite */}
                {isReviewer && task.reviewerStatus === "PENDING" && (
                  <div className="flex gap-2 mt-2">
                    <button type="button"
                      onClick={() => doAction(() => taskService.respondReviewerInvite(taskId!, "ACCEPT"), "Accepted reviewer role")}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                      Accept Invitation
                    </button>
                    <button type="button"
                      onClick={() => doAction(() => taskService.respondReviewerInvite(taskId!, "REJECT"), "Declined reviewer role")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No reviewer assigned</p>
            )}
            {isCreator && !task.reviewerUserId && task.status !== "DONE" && task.status !== "CANCELLED" && (
              <button type="button" onClick={() => { setSelectedUserId(""); setInviteReviewerModal(true); }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <PlusIcon className="h-3.5 w-3.5" /> Invite Reviewer
              </button>
            )}
          </div>
        </Section>

        {/* Assignments */}
        <Section title="Assignments">
          <div className="space-y-2 mb-3">
            {task.assignments?.length === 0 && (
              <p className="text-sm text-slate-400">No assignments yet</p>
            )}
            {task.assignments?.map((a: any) => (
              <div key={a.id} className="rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{a.assigneeName}</p>
                    {a.assignerName && (
                      <p className="text-xs text-slate-400">Assigned by {a.assignerName}</p>
                    )}
                    {a.brief && <p className="text-xs text-slate-500 mt-0.5">{a.brief}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.primary && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">Primary</span>}
                    <Tag color={a.status === "ACCEPTED" ? "success" : a.status === "REJECTED" ? "error" : "default"}>
                      {a.status}
                    </Tag>
                  </div>
                </div>
                {/* Assignee respond */}
                {me?.id === a.assigneeId && a.status === "PENDING" && (
                  <div className="flex gap-2 mt-2">
                    <button type="button"
                      onClick={() => doAction(() => taskService.respondToAssignment(taskId!, a.id, "ACCEPT"), "Assignment accepted")}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700">
                      <CheckCircleIcon className="h-3.5 w-3.5" /> Accept
                    </button>
                    <button type="button"
                      onClick={() => doAction(() => taskService.respondToAssignment(taskId!, a.id, "REJECT"), "Assignment declined")}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">
                      <XCircleIcon className="h-3.5 w-3.5" /> Decline
                    </button>
                  </div>
                )}
                {/* Creator approve assignment */}
                {isCreator && a.approvalStatus === "PENDING" && (
                  <button type="button"
                    onClick={() => doAction(() => taskService.approveAssignment(taskId!, a.id), "Assignment approved")}
                    className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700">
                    Approve
                  </button>
                )}
              </div>
            ))}
          </div>
          {isCreator && task.status !== "DONE" && task.status !== "CANCELLED" && (
            <button type="button" onClick={() => { setSelectedUserId(""); setAssignBrief(""); setAssignHow(""); setAssignModal(true); }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <PlusIcon className="h-3.5 w-3.5" /> Assign to Someone
            </button>
          )}
        </Section>

        {/* Supporters */}
        <Section title="Supporters">
          <div className="space-y-2 mb-3">
            {task.supporters?.length === 0 && (
              <p className="text-sm text-slate-400">No supporters yet</p>
            )}
            {task.supporters?.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2">
                <p className="text-sm font-medium text-slate-800">{s.userName}</p>
                <div className="flex items-center gap-2">
                  <Tag color={s.status === "ACCEPTED" ? "success" : s.status === "REJECTED" ? "error" : "default"}>
                    {s.status}
                  </Tag>
                  {me?.id === s.userId && s.status === "PENDING" && (
                    <div className="flex gap-1">
                      <button type="button"
                        onClick={() => doAction(() => taskService.respondSupporterInvite(taskId!, s.id, "ACCEPT"), "You joined as supporter")}
                        className="rounded-lg bg-green-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-green-700">
                        Accept
                      </button>
                      <button type="button"
                        onClick={() => doAction(() => taskService.respondSupporterInvite(taskId!, s.id, "REJECT"), "Declined supporter invite")}
                        className="rounded-lg border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {(isCreator || myAssignment?.status === "ACCEPTED") && task.status !== "DONE" && task.status !== "CANCELLED" && (
            <button type="button" onClick={() => { setSelectedUserId(""); setSupporterModal(true); }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <PlusIcon className="h-3.5 w-3.5" /> Add Supporter
            </button>
          )}
        </Section>
      </div>

      {/* Submit for review modal */}
      <Modal title="Submit for Review" open={submitModal} onCancel={() => setSubmitModal(false)}
        onOk={handleSubmit} confirmLoading={busy} okText="Submit">
        <p className="text-sm text-slate-500 mb-3">Describe what you completed:</p>
        <Input.TextArea rows={4} value={resultNote} onChange={(e) => setResultNote(e.target.value)}
          placeholder="Summary of your result..." />
      </Modal>

      {/* Review modal */}
      <Modal title="Review Task" open={reviewModal} onCancel={() => setReviewModal(false)}
        onOk={handleReview} confirmLoading={busy} okText="Confirm">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Decision</p>
            <Select value={reviewDecision} onChange={(v) => setReviewDecision(v)} className="w-full"
              options={[{ value: "APPROVED", label: "Approve — mark DONE" }, { value: "REJECTED", label: "Reject — send back for REWORK" }]} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Comment (optional)</p>
            <Input.TextArea rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Feedback..." />
          </div>
          {task.resultNote && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-400 mb-1">Assignee result note:</p>
              <p className="text-sm text-slate-700">{task.resultNote}</p>
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
          okButtonProps={{ disabled: !selectedUserId }}>
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
    <p className="text-xs font-semibold uppercase text-slate-400 mb-0.5">{label}</p>
    <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
  </div>
);

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 text-sm text-slate-600">
    {icon}
    <span>{label}: <span className="font-medium">{value}</span></span>
  </div>
);

export default TaskDetailPage;
