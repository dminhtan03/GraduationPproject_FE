import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Spin, Empty } from "antd";
import {
  PlusIcon, FolderIcon, CalendarIcon, UserGroupIcon,
  PencilIcon, CheckIcon, XMarkIcon, CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { projectService } from "../../services/projectService";
import { userService } from "../../services/userService";
import { taskService } from "../../services/taskService";
import { ROUTES } from "../../constants";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "processing", COMPLETED: "success", ARCHIVED: "default",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", COMPLETED: "Completed", ARCHIVED: "Archived",
};

const fmt = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("vi-VN");
};

const getInitials = (name?: string) => {
  if (!name) return "?";
  return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
};

type EditState =
  | { projectId: string; field: "name"; value: string }
  | { projectId: string; field: "endDate"; value: string }
  | null;

const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const show = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const load = () => {
    Promise.all([projectService.listProjects(), userService.getMe()])
      .then(([projs, me]) => {
        setProjects(projs);
        setMyId(me?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 30);
  }, [editing]);

  const startEdit = (e: React.MouseEvent, projectId: string, field: "name" | "endDate", current: string) => {
    e.stopPropagation();
    e.preventDefault();
    setEditing({ projectId, field, value: current });
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(null);
  };

  const saveEdit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editing) return;
    setSaving(true);
    try {
      const payload = editing.field === "name"
        ? { name: editing.value.trim() }
        : { endDate: editing.value || null };
      if (editing.field === "name" && !editing.value.trim()) {
        setEditing(null);
        return;
      }
      await projectService.updateProject(editing.projectId, payload);
      setEditing(null);
      load();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") void saveEdit();
    if (e.key === "Escape") cancelEdit();
  };

  const isEditing = (projectId: string, field: string) =>
    editing?.projectId === projectId && editing?.field === field;

  const handleMarkComplete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setMarkingId(projectId);
    try {
      const allSprints: any[] = await taskService.listSprints();
      const sprints = allSprints.filter((s: any) => s.projectId === projectId);

      const incompleteSprints = sprints.filter((s: any) => s.status !== "COMPLETED");
      const allTasks = sprints.flatMap((s: any) => s.tasks ?? []);
      const incompleteTasks = allTasks.filter(
        (t: any) => t.status !== "DONE" && t.status !== "CANCELLED"
      );

      if (incompleteSprints.length > 0 || incompleteTasks.length > 0) {
        const parts: string[] = [];
        if (incompleteSprints.length > 0)
          parts.push(`${incompleteSprints.length} sprint chưa hoàn thành`);
        if (incompleteTasks.length > 0)
          parts.push(`${incompleteTasks.length} task chưa hoàn thành`);
        show("warning", `Vẫn còn nhiệm vụ chưa hoàn thành: ${parts.join(", ")}`);
        return;
      }

      await projectService.updateProject(projectId, { status: "COMPLETED" });
      show("success", "Project đã được đánh dấu hoàn thành!");
      load();
    } catch {
      show("error", "Không thể cập nhật trạng thái");
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage your projects and sprints.</p>
          </div>
          <button type="button" onClick={() => navigate(ROUTES.PROJECT_CREATE)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition shadow-sm">
            <PlusIcon className="h-4 w-4" /> Create Project
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" /></div>
        ) : projects.length === 0 ? (
          <Empty
            image={<FolderIcon className="h-20 w-20 text-slate-200 mx-auto" />}
            description={
              <div className="text-center">
                <p className="text-slate-500 font-medium">No projects found</p>
                <p className="text-sm text-slate-400 mt-1">Create your first project to get started.</p>
              </div>
            }
            className="py-20 bg-white rounded-3xl border border-slate-100 shadow-sm"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project: any) => {
              const isOwner = project.createdById === myId;
              const editingName = isEditing(project.id, "name");
              const editingEndDate = isEditing(project.id, "endDate");
              const anyEditingThisCard = editingName || editingEndDate;

              return (
                <div key={project.id}
                  onClick={() => !anyEditingThisCard && navigate(`/tasks?projectId=${project.id}`)}
                  className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm transition duration-200
                    ${anyEditingThisCard ? "cursor-default ring-2 ring-orange-300 shadow-md" : "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"}`}>

                  {/* Top row: name + status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                        <FolderIcon className="h-5 w-5 text-orange-500" />
                      </div>

                      {/* Editable name */}
                      {isOwner && editingName ? (
                        <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                          <input
                            ref={inputRef}
                            value={editing!.value}
                            onChange={e => setEditing({ ...editing!, value: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className="flex-1 font-bold text-slate-900 text-base border-b-2 border-orange-400 bg-transparent focus:outline-none min-w-0"
                          />
                          <button type="button" onClick={saveEdit} disabled={saving}
                            className="p-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition shrink-0">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={cancelEdit}
                            className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 transition shrink-0">
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0 group/name">
                          <p className={`font-bold text-slate-900 text-base truncate ${isOwner ? "cursor-text" : ""}`}
                            onClick={e => isOwner && startEdit(e, project.id, "name", project.name)}>
                            {project.name}
                          </p>
                          {isOwner && !anyEditingThisCard && (
                            <button type="button"
                              onClick={e => startEdit(e, project.id, "name", project.name)}
                              className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded hover:bg-slate-100 transition shrink-0">
                              <PencilIcon className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status — clickable to mark complete (owner + ACTIVE only) */}
                    {isOwner && project.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={e => handleMarkComplete(e, project.id)}
                        disabled={markingId === project.id}
                        title="Nhấn để đánh dấu hoàn thành"
                        className="shrink-0 group/status relative"
                      >
                        {markingId === project.id ? (
                          <Tag color="processing" className="m-0 text-xs font-semibold">
                            Đang kiểm tra...
                          </Tag>
                        ) : (
                          <>
                            <Tag color="processing"
                              className="m-0 text-xs font-semibold group-hover/status:opacity-0 transition-opacity">
                              Active
                            </Tag>
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/status:opacity-100 transition-opacity">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                                <CheckCircleIcon className="h-3 w-3" /> Hoàn thành?
                              </span>
                            </span>
                          </>
                        )}
                      </button>
                    ) : (
                      <Tag color={STATUS_COLOR[project.status]} className="m-0 shrink-0 text-xs font-semibold">
                        {STATUS_LABEL[project.status] ?? project.status}
                      </Tag>
                    )}
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">{project.description}</p>
                  )}

                  {/* Meta: dates + members */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    {/* Date range — endDate editable */}
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{fmt(project.startDate)} –</span>

                      {isOwner && editingEndDate ? (
                        <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            ref={inputRef}
                            type="date"
                            value={editing!.value}
                            onChange={e => setEditing({ ...editing!, value: e.target.value })}
                            onKeyDown={handleKeyDown}
                            className="text-xs border border-orange-300 rounded px-1 py-0 focus:outline-none focus:border-orange-500 bg-white"
                            disabled={saving}
                          />
                          <button type="button" onClick={saveEdit} disabled={saving}
                            className="p-0.5 text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                            <CheckIcon className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={cancelEdit}
                            className="p-0.5 text-slate-400 hover:text-slate-600">
                            <XMarkIcon className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 group/date ${isOwner ? "cursor-pointer" : ""}`}
                          onClick={e => isOwner && !anyEditingThisCard && startEdit(e, project.id, "endDate", project.endDate ?? "")}>
                          <span className={isOwner ? "hover:text-orange-500 transition" : ""}>
                            {fmt(project.endDate)}
                          </span>
                          {isOwner && !anyEditingThisCard && (
                            <PencilIcon className="h-3 w-3 text-slate-300 opacity-0 group-hover/date:opacity-100 transition" />
                          )}
                        </span>
                      )}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <UserGroupIcon className="h-3.5 w-3.5" />
                      {project.members?.length ?? 0} members
                    </span>
                  </div>

                  {/* Member avatars */}
                  {project.members?.length > 0 && (
                    <div className="flex items-center gap-1 mt-3">
                      {project.members.slice(0, 5).map((m: any) => (
                        <div key={m.userId} title={m.userName}
                          className="w-7 h-7 rounded-full bg-[#172b4d] flex items-center justify-center text-[10px] font-bold text-white border-2 border-white -ml-1 first:ml-0">
                          {getInitials(m.userName)}
                        </div>
                      ))}
                      {project.members.length > 5 && (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 border-2 border-white -ml-1">
                          +{project.members.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ProjectListPage;
