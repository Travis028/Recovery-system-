-- Read-only validation of the ldrs_v6 schema used by LDRS v6 (created by migration 001).
SELECT schema_name
FROM information_schema.schemata WHERE schema_name = 'ldrs_v6';

SELECT table_name
FROM information_schema.tables
WHERE table_schema='ldrs_v6' AND table_type='BASE TABLE'
ORDER BY table_name;

SELECT COUNT(*) AS tables_created
FROM information_schema.tables
WHERE table_schema='ldrs_v6' AND table_type='BASE TABLE';
-- Expected count: 17 (12 entities, four internal support tables, one migration ledger).

SELECT version, applied_at
FROM ldrs_v6.schema_migrations
ORDER BY applied_at DESC;

-- Verify Version 5 pilot tables still exist independently in public.
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('users','sessions','documents','loss_reports','matches','audit_log')
ORDER BY table_name;
