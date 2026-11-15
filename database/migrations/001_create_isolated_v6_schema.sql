-- LDRS Version 6 staging schema, proposed from the actual Version 6 entity contracts.
-- SAFE WITH VERSION 5: all objects are created inside ldrs_v6 and none of the
-- existing public.users / public.documents / ... pilot tables are modified.
-- FOR FICTIONAL DEVELOPMENT DATA ONLY. Server authorization, encrypted photo
-- storage, OCR processing, officer OTP and audit hash verification are not wired.
-- Requires PostgreSQL 16+ and an account with CREATE privilege on the database.
BEGIN;

CREATE SCHEMA IF NOT EXISTS ldrs_v6;

CREATE TABLE IF NOT EXISTS ldrs_v6.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.pickup_points (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  point_type text NOT NULL CHECK(point_type IN ('Police station', 'Chief''s office', 'Other approved office')),
  location text NOT NULL,
  county text NOT NULL,
  contact_phone text,
  opening_hours text,
  verified boolean NOT NULL DEFAULT false,
  verification_note text,
  verified_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  phone_verified boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
  ldrs_role text CHECK(ldrs_role IN ('Owner','Finder','Officer')),
  approved boolean NOT NULL DEFAULT false,
  pickup_point_id uuid REFERENCES ldrs_v6.pickup_points(id),
  language text NOT NULL DEFAULT 'en' CHECK(language IN ('en','sw')),
  disabled boolean NOT NULL DEFAULT false,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  failed_logins integer NOT NULL DEFAULT 0 CHECK(failed_logins >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_user_role CHECK ((role='admin' AND ldrs_role IS NULL) OR (role='user' AND ldrs_role IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ldrs_v6_users_email ON ldrs_v6.users (lower(email));

CREATE TABLE IF NOT EXISTS ldrs_v6.documents (
  id uuid PRIMARY KEY,
  finder_user_id uuid REFERENCES ldrs_v6.users(id),
  document_type text NOT NULL,
  owner_name text,
  document_number text,
  found_location text NOT NULL,
  date_found date,
  pickup_point_id uuid NOT NULL REFERENCES ldrs_v6.pickup_points(id),
  image_url text,
  ocr_name_confidence numeric(5,2) CHECK(ocr_name_confidence BETWEEN 0 AND 100),
  ocr_number_confidence numeric(5,2) CHECK(ocr_number_confidence BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'Found' CHECK(status IN ('Found','Matched','Notified','Returned','Unclaimed')),
  returned_at timestamptz,
  image_sha256 text,
  image_phash text,
  ocr_used boolean NOT NULL DEFAULT false,
  ocr_name_accepted boolean,
  ocr_number_accepted boolean,
  duplicate_flag boolean NOT NULL DEFAULT false,
  duplicate_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicate_of_id uuid REFERENCES ldrs_v6.documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.loss_reports (
  id uuid PRIMARY KEY,
  owner_user_id uuid REFERENCES ldrs_v6.users(id),
  document_type text NOT NULL,
  owner_name text NOT NULL,
  document_number text,
  phone text NOT NULL,
  consent_given boolean NOT NULL DEFAULT false,
  date_lost date,
  status text NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Matched','Closed')),
  phone_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.matches (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES ldrs_v6.documents(id),
  loss_report_id uuid REFERENCES ldrs_v6.loss_reports(id),
  owner_user_id uuid REFERENCES ldrs_v6.users(id),
  match_score numeric(5,2) CHECK(match_score BETWEEN 0 AND 100),
  match_type text NOT NULL CHECK(match_type IN ('Exact','Fuzzy')),
  match_status text NOT NULL DEFAULT 'Pending' CHECK(match_status IN ('Pending','Confirmed','Rejected','Returned')),
  reference_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, loss_report_id)
);

CREATE TABLE IF NOT EXISTS ldrs_v6.claims (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES ldrs_v6.documents(id),
  document_type text,
  owner_user_id uuid REFERENCES ldrs_v6.users(id),
  owner_name text NOT NULL,
  phone text NOT NULL,
  document_number text,
  note text,
  status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
  match_id uuid REFERENCES ldrs_v6.matches(id),
  reference_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.handovers (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES ldrs_v6.documents(id),
  match_id uuid NOT NULL REFERENCES ldrs_v6.matches(id),
  officer_user_id uuid REFERENCES ldrs_v6.users(id),
  released_to text NOT NULL,
  claimant_id_type text CHECK(claimant_id_type IN ('National ID','Passport','Driver''s License','Employment ID','Other')),
  claimant_id_number text,
  verification_method text,
  notes text,
  pickup_point_id uuid REFERENCES ldrs_v6.pickup_points(id),
  integrity_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.notifications (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES ldrs_v6.users(id),
  phone text,
  message text NOT NULL,
  channel text NOT NULL DEFAULT 'In-app' CHECK(channel IN ('In-app','SMS')),
  sender text,
  language text NOT NULL DEFAULT 'en' CHECK(language IN ('en','sw')),
  delivery_status text NOT NULL DEFAULT 'In-app' CHECK(delivery_status IN ('In-app','Simulated','Sent','Pending','Failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.otp_codes (
  id uuid PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES ldrs_v6.matches(id),
  owner_user_id uuid REFERENCES ldrs_v6.users(id),
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Intentionally no otp_code plaintext column. The server must hash OTPs.

CREATE TABLE IF NOT EXISTS ldrs_v6.data_requests (
  id uuid PRIMARY KEY,
  owner_user_id uuid REFERENCES ldrs_v6.users(id),
  request_type text NOT NULL CHECK(request_type IN ('Access','Correction','Removal')),
  details text,
  status text NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Completed','Declined')),
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.audit_log (
  seq bigserial PRIMARY KEY,
  id uuid UNIQUE,
  user_id uuid REFERENCES ldrs_v6.users(id),
  action text NOT NULL,
  details text,
  actor_role text,
  prev_hash text,
  hash text,
  logged_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES ldrs_v6.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.challenges (
  id uuid PRIMARY KEY,
  challenge_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES ldrs_v6.users(id),
  purpose text NOT NULL,
  phone text,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ldrs_v6.uploads (
  id uuid PRIMARY KEY,
  file_uri text NOT NULL UNIQUE,
  uploaded_by uuid NOT NULL REFERENCES ldrs_v6.users(id),
  sha256 text,
  content_type text CHECK(content_type IN ('image/jpeg', 'image/png')),
  byte_length integer CHECK(byte_length >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
-- File bytes will reside in private, access-controlled server storage, not a public URL.

CREATE TABLE IF NOT EXISTS ldrs_v6.rate_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES ldrs_v6.users(id),
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_ldrs_v6_docs_type_status ON ldrs_v6.documents(document_type,status);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_docs_point ON ldrs_v6.documents(pickup_point_id);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_reports_owner ON ldrs_v6.loss_reports(owner_user_id,status);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_matches_owner ON ldrs_v6.matches(owner_user_id,match_status);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_matches_doc ON ldrs_v6.matches(document_id);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_claims_owner ON ldrs_v6.claims(owner_user_id,status);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_handover_doc ON ldrs_v6.handovers(document_id);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_notifications_user ON ldrs_v6.notifications(user_id,read);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_audit_actor ON ldrs_v6.audit_log(user_id,logged_at);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_sessions_expiry ON ldrs_v6.sessions(expires_at);
CREATE INDEX IF NOT EXISTS ix_ldrs_v6_rate_user_time ON ldrs_v6.rate_events(user_id,created_at);

INSERT INTO ldrs_v6.schema_migrations(version)
VALUES ('001_create_isolated_v6_schema')
ON CONFLICT (version) DO NOTHING;
COMMIT;
