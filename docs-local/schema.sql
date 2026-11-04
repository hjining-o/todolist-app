-- TodoList 스키마 DDL (PostgreSQL 17)
-- 기준: docs/7-erd.md v0.4
-- 세션 시간대 Asia/Seoul은 연결별 SET 없이 ALTER DATABASE ... SET timezone으로 고정한다(PRD A28, OPS-14).
-- PK·FK·CHECK는 PostgreSQL 기본 이름, uq_·idx_만 이름을 붙인다(E-09).

BEGIN;

-- users
CREATE TABLE users (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         varchar(254) NOT NULL CHECK (email = lower(email)),
    password_hash text         NOT NULL,
    name          varchar(50)  NOT NULL CHECK (char_length(btrim(name)) >= 1),
    timezone      text         NOT NULL DEFAULT 'Asia/Seoul',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- teams
CREATE TABLE teams (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       varchar(50) NOT NULL CHECK (char_length(btrim(name)) >= 1),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_teams_name_lower ON teams (lower(btrim(name)));

-- team_members
CREATE TABLE team_members (
    team_id   uuid        NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
    user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    role      text        NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MANAGER', 'MEMBER')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);
CREATE UNIQUE INDEX uq_team_members_team_id_owner ON team_members (team_id) WHERE role = 'OWNER';
CREATE INDEX idx_team_members_user_id ON team_members (user_id);

-- categories
CREATE TABLE categories (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    name       varchar(50) NOT NULL CHECK (char_length(btrim(name)) >= 1),
    is_default boolean     NOT NULL DEFAULT false,
    CONSTRAINT uq_categories_id_owner_id UNIQUE (id, owner_id)
);
CREATE UNIQUE INDEX uq_categories_owner_id_name_lower ON categories (owner_id, lower(btrim(name)));
CREATE UNIQUE INDEX uq_categories_owner_id_default ON categories (owner_id) WHERE is_default;

-- todos
CREATE TABLE todos (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     uuid          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    category_id  uuid          NOT NULL,
    title        varchar(200)  NOT NULL CHECK (char_length(btrim(title)) >= 1),
    description  varchar(2000),
    start_at     timestamptz   NOT NULL,
    end_at       timestamptz   NOT NULL,
    completed    boolean       NOT NULL DEFAULT false,
    completed_at timestamptz,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now(), -- 트리거 없이 repository UPDATE 문에서 now() (E-11)
    CHECK (end_at >= start_at),
    CHECK (completed = (completed_at IS NOT NULL)),
    -- 다른 사람의 카테고리를 가리킬 수 없게 복합 FK (R7, E-04)
    FOREIGN KEY (category_id, owner_id) REFERENCES categories (id, owner_id) ON DELETE RESTRICT
);
CREATE INDEX idx_todos_owner_id_start_at_end_at ON todos (owner_id, start_at, end_at);
CREATE INDEX idx_todos_category_id ON todos (category_id);

-- todo_shares (소유자가 속한 팀인지는 service가 검증, R21)
CREATE TABLE todo_shares (
    todo_id   uuid        NOT NULL REFERENCES todos (id) ON DELETE CASCADE,
    team_id   uuid        NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
    shared_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (todo_id, team_id)
);
CREATE INDEX idx_todo_shares_team_id_todo_id ON todo_shares (team_id, todo_id);

-- todo_histories
CREATE TABLE todo_histories (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    todo_id    uuid        NOT NULL REFERENCES todos (id) ON DELETE CASCADE,
    actor_id   uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    action     text        NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'COMPLETED', 'UNCOMPLETED')),
    changes    jsonb       NOT NULL, -- 필드명별 { old, new } (ERD 3.5)
    changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_todo_histories_todo_id_changed_at ON todo_histories (todo_id, changed_at);

-- refresh_tokens (인증용 기술 테이블, ERD 3.6, E-15). 원문 대신 SHA-256 해시만 저장
CREATE TABLE refresh_tokens (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    token_hash text        NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash)
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

COMMIT;
