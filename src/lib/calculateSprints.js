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
              hasEntry: true,
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

// ── Consumption per sprint × developer ──
// Aggregates the day-level sprint data into the read-only view an
// assistant needs: how many days each developer consumed in each sprint,
// how many were missed (absences), and what is still only projected.

export function calculateConsumptionMatrix(sprints, developers, todayStr) {
  const today = todayStr || formatLocalDate(new Date());

  const emptyCell = () => ({ worked: 0, absent: 0, projected: 0, activeDays: 0 });

  const rows = sprints.map((sprint) => {
    const byDev = {};
    for (const dev of developers) byDev[dev.id] = emptyCell();

    let worked = 0;
    let absent = 0;
    let projected = 0;

    for (const day of sprint.days) {
      const isPast = day.date <= today;
      for (const dev of developers) {
        const devDay = day.developers[dev.id];
        if (!devDay || devDay.inactive) continue;
        const cell = byDev[dev.id];
        cell.activeDays += 1;
        if (isPast) {
          cell.worked += devDay.worked;
          cell.absent += 1 - devDay.worked;
          worked += devDay.worked;
          absent += 1 - devDay.worked;
        } else {
          cell.projected += devDay.worked;
          projected += devDay.worked;
        }
      }
    }

    const target = sprint.effectiveTarget ?? sprint.totalDays;
    const isCompleted = sprint.endDate < today || worked >= target;
    const isCurrent = !isCompleted && sprint.startDate <= today && sprint.endDate >= today;

    return {
      number: sprint.number,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      target,
      totalDays: sprint.totalDays,
      carryOver: sprint.carryOver || 0,
      delta: sprint.delta || 0,
      byDev,
      worked,
      absent,
      projected,
      progressPct: target > 0 ? Math.min(100, Math.round((worked / target) * 100)) : 0,
      status: isCompleted ? 'done' : isCurrent ? 'current' : 'upcoming',
    };
  });

  const totals = { byDev: {}, worked: 0, absent: 0, projected: 0, target: 0 };
  for (const dev of developers) totals.byDev[dev.id] = emptyCell();

  for (const row of rows) {
    totals.worked += row.worked;
    totals.absent += row.absent;
    totals.projected += row.projected;
    totals.target += row.target;
    for (const dev of developers) {
      const from = row.byDev[dev.id];
      const to = totals.byDev[dev.id];
      to.worked += from.worked;
      to.absent += from.absent;
      to.projected += from.projected;
      to.activeDays += from.activeDays;
    }
  }

  return { rows, totals };
}
