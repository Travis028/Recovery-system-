BEGIN;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, full_name text NOT NULL CHECK(length(full_name) BETWEEN 2 AND 150),
 email text NOT NULL UNIQUE, password_salt text NOT NULL, password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'Owner' CHECK(role IN ('Owner','Finder')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
 id uuid PRIMARY KEY, finder_id uuid NOT NULL REFERENCES users(id),
 document_type text NOT NULL, owner_name text NOT NULL,
 document_number_last4 text, found_location text NOT NULL,
 date_found date NOT NULL DEFAULT CURRENT_DATE,
 status text NOT NULL DEFAULT 'Found' CHECK(status IN ('Found','Matched','Returned')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS loss_reports (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id),
 document_type text NOT NULL, owner_name text NOT NULL,
 document_number_last4 text, last_seen_location text NOT NULL,
 status text NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Matched','Closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS matches (
 id uuid PRIMARY KEY, report_id uuid NOT NULL REFERENCES loss_reports(id),
 document_id uuid NOT NULL REFERENCES documents(id),
 score integer NOT NULL CHECK(score BETWEEN 0 AND 100),
 status text NOT NULL DEFAULT 'Potential' CHECK(status IN ('Potential','Rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(report_id,document_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
 resource_type text, resource_id uuid, logged_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS ix_reports_type ON loss_reports(document_type);
CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_matches_report ON matches(report_id);
COMMIT;
