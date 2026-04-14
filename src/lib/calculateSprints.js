// Sprint calculation engine — ported from server/db.js
// Pure function: (project, developers, entries) → sprints[]

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isDevActiveOnDate(dev, dateStr) {
  if (dev.startDate && dateStr < dev.startDate) return false;
  if (dev.endDate && dateStr > dev.endDate) return false;
  return true;
}

export function calculateSprints(project, developers, entries) {
  if (!project || developers.length === 0) return [];

  // Build a lookup of entries: { "YYYY-MM-DD": { devId: { worked, comment } } }
  const entryMap = {};
  for (const e of entries) {
    if (!entryMap[e.date]) entryMap[e.date] = {};
    entryMap[e.date][e.developerId] = { worked: e.worked, comment: e.comment };
  }

  const sprints = [];
  let currentDate = parseDate(project.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxSprints = project.sprintCount || 10;
  let carryOver = 0;

  for (let sprintNum = 1; sprintNum <= maxSprints; sprintNum++) {
    // Skip weekends so sprint start date always falls on a weekday
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const effectiveTarget = project.daysPerSprint - carryOver;
    let daysConsumed = 0;
    const sprintStartDate = new Date(currentDate);
    const sprintDays = [];
    let calendarDays = 0;

    while (daysConsumed < effectiveTarget) {
      if (calendarDays++ > 365) break;

      const dateStr = formatLocalDate(currentDate);
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend) {
        const dayData = { date: dateStr, developers: {} };
        let dayTotal = 0;

        for (const dev of developers) {
          if (!isDevActiveOnDate(dev, dateStr)) {
            dayData.developers[dev.id] = { worked: 0, comment: '', inactive: true };
            continue;
          }

          const entry = entryMap[dateStr]?.[dev.id];
          const isPast = currentDate <= today;

          if (entry !== undefined) {
            dayData.developers[dev.id] = {
              worked: entry.worked,
              comment: entry.comment,
            };
            dayTotal += entry.worked;
          } else if (isPast) {
            dayData.developers[dev.id] = { worked: 1, comment: '' };
            dayTotal += 1;
          } else {
            dayData.developers[dev.id] = { worked: 1, comment: '', projected: true };
            dayTotal += 1;
          }
        }

        dayData.totalWorked = dayTotal;
        dayData.isWeekend = false;
        daysConsumed += dayTotal;
        dayData.cumulativeDays = daysConsumed;
        sprintDays.push(dayData);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const delta = daysConsumed - effectiveTarget;

    sprints.push({
      number: sprintNum,
      startDate: formatLocalDate(sprintStartDate),
      endDate: sprintDays[sprintDays.length - 1]?.date || formatLocalDate(sprintStartDate),
      daysConsumed,
      totalDays: project.daysPerSprint,
      effectiveTarget,
      carryOver,
      delta,
      days: sprintDays,
    });

    carryOver = delta;
  }

  return sprints;
}

export function calculateProjectSummary(project, developers, entries) {
  if (developers.length === 0) {
    return { projectId: project.id, currentSprintNumber: null, progressPct: 0, devCount: 0 };
  }

  const today = formatLocalDate(new Date());
  const sprints = calculateSprints(project, developers, entries);

  const currentSprint = sprints.find((s) => s.startDate <= today && s.endDate >= today)
    || sprints.find((s) => s.startDate > today)
    || sprints[sprints.length - 1];

  if (!currentSprint) {
    return { projectId: project.id, currentSprintNumber: null, progressPct: 0, devCount: developers.length };
  }

  const consumed = currentSprint.days
    .filter((d) => d.date <= today)
    .reduce((sum, d) => sum + d.totalWorked, 0);
  const effectiveTarget = currentSprint.effectiveTarget ?? project.daysPerSprint;
  const progressPct = effectiveTarget > 0 ? Math.round((consumed / effectiveTarget) * 100) : 0;

  return {
    projectId: project.id,
    currentSprintNumber: currentSprint.number,
    progressPct: Math.min(100, progressPct),
    devCount: developers.length,
  };
}
