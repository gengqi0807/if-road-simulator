import http from 'node:http';
import { URL } from 'node:url';
import { demoStore } from './src/lib/demo-store.js';
import {
  buildAuthorizeUrl,
  consumeState,
  createSession,
  destroySession,
  exchangeToken,
  fetchUserInfo,
  getSession,
  isOAuthConfigured,
  oauthConfig,
  parseCookies,
} from './src/lib/zhihu-auth.mjs';
import { analysisFor, demoPath } from './src/lib/demo-data.js';
import { chat, isLlmConfigured, llmConfig, maskKey, SUPPORTED_MODELS } from './src/lib/zhihu-llm.mjs';
import { generateAnalysis } from './src/lib/llm-schema.mjs';

const port = Number(process.env.API_PORT || 8787);

const send = (res, status, data) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(JSON.stringify({ ok: status < 400, data: status < 400 ? data : null, error: status < 400 ? null : data }));
};

const redirect = (res, location, cookies = []) => {
  res.writeHead(302, { Location: location, ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
  res.end();
};

const readJson = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; if (body.length > 100_000) reject(new Error('request body too large')); });
  req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('invalid JSON')); } });
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, null);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { service: 'if-road-api', mode: 'demo', uptime: process.uptime() });
    // ---- 成员 C：LLM 能力（零侵入，仅在既有服务上追加只读路由）----
    if (req.method === 'GET' && url.pathname === '/api/llm/config') {
      const cfg = llmConfig();
      return send(res, 200, {
        configured: isLlmConfigured(),
        base_url: cfg.baseUrl,
        model: cfg.model,
        models: SUPPORTED_MODELS,
        api_key_masked: maskKey(cfg.apiKey),
        key_source: process.env.ZHIHU_LLM_API_KEY ? 'ZHIHU_LLM_API_KEY' : (process.env.ZHIHU_ACCESS_SECRET ? 'ZHIHU_ACCESS_SECRET(fallback)' : 'none'),
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/llm/ping') {
      try {
        const result = await chat([{ role: 'user', content: url.searchParams.get('q') || '只回复两个字：收到' }], { timeoutMs: 15_000 });
        return send(res, 200, { llm_ok: true, model: result.model, reply: result.content, has_reasoning: Boolean(result.reasoning), latency_ms: result.latencyMs });
      } catch (error) {
        return send(res, 502, error instanceof Error ? error.message : 'LLM 调用失败');
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/llm/analyze') {
      const goal = url.searchParams.get('goal') || demoPath.goal;
      const stepIndex = Number(url.searchParams.get('step') || 1);
      const choiceText = url.searchParams.get('choice') || demoPath.steps[0].options[1].text;
      const fallback = () => analysisFor(stepIndex, { key: 'B', text: choiceText });
      if (url.searchParams.get('fallback') === '1') return send(res, 200, { source: 'fallback', stage: 'forced', ok: true, error: null, analysis: fallback() });
      if (!isLlmConfigured()) return send(res, 200, { source: 'fallback', stage: 'not-configured', ok: false, error: 'LLM 未配置', analysis: fallback() });
      const result = await generateAnalysis({ goal, stepIndex, choiceText, constraints: demoPath.constraints }, { chat, fallback });
      return send(res, 200, { source: result.meta.source, stage: result.stage, ok: result.ok, error: result.error, latency_ms: result.meta.latency_ms ?? null, analysis: result.data });
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/zhihu/start') {
      if (!isOAuthConfigured()) return send(res, 503, 'OAuth 未配置：请检查 .env 中的 ZHIHU_OAUTH_APP_ID / ZHIHU_OAUTH_APP_KEY / ZHIHU_OAUTH_REDIRECT_URI');
      const { url: authorizeUrl, state } = buildAuthorizeUrl();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `ifroad_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300`,
      });
      return res.end(JSON.stringify({ ok: true, data: { authorize_url: authorizeUrl } }));
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/zhihu/callback') {
      const frontendOrigin = new URL(oauthConfig().redirectUri).origin;
      const fail = (message) => redirect(res, `${frontendOrigin}/?login_error=${encodeURIComponent(message)}`);
      const code = url.searchParams.get('authorization_code') || url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!isOAuthConfigured()) return fail('后端未配置 OAuth 凭证');
      if (!code) return fail('回调缺少授权码');
      if (!state) return fail('回调缺少 state 参数');
      const cookieState = parseCookies(req.headers.cookie)['ifroad_oauth_state'];
      if (!cookieState) return fail('登录请求已失效，请重新发起登录');
      if (cookieState !== state) return fail('state 校验失败，请重新发起登录');
      const consumed = consumeState(state);
      if (!consumed.ok) return fail(consumed.reason === 'expired' ? 'state 已过期，请重新发起登录' : 'state 已失效或已被使用');
      try {
        const token = await exchangeToken(code);
        const user = await fetchUserInfo(token.accessToken);
        const sessionId = createSession(token.accessToken, token.expiresIn, user);
        return redirect(res, `${frontendOrigin}/?login=success`, [
          `ifroad_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
          'ifroad_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        ]);
      } catch (error) {
        return fail(error instanceof Error ? error.message : '登录失败');
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/zhihu/me') {
      const session = getSession(parseCookies(req.headers.cookie)['ifroad_session']);
      if (!session) return send(res, 401, '未登录或会话已过期');
      return send(res, 200, { user: { id: session.user.id, name: session.user.name, avatar: session.user.avatar, headline: session.user.headline } });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/zhihu/logout') {
      destroySession(parseCookies(req.headers.cookie)['ifroad_session']);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': 'ifroad_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      });
      return res.end(JSON.stringify({ ok: true, data: null }));
    }
    if (req.method === 'POST' && url.pathname === '/api/sessions') {
      const input = await readJson(req);
      const result = demoStore.createSession(input);
      return send(res, 201, { session_id: result.session.id, step: result.step, session: result.session });
    }
    const chooseMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/choose$/);
    if (req.method === 'POST' && chooseMatch) {
      const input = await readJson(req);
      if (typeof input.option_key !== 'string') return send(res, 400, 'option_key is required');
      const result = demoStore.choose(chooseMatch[1], input.option_key);
      return send(res, 200, { session: result.session, analysis: result.analysis, next_step: result.nextStep });
    }
    const timelineMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/timeline$/);
    if (req.method === 'GET' && timelineMatch) return send(res, 200, { steps: demoStore.timeline(timelineMatch[1]) });
    const backtrackMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/backtrack$/);
    if (req.method === 'POST' && backtrackMatch) {
      const input = await readJson(req);
      if (typeof input.step_id !== 'string') return send(res, 400, 'step_id is required');
      return send(res, 200, demoStore.backtrack(backtrackMatch[1], input.step_id));
    }
    if (req.method === 'POST' && url.pathname === '/api/compare') {
      const input = await readJson(req);
      if (!input.session_id || !input.branch_a_id || !input.branch_b_id) return send(res, 400, 'session_id, branch_a_id and branch_b_id are required');
      return send(res, 200, demoStore.compare(input.session_id, input.branch_a_id, input.branch_b_id));
    }
    const reportMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/report$/);
    if (req.method === 'POST' && reportMatch) return send(res, 200, demoStore.report(reportMatch[1]));
    const publishMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/publish$/);
    if (req.method === 'POST' && publishMatch) return send(res, 200, demoStore.publish(publishMatch[1]));
    return send(res, 404, 'route not found');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal error';
    const status = /not found/.test(message) ? 404 : /invalid|required|at least/.test(message) ? 400 : 500;
    return send(res, status, message);
  }
});

server.listen(port, () => console.log(`if-road API listening on http://localhost:${port}`));
