// 知乎黑客松 OAuth：state 管理、Token 交换、用户信息、应用会话。
// App Key、Access Secret、OAuth Token 仅存在于此后端模块，不进入前端。
import { randomBytes } from 'node:crypto';

const OAUTH_AUTHORIZE_URL = 'https://openapi.zhihu.com/authorize';
const OAUTH_TOKEN_URL = 'https://openapi.zhihu.com/access_token';
const OAUTH_USER_URL = 'https://openapi.zhihu.com/user';
const STATE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

// state -> { expiresAt }：短时有效期，回调时一次性消费
const pendingStates = new Map();
// sessionId -> { accessToken, expiresAt, user }：常驻单进程 Demo 会话
const sessions = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of pendingStates) {
    if (now > record.expiresAt) pendingStates.delete(key);
  }
  for (const [key, record] of sessions) {
    if (now > record.expiresAt) sessions.delete(key);
  }
}, 60_000).unref();

export const oauthConfig = () => ({
  appId: process.env.ZHIHU_OAUTH_APP_ID || '',
  appKey: process.env.ZHIHU_OAUTH_APP_KEY || '',
  redirectUri: process.env.ZHIHU_OAUTH_REDIRECT_URI || '',
});

export function isOAuthConfigured() {
  const { appId, appKey, redirectUri } = oauthConfig();
  return Boolean(appId && appKey && redirectUri);
}

export function buildAuthorizeUrl() {
  const { appId, redirectUri } = oauthConfig();
  const state = randomBytes(24).toString('base64url');
  pendingStates.set(state, { expiresAt: Date.now() + STATE_TTL_MS });
  const url = new URL(OAUTH_AUTHORIZE_URL);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

// 校验并原子消费 state：缺失、不匹配、过期、已使用均拒绝
export function consumeState(state) {
  if (!state || typeof state !== 'string') return { ok: false, reason: 'missing' };
  const record = pendingStates.get(state);
  if (!record) return { ok: false, reason: 'unknown_or_replayed' };
  pendingStates.delete(state);
  if (Date.now() > record.expiresAt) return { ok: false, reason: 'expired' };
  return { ok: true };
}

export function parseCookies(header) {
  const cookies = {};
  if (!header || typeof header !== 'string') return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    try {
      cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    }
  }
  return cookies;
}

export function createSession(accessToken, expiresIn, user) {
  const sessionId = randomBytes(24).toString('base64url');
  sessions.set(sessionId, {
    accessToken,
    expiresAt: Date.now() + (Number(expiresIn) || 3600) * 1000,
    user,
  });
  return sessionId;
}

export function getSession(sessionId) {
  const session = sessionId && sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function destroySession(sessionId) {
  if (sessionId) sessions.delete(sessionId);
}

// uid 为 int64，可能超出 JavaScript 安全整数范围：
// 在 JSON 解析阶段先以字符串捕获，避免精度丢失。
function parseUserJson(text) {
  const lossless = text.replace(/("uid"\s*:\s*)(-?\d+)/g, '$1"$2"');
  return JSON.parse(lossless);
}

export async function exchangeToken(authorizationCode) {
  const { appId, appKey, redirectUri } = oauthConfig();
  const body = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: authorizationCode,
  });
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`token 接口返回非 JSON（HTTP ${response.status}）`);
  }
  // 业务字段 code: 20000 表示成功；以 access_token 是否存在为准
  if (!payload.access_token) {
    throw new Error(payload.message || payload.error || `token 交换失败（HTTP ${response.status}）`);
  }
  return { accessToken: payload.access_token, expiresIn: Number(payload.expires_in || 3600) };
}

export async function fetchUserInfo(accessToken) {
  const response = await fetch(OAUTH_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let user;
  try {
    user = parseUserJson(text);
  } catch {
    throw new Error(`用户信息接口返回非 JSON（HTTP ${response.status}）`);
  }
  // 建立会话前确认响应包含有效用户标识
  if (!user || (user.uid === undefined && !user.hash_id)) {
    throw new Error('用户信息响应缺少有效标识');
  }
  return {
    id: user.uid !== undefined ? String(user.uid) : (user.hash_id || ''),
    name: user.fullname || '知乎用户',
    avatar: user.avatar_path || '',
    headline: user.headline || '',
  };
}
