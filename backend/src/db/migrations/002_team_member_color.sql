-- 002 팀 캘린더 색상 (DB-06, 계획서 6.3 CL-02·CL-03)
-- 구성원마다 다른 개인 설정. NULL이면 화면이 내 팀 목록 순서로 자동 배정한다.
-- 허용 키는 backend/src/domain/team-color.js와 같아야 한다. CHECK는 이름을 붙이지 않는다(N-19).

BEGIN;

ALTER TABLE team_members
    ADD COLUMN color text NULL CHECK (color IN ('RED', 'ORANGE', 'YELLOW', 'GREEN', 'TEAL', 'BLUE', 'VIOLET', 'PINK'));

COMMIT;
