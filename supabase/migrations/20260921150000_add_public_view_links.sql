-- ============================================================
-- Sprint Tracker — Public read-only share links
-- ============================================================
-- Lets a project owner publish a secret, revocable URL giving
-- read-only access to a project's consumption figures (days consumed
-- per sprint, per developer) — typically for an assistant who has no
-- account on the app.
--
-- Security model:
--   * The link row lives in `project_public_links`; RLS restricts every
--     operation on it to the project owner.
--   * Anonymous visitors never touch the tables directly. They call
--     `get_shared_project(token)`, a SECURITY DEFINER function that
--     returns ONLY the fields needed to compute consumption, and only
--     for the single project the (non-revoked) token points at.
--   * Absence comments are deliberately NOT exposed: they often carry
--     personal context (sick leave, etc.) that a consumption view
--     doesn't need.

-- ── Token generator ──
-- 64 hex chars from two UUIDs — no pgcrypto dependency, ~128 bits of
-- entropy, URL-safe.
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
AS $$
  SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
$$;

-- ── Link table ──
CREATE TABLE project_public_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE DEFAULT generate_share_token(),
  label       TEXT NOT NULL DEFAULT '',
  created_by  UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX idx_project_public_links_project ON project_public_links(project_id);
CREATE UNIQUE INDEX idx_project_public_links_token ON project_public_links(token);

ALTER TABLE project_public_links ENABLE ROW LEVEL SECURITY;

-- Only the project owner may see or manage its public links.
-- (Shared editors get edit access to the data, but publishing a project
-- to the outside world stays an owner decision — like delete/archive.)
CREATE POLICY project_public_links_select ON project_public_links FOR SELECT
  USING (is_project_owner(project_id));
CREATE POLICY project_public_links_insert ON project_public_links FOR INSERT
  WITH CHECK (is_project_owner(project_id) AND created_by = auth.uid());
CREATE POLICY project_public_links_update ON project_public_links FOR UPDATE
  USING (is_project_owner(project_id)) WITH CHECK (is_project_owner(project_id));
CREATE POLICY project_public_links_delete ON project_public_links FOR DELETE
  USING (is_project_owner(project_id));

-- ============================================================
-- RPC: read a shared project by token (anonymous access)
-- ============================================================
-- Returns the minimal payload the read-only consumption view needs.
-- Raises `invalid_token` when the token is unknown or revoked.

CREATE OR REPLACE FUNCTION get_shared_project(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_project_id UUID;
  v_result     JSONB;
BEGIN
  SELECT l.project_id INTO v_project_id
  FROM project_public_links l
  WHERE l.token = p_token AND l.revoked_at IS NULL;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  SELECT jsonb_build_object(
    'project', (
      SELECT jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'client_name', p.client_name,
        'days_per_sprint', p.days_per_sprint,
        'start_date', p.start_date,
        'sprint_count', p.sprint_count,
        'archived', p.archived
      )
      FROM projects p WHERE p.id = v_project_id
    ),
    'developers', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'project_id', d.project_id,
          'name', d.name,
          'start_date', d.start_date,
          'end_date', d.end_date,
          'order', d."order"
        ) ORDER BY d."order"
      )
      FROM developers d WHERE d.project_id = v_project_id
    ), '[]'::jsonb),
    -- Comments are intentionally omitted (see header).
    'day_entries', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'project_id', e.project_id,
          'developer_id', e.developer_id,
          'date', e.date,
          'worked', e.worked,
          'comment', ''
        )
      )
      FROM day_entries e WHERE e.project_id = v_project_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Anonymous visitors must be able to call it; the token is the credential.
REVOKE ALL ON FUNCTION get_shared_project(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_project(TEXT) TO anon, authenticated;
