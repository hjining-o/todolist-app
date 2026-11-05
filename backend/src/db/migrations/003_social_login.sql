-- 003 소셜 로그인 (SOC-01, 계획서 1.3)
-- 소셜 전용 계정은 password_hash가 NULL이다.

BEGIN;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE user_identities (
    provider         text        NOT NULL CHECK (provider IN ('google')),
    provider_user_id text        NOT NULL,
    user_id          uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX ix_user_identities_user ON user_identities(user_id);

COMMIT;
