// process.env는 이 파일에서만 읽는다(OPS-02)
const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !process.env[key]);
if (missing.length) throw new Error(`필수 환경변수가 없습니다: ${missing.join(', ')}`);
// HS384 키 길이(384비트) 미만이면 기동 실패(W-07)
if (Buffer.byteLength(process.env.JWT_SECRET) < 48) throw new Error('JWT_SECRET은 48바이트 이상이어야 합니다');

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  port: Number(process.env.PORT) || 3000,
};
