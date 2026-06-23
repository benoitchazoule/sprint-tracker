-- ============================================================
-- Sprint Tracker — Add `archived` flag to projects
-- ============================================================
-- Lets users archive finished projects so they no longer clutter
-- the active list, while keeping all their data for later review.

ALTER TABLE projects
  ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_projects_archived ON projects(archived);
