import React, { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Select, Input } from "antd";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { taskService } from "../../services/taskService";
import { userService } from "../../services/userService";
import DatePickerField from "../../components/common/DatePickerField";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const getInitials = (name?: string) => {
  if (!name || name === "Unassigned") return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const TaskCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sprintId = searchParams.get("sprintId") ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;

  const [form, setForm] = useState({
    title: "", description: "", goal: "", expectedResult: "",
    assignmentBrief: "", assignmentHow: "",
    priority: "MEDIUM", dueAt: "",
  });
  const [assigneeId, setAssigneeId] = useState("");
  const [reviewerUserId, setReviewerUserId] = useState("");
  const [assignOnCreation, setAssignOnCreation] = useState(false);
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
      if (assignOnCreation) {
        if (form.assignmentBrief) payload.assignmentBrief = form.assignmentBrief;
        if (form.assignmentHow) payload.assignmentHow = form.assignmentHow;
        if (assigneeId) payload.assigneeId = assigneeId;
        if (reviewerUserId) payload.reviewerUserId = reviewerUserId;
      }
      if (form.dueAt) payload.dueAt = form.dueAt + "T00:00:00";
      if (sprintId) payload.sprintId = sprintId;
      if (projectId) payload.projectId = projectId;

      const task = await taskService.createTask(payload);
      show("success", "Task created!");
      const backUrl = projectId ? `/tasks?projectId=${projectId}` : `/tasks/${task.id}`;
      setTimeout(() => navigate(backUrl), 600);
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
        placeholder={placeholder} className="rounded-xl h-[38px] border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />
    </div>
  );

  const textarea = (label: string, key: keyof typeof form, placeholder: string, rows = 2) => (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <Input.TextArea rows={rows} value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder} className="rounded-xl border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />
    </div>
  );

  return (
    <div className="fade-in p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <button type="button"
          onClick={() => navigate(projectId ? `/tasks?projectId=${projectId}` : "/tasks")}
          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition">
          <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create Task</h1>
          <p className="text-sm text-slate-500">
            {sprintId ? "Task will be added to the current sprint" : "Fill in the task details below"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {field("Title", "title", "Task title...", true)}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Priority</label>
            <Select value={form.priority} onChange={(v) => setForm((p) => ({ ...p, priority: v }))}
              className="w-full [&>.ant-select-selector]:!rounded-xl [&>.ant-select-selector]:!border-slate-200 hover:[&>.ant-select-selector]:!border-orange-400 focus:[&>.ant-select-selector]:!border-orange-400 [&>.ant-select-selector]:!h-[38px] [&>.ant-select-selector]:!flex [&>.ant-select-selector]:!items-center transition"
              options={[
                { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" },
              ]} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Due Date</label>
            <DatePickerField
              value={form.dueAt}
              onChange={(d) => setForm((p) => ({ ...p, dueAt: d }))}
              minDate={dayjs().format("YYYY-MM-DD")}
              placeholder="Select due date"
            />
          </div>
        </div>

        {textarea("Description", "description", "Task description...", 3)}
        {textarea("Goal", "goal", "What should be achieved...")}
        {textarea("Expected Result", "expectedResult", "Expected deliverable...")}

        <hr className="border-slate-100" />

        {/* Optional: Assign on creation panel */}
        <div className="border border-slate-200/80 bg-slate-50/50 rounded-2xl p-4.5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Assign on creation (Optional)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Directly assign this task and set a reviewer.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !assignOnCreation;
                setAssignOnCreation(next);
                if (!next) {
                  setAssigneeId("");
                  setReviewerUserId("");
                  setForm((p) => ({ ...p, assignmentBrief: "", assignmentHow: "" }));
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                assignOnCreation ? "bg-orange-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  assignOnCreation ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {assignOnCreation && (
            <div className="space-y-4 pt-3.5 border-t border-slate-200/60">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">Assign to</label>
                  <Select
                    showSearch
                    filterOption={false}
                    optionLabelProp="label"
                    placeholder="Search user..."
                    className="w-full [&>.ant-select-selector]:!rounded-xl [&>.ant-select-selector]:!border-slate-200 hover:[&>.ant-select-selector]:!border-orange-400 focus:[&>.ant-select-selector]:!border-orange-400 [&>.ant-select-selector]:!h-[38px] [&>.ant-select-selector]:!flex [&>.ant-select-selector]:!items-center transition"
                    value={assigneeId || undefined}
                    onSearch={handleUserSearch}
                    onChange={setAssigneeId}
                    allowClear
                    popupClassName="select-premium-dropdown"
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
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">Reviewer</label>
                  <Select
                    showSearch
                    filterOption={false}
                    optionLabelProp="label"
                    placeholder="Search reviewer..."
                    className="w-full [&>.ant-select-selector]:!rounded-xl [&>.ant-select-selector]:!border-slate-200 hover:[&>.ant-select-selector]:!border-orange-400 focus:[&>.ant-select-selector]:!border-orange-400 [&>.ant-select-selector]:!h-[38px] [&>.ant-select-selector]:!flex [&>.ant-select-selector]:!items-center transition"
                    value={reviewerUserId || undefined}
                    onSearch={handleUserSearch}
                    onChange={setReviewerUserId}
                    allowClear
                    popupClassName="select-premium-dropdown"
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

              {assigneeId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">Assignment Brief</label>
                    <Input.TextArea rows={2} value={form.assignmentBrief}
                      onChange={(e) => setForm((p) => ({ ...p, assignmentBrief: e.target.value }))}
                      placeholder="Why you chose this person..." className="rounded-xl border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600 uppercase tracking-wider">How-to Guidance</label>
                    <Input.TextArea rows={2} value={form.assignmentHow}
                      onChange={(e) => setForm((p) => ({ ...p, assignmentHow: e.target.value }))}
                      placeholder="Steps or guidance..." className="rounded-xl border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2 justify-end">
          <button type="button" onClick={() => navigate(projectId ? `/tasks?projectId=${projectId}` : "/tasks")} disabled={loading}
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
