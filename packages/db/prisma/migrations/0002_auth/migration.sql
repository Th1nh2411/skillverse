-- Bổ sung cho Auth.js (Google + email magic link) và onboarding.
-- Không thay đổi bảng/cột nào của db/schema.sql, chỉ thêm.
ALTER TABLE users ADD COLUMN email_verified timestamptz;
ALTER TABLE users ADD COLUMN onboarded_at   timestamptz;

CREATE TABLE auth_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                text NOT NULL,
  provider            text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token       text,
  access_token        text,
  expires_at          integer,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE auth_sessions (                 -- session cookie (web) và bearer token (mobile) dùng chung
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires       timestamptz NOT NULL
);

CREATE TABLE auth_verification_tokens (
  identifier text NOT NULL,
  token      text NOT NULL,
  expires    timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);
