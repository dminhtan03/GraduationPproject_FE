import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, DatePicker, Button } from "antd";
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { projectService } from "../../services/projectService";
import { userService } from "../../services/userService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { ROUTES } from "../../constants";

const { TextArea } = Input;

const ProjectCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null);
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(null);

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
    if (!name.trim()) { show("warning", "Vui lòng nhập tên dự án"); return; }
    setSubmitting(true);
    try {
      const project = await projectService.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        goal: goal.trim() || undefined,
        startDate: startDate ? startDate.format("YYYY-MM-DD") : undefined,
        endDate: endDate ? endDate.format("YYYY-MM-DD") : undefined,
        memberIds: selectedMembers.map(m => m.id),
      });
      show("success", "Dự án đã được tạo thành công!");
      setTimeout(() => navigate(`/projects/${project.id}`), 800);
    } catch {
      show("error", "Tạo dự án thất bại");
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
            <h1 className="text-2xl font-bold text-slate-900">Tạo Dự Án</h1>
            <p className="text-sm text-slate-500 mt-0.5">Điền thông tin để tạo dự án mới</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Tên dự án */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Tên dự án <span className="text-red-500">*</span>
            </label>
            <Input size="large" placeholder="VD: Hệ thống quản lý đặt phòng v2"
              value={name} onChange={e => setName(e.target.value)}
              className="rounded-xl" />
          </div>

          {/* Mô tả */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Mô tả dự án</label>
            <TextArea rows={3} placeholder="Mô tả ngắn về dự án..."
              value={description} onChange={e => setDescription(e.target.value)}
              className="rounded-xl resize-none" />
          </div>

          {/* Mục tiêu */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Mục tiêu dự án</label>
            <TextArea rows={3} placeholder="Mục tiêu cần đạt được..."
              value={goal} onChange={e => setGoal(e.target.value)}
              className="rounded-xl resize-none" />
          </div>

          {/* Ngày bắt đầu / kết thúc */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Thời gian dự án</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Ngày bắt đầu</p>
                <DatePicker className="w-full rounded-xl" placeholder="Chọn ngày bắt đầu"
                  value={startDate} onChange={d => setStartDate(d)} format="DD/MM/YYYY" />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Ngày kết thúc</p>
                <DatePicker className="w-full rounded-xl" placeholder="Chọn ngày kết thúc"
                  value={endDate} onChange={d => setEndDate(d)} format="DD/MM/YYYY"
                  disabledDate={d => !!startDate && d.isBefore(startDate, "day")} />
              </div>
            </div>
          </div>

          {/* Thành viên */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Thành viên nhóm
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
            <Input placeholder="Tìm kiếm thành viên theo tên hoặc email..."
              value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
              prefix={<PlusIcon className="h-4 w-4 text-slate-400" />}
              className="rounded-xl" />

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
            <Button size="large" onClick={() => navigate(ROUTES.PROJECTS)}
              className="rounded-xl px-6">Hủy</Button>
            <Button type="primary" size="large" loading={submitting}
              onClick={handleSubmit}
              className="rounded-xl px-8 bg-orange-500 border-orange-500 hover:bg-orange-600 font-semibold">
              Tạo Dự Án
            </Button>
          </div>
        </div>
      </div>

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ProjectCreatePage;
