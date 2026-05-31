import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tag, Spin, Modal, Input, DatePicker, Tooltip } from "antd";
import {
  ArrowLeftIcon, PlusIcon, CalendarIcon, UserGroupIcon,
  FolderIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { projectService } from "../../services/projectService";
import { taskService } from "../../services/taskService";
import { userService } from "../../services/userService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { ROUTES } from "../../constants";
import DatePickerField from "../../components/common/DatePickerField";

const STATUS_COLOR: Record<string, string> = {
  TODO: "default", DOING: "processing", WAITING_REVIEW: "warning",
  DONE: "success", CANCELLED: "error", REWORK: "magenta",
};
const SPRINT_STATUS_COLOR: Record<string, string> = {
  PLANNED: "default", ACTIVE: "processing", COMPLETED: "success",
};

const fmt = (v?: string | null) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US");
};

const getInitials = (name?: string) => {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
};

const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  const [project, setProject] = useState<any>(null);
  const [sprints, setSprints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [collapsedSprints, setCollapsedSprints] = useState<Record<string, boolean>>({});

  // Sprint create modal
  const [sprintModal, setSprintModal] = useState(false);
  const [sprintForm, setSprintForm] = useState<{ name: string; startDate: string | null; endDate: string | null }>({
    name: "", startDate: null, endDate: null
  });
  const [savingSprint, setSavingSprint] = useState(false);

  // Delete project modal
  const [deleteProjectModal, setDeleteProjectModal] = useState(false);

  // Member add
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const memberTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [proj, me, allSprints] = await Promise.all([
        projectService.getProject(projectId),
        userService.getMe(),
        taskService.listSprints(),
      ]);
      setProject(proj);
      setUserId(me?.id ?? null);
      // Filter sprints belonging to this project
      setSprints(allSprints.filter((s: any) => s.projectId === projectId));
    } catch {
      show("error", "Failed to load project details");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  // Member search
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    clearTimeout(memberTimer.current);
    memberTimer.current = setTimeout(async () => {
      try {
        const results = await userService.searchUsers(memberSearch);
        const memberIds = new Set(project?.members?.map((m: any) => m.userId) ?? []);
        setMemberResults(results.filter((u: any) => !memberIds.has(u.id)));
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(memberTimer.current);
  }, [memberSearch, project]);

  const handleCreateSprint = async () => {
    if (!sprintForm.name.trim()) { show("warning", "Please enter sprint name"); return; }
    setSavingSprint(true);
    try {
      await taskService.createSprint({
        name: sprintForm.name.trim(),
        startDate: sprintForm.startDate ?? undefined,
        endDate: sprintForm.endDate ?? undefined,
        projectId,
      });
      show("success", "Sprint created successfully");
      setSprintModal(false);
      setSprintForm({ name: "", startDate: null, endDate: null });
      void load();
    } catch {
      show("error", "Failed to create sprint");
    } finally {
      setSavingSprint(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      await projectService.deleteProject(projectId!);
      show("success", "Project deleted successfully");
      setTimeout(() => navigate(ROUTES.PROJECTS), 600);
    } catch {
      show("error", "Failed to delete project");
    } finally {
      setDeleteProjectModal(false);
    }
  };

  const handleAddMember = async (user: any) => {
    try {
      await projectService.addMember(projectId!, user.id);
      setMemberSearch("");
      setMemberResults([]);
      void load();
      show("success", `Added ${user.fullName}`);
    } catch {
      show("error", "Failed to add member");
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      await projectService.removeMember(projectId!, memberId);
      void load();
      show("success", `Removed ${memberName}`);
    } catch (e: any) {
      show("error", e?.response?.data?.meta?.message ?? "Failed to remove member");
    }
  };

  const isOwner = project?.createdById === userId;

  if (loading) return <div className="flex justify-center items-center min-h-screen"><Spin size="large" /></div>;
  if (!project) return <div className="p-8 text-center text-slate-500">Project not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(ROUTES.PROJECTS)}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shrink-0">
              <ArrowLeftIcon className="h-4 w-4 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
                <Tag color={project.status === "ACTIVE" ? "processing" : project.status === "COMPLETED" ? "success" : "default"}
                  className="m-0 text-xs font-semibold">
                  {project.status === "ACTIVE" ? "Active" : project.status === "COMPLETED" ? "Completed" : "Archived"}
                </Tag>
              </div>
              {project.description && (
                <p className="text-sm text-slate-500 mt-0.5">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setSprintModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition shadow-sm">
              <PlusIcon className="h-4 w-4" /> Create Sprint
            </button>
            {isOwner && (
              <button type="button" onClick={() => setDeleteProjectModal(true)}
                className="p-2 rounded-xl border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition">
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main: Sprint list */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Sprints ({sprints.length})
            </h2>

            {sprints.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
                <FolderIcon className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No sprints found</p>
                <p className="text-sm text-slate-400 mt-1">Create your first sprint to start managing tasks.</p>
                <button type="button" onClick={() => setSprintModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">
                  <PlusIcon className="h-4 w-4" /> Create Sprint
                </button>
              </div>
            ) : (
              sprints.map((sprint: any) => {
                const collapsed = collapsedSprints[sprint.id];
                const tasks = sprint.tasks ?? [];
                return (
                  <div key={sprint.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Sprint header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition"
                      onClick={() => setCollapsedSprints(prev => ({ ...prev, [sprint.id]: !prev[sprint.id] }))}>
                      <div className="flex items-center gap-3">
                        {collapsed
                          ? <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                          : <ChevronDownIcon className="h-4 w-4 text-slate-400" />}
                        <div>
                          <span className="font-bold text-slate-800">{sprint.name}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            {fmt(sprint.startDate)} – {fmt(sprint.endDate)}
                          </span>
                        </div>
                        <Tag color={SPRINT_STATUS_COLOR[sprint.status]} className="m-0 text-xs">
                          {sprint.status}
                        </Tag>
                      </div>
                      <span className="text-xs text-slate-400">{tasks.length} tasks</span>
                    </div>

                    {/* Tasks */}
                    {!collapsed && (
                      <div>
                        {tasks.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-6">No tasks in this sprint.</p>
                        ) : (
                          tasks.map((t: any) => {
                            const assigneeName = t.assignments?.[0]?.assigneeName ?? "Unassigned";
                            return (
                              <div key={t.id}
                                onClick={() => navigate(`/tasks/${t.id}`)}
                                className="group flex items-center justify-between px-5 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="text-sm text-slate-800 truncate font-medium">{t.title}</span>
                                  <Tag color={STATUS_COLOR[t.status]} className="m-0 text-[11px]">
                                    {t.status?.replace(/_/g, " ")}
                                  </Tag>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {t.dueAt && (
                                    <span className="text-xs text-slate-400">{fmt(t.dueAt)}</span>
                                  )}
                                  <Tooltip title={assigneeName}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm
                                      ${assigneeName === "Unassigned" ? "bg-slate-300" : "bg-[#172b4d]"}`}>
                                      {getInitials(assigneeName)}
                                    </div>
                                  </Tooltip>
                                </div>
                              </div>
                            );
                          })
                        )}
                        {/* Create task in sprint */}
                        <div className="px-5 py-3 text-xs text-slate-400 hover:bg-slate-50 cursor-pointer flex items-center gap-2 transition"
                          onClick={() => navigate(`/tasks/create?sprintId=${sprint.id}&projectId=${projectId}`)}>
                          <PlusIcon className="h-3.5 w-3.5" /> Create Task
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar: Project info + members */}
          <div className="space-y-4">
            {/* Project info */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-sm space-y-3">
              <p className="font-semibold text-slate-700">Project Information</p>
              {project.goal && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Goal</p>
                  <p className="text-slate-700 text-xs leading-relaxed">{project.goal}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>{fmt(project.startDate)} – {fmt(project.endDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <UserGroupIcon className="h-3.5 w-3.5" />
                <span>Created by: <span className="font-semibold text-slate-700">{project.createdByName}</span></span>
              </div>
            </div>

            {/* Members */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                Members ({project.members?.length ?? 0})
              </p>
              <div className="space-y-2 mb-3">
                {project.members?.map((m: any) => (
                  <div key={m.userId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#172b4d] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {getInitials(m.userName)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800 leading-tight">{m.userName}</p>
                        <p className="text-[10px] text-slate-400">{m.role === "OWNER" ? "Owner" : "Member"}</p>
                      </div>
                    </div>
                    {isOwner && m.role !== "OWNER" && (
                      <button type="button"
                        onClick={() => handleRemoveMember(m.userId, m.userName)}
                        className="text-slate-300 hover:text-red-400 transition">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add member */}
              {isOwner && (
                <div className="relative">
                  <Input size="small" placeholder="Add member..."
                    value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    className="rounded-lg text-xs" />
                  {memberResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {memberResults.map(u => (
                        <div key={u.id} onClick={() => handleAddMember(u)}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-orange-50 cursor-pointer text-xs">
                          <div className="w-6 h-6 rounded-full bg-[#172b4d] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            {getInitials(u.fullName)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{u.fullName}</p>
                            <p className="text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Sprint Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-orange-50 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-orange-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Create Sprint</span>
          </div>
        }
        open={sprintModal}
        onCancel={() => { setSprintModal(false); setSprintForm({ name: "", startDate: null, endDate: null }); }}
        onOk={handleCreateSprint}
        okText="Create Sprint"
        cancelText="Cancel"
        confirmLoading={savingSprint}
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
                value={sprintForm.startDate ?? ""}
                onChange={dStr => setSprintForm({ ...sprintForm, startDate: dStr || null })}
              />
            </div>
            <div>
              <DatePickerField
                label="End Date"
                value={sprintForm.endDate ?? ""}
                onChange={dStr => setSprintForm({ ...sprintForm, endDate: dStr || null })}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete project confirm */}
      <Modal
        title={
          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
            <span className="p-1.5 bg-rose-50 rounded-lg">
              <TrashIcon className="h-5 w-5 text-rose-500" />
            </span>
            <span className="font-bold text-slate-800 text-lg">Delete Project</span>
          </div>
        }
        open={deleteProjectModal}
        onCancel={() => setDeleteProjectModal(false)}
        onOk={handleDeleteProject}
        okText="Delete Project"
        cancelText="Cancel"
        className="rounded-2xl overflow-hidden [&>.ant-modal-content]:!rounded-2xl"
        okButtonProps={{ className: "bg-rose-500 hover:bg-rose-600 border-none rounded-xl h-10 px-5 text-sm font-semibold" }}
        cancelButtonProps={{ className: "rounded-xl h-10 px-5 text-sm font-semibold border-slate-200" }}
      >
        <p className="text-slate-600 mt-4 leading-relaxed">
          Are you sure you want to delete project <strong>{project.name}</strong>?
          Sprints in this project will not be deleted but they will no longer belong to this project.
        </p>
      </Modal>

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ProjectDetailPage;
