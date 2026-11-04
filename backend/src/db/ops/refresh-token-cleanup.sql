-- 만료 리프레시 토큰 정리 (DB-05, W-08, OPS-24)
-- 운영 Supabase에만 1회 실행한다. 마이그레이션에 넣지 않는다(테스트 DB는 리셋 때마다 비워진다).
-- 선행: Dashboard → Database → Extensions에서 pg_cron 활성화
-- 만료된 행만 지운다. 폐기됐지만 만료 전인 행은 재사용 감지(API-06)에 필요하므로 남긴다.
-- 매일 04:00 (DB 시간대 Asia/Seoul 기준)
SELECT cron.schedule('refresh-token-cleanup', '0 4 * * *', $$DELETE FROM refresh_tokens WHERE expires_at < now()$$);
