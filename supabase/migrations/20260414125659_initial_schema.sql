-- ============================================================
-- Sprint Tracker — Supabase schema
-- ============================================================

-- Projects
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  client_name TEXT,
  days_per_sprint INTEGER NOT NULL DEFAULT 18,
  start_date  DATE NOT NULL,
  sprint_count INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user ON projects(user_id);

-- Developers
CREATE TABLE developers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  start_date  DATE,
  end_date    DATE,
  "order"     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_developers_project ON developers(project_id);

-- Day entries
CREATE TABLE day_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  developer_id  UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  worked        NUMERIC(3,1) NOT NULL DEFAULT 1,
  comment       TEXT NOT NULL DEFAULT '',
  UNIQUE(project_id, developer_id, date)
);

CREATE INDEX idx_day_entries_project ON day_entries(project_id);
CREATE INDEX idx_day_entries_developer ON day_entries(developer_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_entries ENABLE ROW LEVEL SECURITY;

-- Projects: user can only see/modify their own
CREATE POLICY projects_select ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY projects_update ON projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY projects_delete ON projects FOR DELETE USING (auth.uid() = user_id);

-- Developers: scoped through project ownership
CREATE POLICY developers_select ON developers FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY developers_insert ON developers FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY developers_update ON developers FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY developers_delete ON developers FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Day entries: scoped through project ownership
CREATE POLICY day_entries_select ON day_entries FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY day_entries_insert ON day_entries FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY day_entries_update ON day_entries FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
CREATE POLICY day_entries_delete ON day_entries FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- ============================================================
-- RPC: Batch reorder developers
-- ============================================================

CREATE OR REPLACE FUNCTION reorder_developers(p_project_id UUID, p_ordered_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller owns the project
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = p_project_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    UPDATE developers SET "order" = i - 1
    WHERE id = p_ordered_ids[i] AND project_id = p_project_id;
  END LOOP;
END;
$$;
