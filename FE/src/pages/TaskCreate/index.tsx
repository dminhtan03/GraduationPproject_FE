import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Select, Input, DatePicker } from "antd";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { taskService } from "../../services/taskService";
import { userService } from "../../services/userService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const TaskCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", description: "", goal: "", expectedResult: "",
    assignmentBrief: "", assignmentHow: "",
    priority: "MEDIUM", dueAt: "",
  });
  const [assigneeId, setAssigneeId] = useState("");
  const [reviewerUserId, setReviewerUserId] = useState("");
  const [userResults, setUserResults] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUserSearch = (val: string) => {
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setUserResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const r = await userService.searchUsers(val);
      setUserResults(r);
    }, 350);
  };

  const userOptions = userResults.map((u) => ({
    value: u.id,
    label: `${u.fullName} (${u.email})`,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { show("warning", "Title is required"); return; }
    setLoading(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        priority: form.priority,
      };
      if (form.description) payload.description = form.description;
      if (form.goal) payload.goal = form.goal;
      if (form.expectedResult) payload.expectedResult = form.expectedResult;
      if (form.assignmentBrief) payload.assignmentBrief = form.assignmentBrief;
      if (form.assignmentHow) payload.assignmentHow = form.assignmentHow;
      if (form.dueAt) payload.dueAt = form.dueAt + "T00:00:00";
      if (assigneeId) payload.assigneeId = assigneeId;
      if (reviewerUserId) payload.reviewerUserId = reviewerUserId;

      const task = await taskService.createTask(payload);
      show("success", "Task created!");
      setTimeout(() => navigate(`/tasks/${task.id}`), 600);
    } catch {
      show("error", "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, key: keyof typeof form, placeholder: string, required = false) => (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Input value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder} className="rounded-lg" />
    </div>
  );

  const textarea = (label: string, key: keyof typeof form, placeholder: string, rows = 2) => (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <Input.TextArea rows={rows} value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder} className="rounded-lg" />
    </div>
  );

  return (
    <div className="fade-in p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={() => navigate("/tasks")}
          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition">
          <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Task</h1>
          <p className="text-sm text-slate-500">Fill in the task details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {field("Title", "title", "Task title...", true)}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Priority</label>
            <Select value={form.priority} onChange={(v) => setForm((p) => ({ ...p, priority: v }))} className="w-full"
              options={[
                { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" },
              ]} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Due Date</label>
            <DatePicker
              className="w-full"
              value={form.dueAt ? dayjs(form.dueAt) : null}
              onChange={(d) => setForm((p) => ({ ...p, dueAt: d ? d.format("YYYY-MM-DD") : "" }))}
              disabledDate={(d) => d && d.isBefore(dayjs(), "day")}
              format="DD/MM/YYYY"
              placeholder="Chọn ngày hết hạn"
              allowClear
            />
          </div>
        </div>

        {textarea("Description", "description", "Task description...", 3)}
        {textarea("Goal", "goal", "What should be achieved...")}
        {textarea("Expected Result", "expectedResult", "Expected deliverable...")}

        <hr className="border-slate-100" />

        <p className="text-xs font-semibold uppercase text-slate-400 pt-2 -mb-2">Optional: Assign on creation</p>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Assign to</label>
          <Select showSearch filterOption={false} placeholder="Search user..."
            className="w-full" value={assigneeId || undefined}
            onSearch={handleUserSearch} onChange={setAssigneeId}
            options={userOptions} notFoundContent="Type to search" allowClear />
        </div>

        {assigneeId && (
          <>
            {textarea("Assignment Brief", "assignmentBrief", "Why you chose this person / notes...")}
            {textarea("How-to Guidance", "assignmentHow", "Steps or guidance for the assignee...")}
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Reviewer</label>
          <Select showSearch filterOption={false} placeholder="Search reviewer..."
            className="w-full" value={reviewerUserId || undefined}
            onSearch={handleUserSearch} onChange={setReviewerUserId}
            options={userOptions} notFoundContent="Type to search" allowClear />
        </div>

        <div className="flex gap-3 pt-2 justify-end">
          <button type="button" onClick={() => navigate("/tasks")} disabled={loading}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition disabled:opacity-60">
            {loading ? "Creating..." : "Create Task"}
          </button>
        </div>
      </form>

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TaskCreatePage;
