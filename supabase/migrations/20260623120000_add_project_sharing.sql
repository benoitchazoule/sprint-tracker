-- ============================================================
-- Sprint Tracker — Project sharing
-- ============================================================
-- Lets a project owner share a project with another existing user
-- (e.g. a stand-in facilitator covering an absence) and revoke that
-- share later. Shared users get full edit access to the project, its
-- developers and day entries — but cannot delete the project nor manage
-- its shares: those stay owner-only.

-- ── Sharing table ──
CREATE TABLE project_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_shares_project ON project_shares(project_id);
CREATE INDEX idx_project_shares_user ON project_shares(user_id);

-- ============================================================
-- Access helpers (SECURITY DEFINER to avoid RLS recursion between
-- projects and project_shares policies)
-- ============================================================

CREATE OR REPLACE FUNCTION is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION can_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM project_shares
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- ── Projects: owner OR shared user can read/update; owner-only delete ──
DROP POLICY IF EXISTS projects_select ON projects;
DROP POLICY IF EXISTS projects_update ON projects;
DROP POLICY IF EXISTS projects_delete ON projects;

-- The inline `user_id = auth.uid()` check is evaluated directly against the
-- candidate row, so it keeps `INSERT ... RETURNING` working for the owner — the
-- new row isn't yet visible to the sub-select inside can_access_project().
CREATE POLICY projects_select ON projects FOR SELECT
  USING (user_id = auth.uid() OR can_access_project(id));
CREATE POLICY projects_update ON projects FOR UPDATE
  USING (user_id = auth.uid() OR can_access_project(id))
  WITH CHECK (user_id = auth.uid() OR can_access_project(id));
CREATE POLICY projects_delete ON projects FOR DELETE
  USING (auth.uid() = user_id);
-- projects_insert is unchanged (auth.uid() = user_id).

-- ── Developers: scoped to anyone with access to the project ──
DROP POLICY IF EXISTS developers_select ON developers;
DROP POLICY IF EXISTS developers_insert ON developers;
DROP POLICY IF EXISTS developers_update ON developers;
DROP POLICY IF EXISTS developers_delete ON developers;

CREATE POLICY developers_select ON developers FOR SELECT
  USING (can_access_project(project_id));
CREATE POLICY developers_insert ON developers FOR INSERT
  WITH CHECK (can_access_project(project_id));
CREATE POLICY developers_update ON developers FOR UPDATE
  USING (can_access_project(project_id)) WITH CHECK (can_access_project(project_id));
CREATE POLICY developers_delete ON developers FOR DELETE
  USING (can_access_project(project_id));

-- ── Day entries: scoped to anyone with access to the project ──
DROP POLICY IF EXISTS day_entries_select ON day_entries;
DROP POLICY IF EXISTS day_entries_insert ON day_entries;
DROP POLICY IF EXISTS day_entries_update ON day_entries;
DROP POLICY IF EXISTS day_entries_delete ON day_entries;

CREATE POLICY day_entries_select ON day_entries FOR SELECT
  USING (can_access_project(project_id));
CREATE POLICY day_entries_insert ON day_entries FOR INSERT
  WITH CHECK (can_access_project(project_id));
CREATE POLICY day_entries_update ON day_entries FOR UPDATE
  USING (can_access_project(project_id)) WITH CHECK (can_access_project(project_id));
CREATE POLICY day_entries_delete ON day_entries FOR DELETE
  USING (can_access_project(project_id));

-- ── Project shares: owner manages; shared user may see their own row ──
CREATE POLICY project_shares_select ON project_shares FOR SELECT
  USING (is_project_owner(project_id) OR user_id = auth.uid());
CREATE POLICY project_shares_insert ON project_shares FOR INSERT
  WITH CHECK (is_project_owner(project_id));
CREATE POLICY project_shares_delete ON project_shares FOR DELETE
  USING (is_project_owner(project_id));

-- ============================================================
-- Guard: only the owner may archive/unarchive a project
-- ============================================================
-- Shared users have full edit access to a project's content, but
-- archiving (like deleting) is a lifecycle action reserved for the owner.
-- RLS can't compare OLD vs NEW values, so this is enforced by a trigger.

CREATE OR REPLACE FUNCTION guard_project_archive()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.archived IS DISTINCT FROM OLD.archived AND OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the project owner can archive a project';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_project_archive
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION guard_project_archive();

-- ============================================================
-- RPC: reorder developers — now also allowed for shared users
-- ============================================================

CREATE OR REPLACE FUNCTION reorder_developers(p_project_id UUID, p_ordered_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller can access the project (owner or shared)
  IF NOT can_access_project(p_project_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR i IN 1..array_length(p_ordered_ids, 1) LOOP
    UPDATE developers SET "order" = i - 1
    WHERE id = p_ordered_ids[i] AND project_id = p_project_id;
  END LOOP;
END;
$$;

-- ============================================================
-- RPC: share a project with an existing user by email
-- ============================================================

CREATE OR REPLACE FUNCTION share_project(p_project_id UUID, p_email TEXT)
RETURNS TABLE (id UUID, project_id UUID, user_id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_id UUID;
  v_share_id  UUID;
  v_created   TIMESTAMPTZ;
BEGIN
  -- Only the owner may share their project
  IF NOT is_project_owner(p_project_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Resolve the target user by email (case-insensitive)
  SELECT u.id INTO v_target_id
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_target_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_share_with_self';
  END IF;

  -- Idempotent: reuse the existing share if already present
  SELECT s.id, s.created_at INTO v_share_id, v_created
  FROM project_shares s
  WHERE s.project_id = p_project_id AND s.user_id = v_target_id;

  IF v_share_id IS NULL THEN
    INSERT INTO project_shares (project_id, user_id)
    VALUES (p_project_id, v_target_id)
    RETURNING project_shares.id, project_shares.created_at INTO v_share_id, v_created;
  END IF;

  RETURN QUERY
  SELECT v_share_id, p_project_id, v_target_id, lower(trim(p_email)), v_created;
END;
$$;

-- ============================================================
-- RPC: list the shares of a project (with user emails)
-- ============================================================

CREATE OR REPLACE FUNCTION get_project_shares(p_project_id UUID)
RETURNS TABLE (id UUID, user_id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anyone with access can see who the project is shared with
  IF NOT can_access_project(p_project_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT s.id, s.user_id, u.email::TEXT, s.created_at
  FROM project_shares s
  JOIN auth.users u ON u.id = s.user_id
  WHERE s.project_id = p_project_id
  ORDER BY s.created_at;
END;
$$;
