-- LDRS v6 migration 002: county / sub-county / ward / nearest landmark
-- for found documents (where found) and loss reports (where lost).
-- Safe to run more than once. Adds columns only; existing rows keep their data.
-- Apply with:  cd backend && npm run migrate
BEGIN;

ALTER TABLE ldrs_v6.documents
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS sub_county text,
  ADD COLUMN IF NOT EXISTS ward text,
  ADD COLUMN IF NOT EXISTS landmark text;

ALTER TABLE ldrs_v6.loss_reports
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS sub_county text,
  ADD COLUMN IF NOT EXISTS ward text,
  ADD COLUMN IF NOT EXISTS landmark text;

CREATE INDEX IF NOT EXISTS ix_ldrs_v6_docs_place ON ldrs_v6.documents(county, sub_county, ward);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_reports_place ON ldrs_v6.loss_reports(county, sub_county, ward);

INSERT INTO ldrs_v6.schema_migrations(version)
VALUES ('002_add_location_fields')
ON CONFLICT (version) DO NOTHING;
COMMIT;
