-- LDRS v6 — read-only queries (schema ldrs_v6). Safe to run in VS Code's PostgreSQL extension.

-- Record counts
SELECT 'users' AS entity, count(*) FROM ldrs_v6.users
UNION ALL SELECT 'pickup_points', count(*) FROM ldrs_v6.pickup_points
UNION ALL SELECT 'documents', count(*) FROM ldrs_v6.documents
UNION ALL SELECT 'loss_reports', count(*) FROM ldrs_v6.loss_reports
UNION ALL SELECT 'matches', count(*) FROM ldrs_v6.matches
UNION ALL SELECT 'claims', count(*) FROM ldrs_v6.claims
UNION ALL SELECT 'handovers', count(*) FROM ldrs_v6.handovers
UNION ALL SELECT 'uploads', count(*) FROM ldrs_v6.uploads
UNION ALL SELECT 'notifications', count(*) FROM ldrs_v6.notifications;

-- Accounts (no password data)
SELECT email, role, ldrs_role, approved, phone_verified, disabled, failed_logins, locked_until
FROM ldrs_v6.users ORDER BY created_at;

-- Documents by status
SELECT status, count(*) FROM ldrs_v6.documents GROUP BY status ORDER BY status;

-- Latest matches
SELECT id, match_type, match_status, reference_code, created_at
FROM ldrs_v6.matches ORDER BY created_at DESC LIMIT 10;

-- Collection codes (only hashes are stored — there is no plaintext code column)
SELECT id, match_id, used, attempts, locked, expires_at
FROM ldrs_v6.otp_codes ORDER BY created_at DESC LIMIT 5;

-- Handovers
SELECT id, document_id, match_id, officer_user_id, created_at
FROM ldrs_v6.handovers ORDER BY created_at DESC LIMIT 5;

-- Latest audit events
SELECT logged_at, actor_role, action, details
FROM ldrs_v6.audit_log ORDER BY seq DESC LIMIT 20;

-- Unlock an account after test lockouts (WRITES — run only when needed)
-- UPDATE ldrs_v6.users SET failed_logins = 0, locked_until = NULL WHERE lower(email) = 'officer@ldrs.test';
