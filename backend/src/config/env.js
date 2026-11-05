// process.env는 이 파일에서만 읽는다(OPS-02)
const missing = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGINS'].filter((key) => !process.env[key]);
if (missing.length) throw new Error(`필수 환경변수가 없습니다: ${missing.join(', ')}`);
// HS384 키 길이(384비트) 미만이면 기동 실패(W-07)
if (Buffer.byteLength(process.env.JWT_SECRET) < 48) throw new Error('JWT_SECRET은 48바이트 이상이어야 합니다');

// 프론트 출처 허용 목록(SEC-07). 쉼표로 여러 개. 경로·끝 '/'가 붙으면 Origin 헤더와 같아지지 않으므로 기동 실패
const corsOrigins = process.env.CORS_ORIGINS.split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const badOrigins = corsOrigins.filter((o) => !URL.canParse(o) || new URL(o).origin !== o);
if (!corsOrigins.length || badOrigins.length) {
  throw new Error(`CORS_ORIGINS는 'https://app.example.com'처럼 출처만 쉼표로 적는다: ${badOrigins.join(', ')}`);
}

// 프론트와 API가 다른 사이트(예: 서로 다른 *.vercel.app)면 none이어야 쿠키가 실린다(SEC-02)
const cookieSameSite = process.env.COOKIE_SAMESITE || 'lax';
if (!['lax', 'none'].includes(cookieSameSite)) throw new Error('COOKIE_SAMESITE는 lax 또는 none이어야 합니다');

// 토큰 만료(SEC-02). 기본 액세스 15분, 리프레시 7일. 양의 정수만
const positiveInt = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${key}는 1 이상의 정수여야 합니다`);
  return Number(raw);
};
const accessTokenTtlMinutes = positiveInt('ACCESS_TOKEN_TTL_MINUTES', 15);
const refreshTokenTtlDays = positiveInt('REFRESH_TOKEN_TTL_DAYS', 7);

// 소셜 로그인(SOC-02). 제공자 키는 선택값이고 없으면 해당 경로가 404다. 끝 '/'는 제거
const trimUrl = (v) => v?.trim().replace(/\/+$/, '');
const port = Number(process.env.PORT) || 3000;
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  port,
  appUrl: trimUrl(process.env.APP_URL) || corsOrigins[0],
  apiUrl: trimUrl(process.env.API_URL) || `http://localhost:${port}`,
  oauth: { google: googleId && googleSecret ? { clientId: googleId, clientSecret: googleSecret } : null },
  corsOrigins,
  cookieSameSite,
  accessTokenTtlMs: accessTokenTtlMinutes * 60 * 1000,
  refreshTokenTtlMs: refreshTokenTtlDays * 24 * 60 * 60 * 1000,
};
