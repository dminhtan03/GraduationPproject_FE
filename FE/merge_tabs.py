import sys

with open('src/pages/TaskList/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

out = []
skip = False
for i, line in enumerate(lines):
    # Remove Sprint Kanban Board Tab button
    if '<button type="button" onClick={() => setActiveTab("board")}' in line:
        skip = True
    if skip and '</button>' in line:
        skip = False
        continue
    if skip:
        continue

    # Rename Backlog Pool Tab button
    if 'Backlog Pool' in line:
        out.append(line.replace('Backlog Pool', 'Backlog & Active Sprint\n          {activeSprint && <span className="ml-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full font-bold">Active Sprint</span>}'))
        continue
    if '{backlogTasks.length > 0 &&' in line:
        continue # Remove old badge

    # Skip old TAB 2
    if '{/* TAB 2: Sprint Kanban Board */}' in line:
        skip = True
    if skip and '{/* TAB 3: Backlog Pool & Sprints Organizer */}' in line:
        skip = False
        # Don't continue, we need to append TAB 3 comment

    if skip:
        continue

    # Inject Kanban Board for Active Sprint in TAB 3
    if '{/* Sprint Tasks */}' in line:
        injection = """                      {/* Sprint Tasks or Kanban Board */}
                      {sprint.status === "ACTIVE" ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50/30 border-t border-slate-200">
                          {[
                            { title: "To Do", status: "TODO", color: "border-t-4 border-t-slate-400 bg-slate-100/50" },
                            { title: "In Progress", status: "DOING", color: "border-t-4 border-t-blue-500 bg-blue-50/20" },
                            { title: "Currently Reviewing", status: "WAITING_REVIEW", color: "border-t-4 border-t-amber-500 bg-amber-50/20" },
                            { title: "Done", status: "DONE", color: "border-t-4 border-t-emerald-500 bg-emerald-50/20" }
                          ].map(col => {
                            const colTasks = sprintTasks.filter(t => t.status === col.status);
                            return (
                              <div key={col.status} onDragOver={onDragOver} onDrop={(e) => onDropColumn(e, col.status)}
                                className={`rounded-2xl p-4 border border-slate-200 min-h-[300px] flex flex-col gap-3 ${col.color}`}>
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
                                  <span className="font-bold text-slate-700 text-sm">{col.title}</span>
                                  <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-700 rounded-full font-bold">{colTasks.length}</span>
                                </div>
                                <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-1">
                                  {colTasks.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl py-8 text-xs text-slate-400 text-center">
                                      Drop tasks here
                                    </div>
                                  ) : (
                                    colTasks.map(task => (
                                      <div key={task.id} draggable onDragStart={(e) => onDragStart(e, task)}
                                        onClick={() => navigate(`/tasks/${task.id}`)}
                                        className="cursor-pointer bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-orange-200 transition duration-150 relative group">
                                        <p className="font-semibold text-slate-800 text-sm leading-snug truncate">{task.title}</p>
                                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px]">
                                          <span className="text-slate-400 font-medium">{task.assignments?.[0]?.assigneeName || "Unassigned"}</span>
                                          <Tag color={PRIORITY_COLOR[task.priority]} className="m-0 text-[9px] px-1">{task.priority}</Tag>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
"""
        out.append(injection)
        skip = True
    if skip and '<div className="px-4 py-2 text-xs' in line:
        out.append(line)
        out.append('                      )}\n')
        skip = False
        continue
    if skip:
        out.append(line)
        continue

    out.append(line)

with open('src/pages/TaskList/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(out)
print('DONE')
