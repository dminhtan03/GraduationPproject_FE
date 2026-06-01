import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "antd";
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { projectService } from "../../services/projectService";
import { userService } from "../../services/userService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { ROUTES } from "../../constants";
import DatePickerField from "../../components/common/DatePickerField";

const { TextArea } = Input;

const ProjectCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await userService.searchUsers(memberSearch);
        setMemberResults(results.filter((u: any) =>
          !selectedMembers.some(m => m.id === u.id)));
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [memberSearch, selectedMembers]);

  const addMember = (user: any) => {
    setSelectedMembers(prev => [...prev, user]);
    setMemberSearch("");
    setMemberResults([]);
  };

  const removeMember = (userId: string) => {
    setSelectedMembers(prev => prev.filter(m => m.id !== userId));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { show("warning", "Please enter project name"); return; }
    if (startDate && endDate && dayjs(endDate).isBefore(dayjs(startDate), "day")) {
      show("warning", "End date must be after or equal to start date");
      return;
    }
    setSubmitting(true);
    try {
      const project = await projectService.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        goal: goal.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        memberIds: selectedMembers.map(m => m.id),
      });
      show("success", "Project created successfully!");
      setTimeout(() => navigate(`/projects/${project.id}`), 800);
    } catch {
      show("error", "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button type="button" onClick={() => navigate(ROUTES.PROJECTS)}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
            <ArrowLeftIcon className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create Project</h1>
            <p className="text-sm text-slate-500 mt-0.5">Fill in details to create a new project.</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Project Name */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input size="large" placeholder="e.g. Booking Management System v2"
              value={name} onChange={e => setName(e.target.value)}
              className="rounded-xl h-[42px] border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Project Description</label>
            <TextArea rows={3} placeholder="Short description of the project..."
              value={description} onChange={e => setDescription(e.target.value)}
              className="rounded-xl resize-none border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />
          </div>

          {/* Goal */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Project Goal</label>
            <TextArea rows={3} placeholder="Goals to be achieved..."
              value={goal} onChange={e => setGoal(e.target.value)}
              className="rounded-xl resize-none border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />
          </div>

          {/* Date Picker using DatePickerField */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Project Timeline</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <DatePickerField
                  label="Start Date"
                  value={startDate ?? ""}
                  onChange={dStr => setStartDate(dStr || null)}
                />
              </div>
              <div>
                <DatePickerField
                  label="End Date"
                  value={endDate ?? ""}
                  onChange={dStr => setEndDate(dStr || null)}
                />
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Team Members
            </label>

            {/* Selected members */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedMembers.map(m => (
                  <div key={m.id}
                    className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5 text-sm">
                    <div className="w-5 h-5 rounded-full bg-[#172b4d] flex items-center justify-center text-[9px] font-bold text-white">
                      {getInitials(m.fullName)}
                    </div>
                    <span className="text-slate-800 font-medium">{m.fullName}</span>
                    <button type="button" onClick={() => removeMember(m.id)}
                      className="text-slate-400 hover:text-red-500 transition">
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search input */}
            <Input placeholder="Search members by name or email..."
              value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
              prefix={<PlusIcon className="h-4 w-4 text-slate-400 mr-1" />}
              className="rounded-xl h-[42px] border-slate-200 hover:border-orange-400 focus:border-orange-400 transition" />

            {/* Search results */}
            {memberResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {memberResults.map(u => (
                  <div key={u.id} onClick={() => addMember(u)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 cursor-pointer border-b border-slate-100 last:border-0 transition">
                    <div className="w-8 h-8 rounded-full bg-[#172b4d] flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                      {getInitials(u.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{u.fullName}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 justify-end pb-8">
            <button
              type="button"
              onClick={() => navigate(ROUTES.PROJECTS)}
              className="rounded-xl h-[42px] px-6 text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-xl h-[42px] px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {submitting ? "Creating..." : "Create Project"}
            </button>
          </div>
        </div>
      </div>

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ProjectCreatePage;
