import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mapProject, mapDeveloper, mapDayEntry, toProjectRow, toDeveloperRow, toDayEntryRow } from '../lib/mappers';
import { calculateSprints, calculateProjectSummary } from '../lib/calculateSprints';

// ── Projects ──

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at');
      if (error) throw error;
      setProjects(data.map(mapProject));
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = async (input) => {
    const { data: { user } } = await supabase.auth.getUser();
    const row = { ...toProjectRow(input), user_id: user.id };
    const { data, error } = await supabase
      .from('projects')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    const project = mapProject(data);
    setProjects((prev) => [...prev, project]);
    return project;
  };

  const updateProject = async (id, updates) => {
    const { data, error } = await supabase
      .from('projects')
      .update(toProjectRow(updates))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    const project = mapProject(data);
    setProjects((prev) => prev.map((p) => (p.id === id ? project : p)));
    return project;
  };

  const deleteProject = async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return { projects, loading, fetchProjects, createProject, updateProject, deleteProject };
}

// ── Developers ──

export function useDevelopers(projectId) {
  const [developers, setDevelopers] = useState([]);

  const fetchDevelopers = useCallback(async () => {
    if (!projectId) return;
    const { data, error } = await supabase
      .from('developers')
      .select('*')
      .eq('project_id', projectId)
      .order('order');
    if (error) throw error;
    setDevelopers(data.map(mapDeveloper));
  }, [projectId]);

  const addDeveloper = async ({ name, startDate, endDate }) => {
    // Get max order for this project
    const { data: existing } = await supabase
      .from('developers')
      .select('order')
      .eq('project_id', projectId)
      .order('order', { ascending: false })
      .limit(1);
    const maxOrder = existing?.[0]?.order ?? -1;

    const row = {
      ...toDeveloperRow({ name, startDate, endDate }),
      project_id: projectId,
      order: maxOrder + 1,
    };
    const { data, error } = await supabase
      .from('developers')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    const dev = mapDeveloper(data);
    setDevelopers((prev) => [...prev, dev]);
    return dev;
  };

  const updateDeveloper = async (id, updates) => {
    const { data, error } = await supabase
      .from('developers')
      .update(toDeveloperRow(updates))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    const dev = mapDeveloper(data);
    setDevelopers((prev) => prev.map((d) => (d.id === id ? dev : d)));
    return dev;
  };

  const removeDeveloper = async (id) => {
    const { error } = await supabase.from('developers').delete().eq('id', id);
    if (error) throw error;
    setDevelopers((prev) => prev.filter((d) => d.id !== id));
  };

  const reorderDevelopers = async (orderedIds) => {
    const { error } = await supabase.rpc('reorder_developers', {
      p_project_id: projectId,
      p_ordered_ids: orderedIds,
    });
    if (error) throw error;
    // Re-fetch to get updated order
    const { data } = await supabase
      .from('developers')
      .select('*')
      .eq('project_id', projectId)
      .order('order');
    const devs = (data || []).map(mapDeveloper);
    setDevelopers(devs);
    return devs;
  };

  return { developers, setDevelopers, fetchDevelopers, addDeveloper, updateDeveloper, removeDeveloper, reorderDevelopers };
}

// ── Sprints (computed client-side) ──

export function useSprints(projectId) {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSprints = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Fetch project, developers, and entries in parallel
      const [projectRes, devsRes, entriesRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('developers').select('*').eq('project_id', projectId).order('order'),
        supabase.from('day_entries').select('*').eq('project_id', projectId),
      ]);
      if (projectRes.error) throw projectRes.error;
      if (devsRes.error) throw devsRes.error;
      if (entriesRes.error) throw entriesRes.error;

      const project = mapProject(projectRes.data);
      const developers = (devsRes.data || []).map(mapDeveloper);
      const entries = (entriesRes.data || []).map(mapDayEntry);

      setSprints(calculateSprints(project, developers, entries));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return { sprints, loading, fetchSprints };
}

// ── Project Summaries (computed client-side) ──

export function useProjectSummaries() {
  const [summaries, setSummaries] = useState([]);

  const fetchSummaries = useCallback(async () => {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at');
      if (error) throw error;
      if (!projects || projects.length === 0) {
        setSummaries([]);
        return;
      }

      // Fetch all developers and entries for user's projects in parallel
      const projectIds = projects.map((p) => p.id);
      const [devsRes, entriesRes] = await Promise.all([
        supabase.from('developers').select('*').in('project_id', projectIds),
        supabase.from('day_entries').select('*').in('project_id', projectIds),
      ]);

      const allDevs = (devsRes.data || []).map(mapDeveloper);
      const allEntries = (entriesRes.data || []).map(mapDayEntry);

      const results = projects.map((row) => {
        const project = mapProject(row);
        const devs = allDevs.filter((d) => d.projectId === project.id);
        const entries = allEntries.filter((e) => e.projectId === project.id);
        return calculateProjectSummary(project, devs, entries);
      });

      setSummaries(results);
    } catch (e) {
      // Silently fail — summaries are a nice-to-have
    }
  }, []);

  return { summaries, fetchSummaries };
}

// ── Entries ──

export function useEntries(projectId) {
  const setEntry = async ({ developerId, date, worked, comment }) => {
    const row = toDayEntryRow({ projectId, developerId, date, worked, comment: comment || '' });
    const { data, error } = await supabase
      .from('day_entries')
      .upsert(row, { onConflict: 'project_id,developer_id,date' })
      .select()
      .single();
    if (error) throw error;
    return mapDayEntry(data);
  };

  const setBulkEntries = async (entries) => {
    const rows = entries.map((e) =>
      toDayEntryRow({ projectId: e.projectId || projectId, developerId: e.developerId, date: e.date, worked: e.worked, comment: e.comment || '' })
    );
    const { error } = await supabase
      .from('day_entries')
      .upsert(rows, { onConflict: 'project_id,developer_id,date' });
    if (error) throw error;
  };

  return { setEntry, setBulkEntries };
}

// ── Export / Import ──

export async function exportAllData() {
  const { data: { user } } = await supabase.auth.getUser();
  const [projectsRes, devsRes, entriesRes] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('developers').select('*'),
    supabase.from('day_entries').select('*'),
  ]);

  return {
    projects: (projectsRes.data || []).map(mapProject),
    developers: (devsRes.data || []).map(mapDeveloper),
    dayEntries: (entriesRes.data || []).map(mapDayEntry),
  };
}

export async function importAllData(data) {
  const { data: { user } } = await supabase.auth.getUser();

  // Insert projects
  if (data.projects?.length) {
    const rows = data.projects.map((p) => ({
      ...toProjectRow(p),
      id: p.id,
      user_id: user.id,
    }));
    const { error } = await supabase.from('projects').upsert(rows);
    if (error) throw error;
  }

  // Insert developers
  if (data.developers?.length) {
    const rows = data.developers.map((d) => ({
      ...toDeveloperRow(d),
      id: d.id,
      project_id: d.projectId,
    }));
    const { error } = await supabase.from('developers').upsert(rows);
    if (error) throw error;
  }

  // Insert entries
  if (data.dayEntries?.length) {
    // Batch in chunks of 500 to avoid payload limits
    const rows = data.dayEntries.map((e) => ({
      ...toDayEntryRow(e),
      id: e.id,
      project_id: e.projectId,
      developer_id: e.developerId,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from('day_entries').upsert(chunk);
      if (error) throw error;
    }
  }
}
