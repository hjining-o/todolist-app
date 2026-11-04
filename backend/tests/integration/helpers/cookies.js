// res의 Set-Cookie 헤더를 { [name]: { value, path, maxAge, expires, httpOnly, secure, sameSite } }로 파싱한다
export function parseSetCookie(res) {
  const out = {};
  for (const line of res.headers['set-cookie'] ?? []) {
    const [pair, ...attrs] = line.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');
    const cookie = { value: decodeURIComponent(pair.slice(eq + 1)), httpOnly: false, secure: false };
    for (const attr of attrs) {
      const i = attr.indexOf('=');
      const key = (i < 0 ? attr : attr.slice(0, i)).toLowerCase();
      const val = i < 0 ? '' : attr.slice(i + 1);
      if (key === 'path') cookie.path = val;
      else if (key === 'max-age') cookie.maxAge = Number(val);
      else if (key === 'expires') cookie.expires = new Date(val);
      else if (key === 'httponly') cookie.httpOnly = true;
      else if (key === 'secure') cookie.secure = true;
      else if (key === 'samesite') cookie.sameSite = val.toLowerCase();
    }
    out[pair.slice(0, eq)] = cookie;
  }
  return out;
}
