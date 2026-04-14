// DB row (snake_case) → frontend object (camelCase)

export function mapProject(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    clientName: row.client_name,
    daysPerSprint: row.days_per_sprint,
    startDate: row.start_date,
    sprintCount: row.sprint_count,
    createdAt: row.created_at,
  };
}

export function mapDeveloper(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    order: row.order,
    createdAt: row.created_at,
  };
}

export function mapDayEntry(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    developerId: row.developer_id,
    date: row.date,
    worked: Number(row.worked),
    comment: row.comment,
  };
}

// Frontend object (camelCase) → DB row (snake_case)

export function toProjectRow(data) {
  const row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.clientName !== undefined) row.client_name = data.clientName;
  if (data.daysPerSprint !== undefined) row.days_per_sprint = data.daysPerSprint;
  if (data.startDate !== undefined) row.start_date = data.startDate;
  if (data.sprintCount !== undefined) row.sprint_count = data.sprintCount;
  return row;
}

export function toDeveloperRow(data) {
  const row = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.projectId !== undefined) row.project_id = data.projectId;
  if (data.startDate !== undefined) row.start_date = data.startDate;
  if (data.endDate !== undefined) row.end_date = data.endDate;
  if (data.order !== undefined) row.order = data.order;
  return row;
}

export function toDayEntryRow(data) {
  const row = {};
  if (data.projectId !== undefined) row.project_id = data.projectId;
  if (data.developerId !== undefined) row.developer_id = data.developerId;
  if (data.date !== undefined) row.date = data.date;
  if (data.worked !== undefined) row.worked = data.worked;
  if (data.comment !== undefined) row.comment = data.comment;
  return row;
}
