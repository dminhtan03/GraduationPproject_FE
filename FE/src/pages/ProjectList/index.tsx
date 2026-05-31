import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tag, Spin, Empty } from "antd";
import { PlusIcon, FolderIcon, CalendarIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { projectService } from "../../services/projectService";
import { ROUTES } from "../../constants";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "processing", COMPLETED: "success", ARCHIVED: "default",
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active", COMPLETED: "Completed", ARCHIVED: "Archived",
};

const fmt = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("en-US");
};

const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectService.listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your projects and sprints.
            </p>
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
            {projects.map((project: any) => (
              <div key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition duration-200 cursor-pointer">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                      <FolderIcon className="h-5 w-5 text-orange-500" />
                    </div>
                    <p className="font-bold text-slate-900 text-base truncate">{project.name}</p>
                  </div>
                  <Tag color={STATUS_COLOR[project.status]} className="m-0 shrink-0 text-xs font-semibold">
                    {STATUS_LABEL[project.status] ?? project.status}
                  </Tag>
                </div>

                {/* Description */}
                {project.description && (
                  <p className="text-sm text-slate-500 line-clamp-2 mb-3">{project.description}</p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {fmt(project.startDate)} – {fmt(project.endDate)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectListPage;
