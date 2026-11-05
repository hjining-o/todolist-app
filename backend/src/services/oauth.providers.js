import { env } from '../config/env.js';
import { AppError } from '../domain/errors.js';

// 제공자별로 다른 것은 URL·scope·프로필 파싱뿐이다. 키가 없으면 NOT_FOUND
const providers = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile',
    credentials: () => env.oauth.google,
    parseProfile: (p) => ({
      providerUserId: p.sub,
      email: typeof p.email === 'string' ? p.email.trim().toLowerCase() : null,
      emailVerified: p.email_verified === true,
      name: typeof p.name === 'string' ? p.name : '',
    }),
  },
};

export function getProvider(name) {
  const provider = Object.hasOwn(providers, name) ? providers[name] : null;
  if (!provider?.credentials()) throw AppError.of('NOT_FOUND');
  return { name, ...provider, ...provider.credentials() };
}

export const redirectUri = (name) => `${env.apiUrl}/api/auth/oauth/${name}/callback`;

export function authorizeUrl(provider, state) {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri(provider.name),
    response_type: 'code',
    scope: provider.scope,
    state,
  });
  return `${provider.authUrl}?${params}`;
}

async function fetchJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`OAuth 제공자 응답 ${res.status}`);
  return res.json();
}

// code로 액세스 토큰을 받아 프로필을 반환한다. 실패하면 던진다
export async function fetchProfile(provider, code) {
  const token = await fetchJson(provider.tokenUrl, {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: redirectUri(provider.name),
      grant_type: 'authorization_code',
    }),
  });
  const profile = await fetchJson(provider.profileUrl, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const parsed = provider.parseProfile(profile);
  if (typeof parsed.providerUserId !== 'string' || !parsed.providerUserId) throw new Error('프로필에 사용자 ID가 없습니다');
  return parsed;
}
