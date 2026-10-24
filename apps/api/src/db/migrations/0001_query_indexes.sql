CREATE INDEX IF NOT EXISTS projects_user_updated_idx ON projects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS runs_project_started_idx ON runs(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS run_events_run_id_idx ON run_events(run_id, id);
CREATE INDEX IF NOT EXISTS artifacts_run_kind_idx ON artifacts(run_id, kind);
CREATE INDEX IF NOT EXISTS shares_run_idx ON shares(run_id);
