import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
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
import { isZhihuContentConfigured, searchZhihu } from './src/lib/zhihu-content.mjs';

const port = Number(process.env.PORT || process.env.API_PORT || 8787);
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(rootDir, 'dist');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveFrontend(urlPath, res) {
  const requested = decodeURIComponent(urlPath);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const candidate = path.resolve(distDir, relative);
  const insideDist = candidate === distDir || candidate.startsWith(`${distDir}${path.sep}`);
  let filePath = insideDist ? candidate : path.join(distDir, 'index.html');
  try {
    if (!(await stat(filePath)).isFile()) filePath = path.join(distDir, 'index.html');
  } catch {
    filePath = path.join(distDir, 'index.html');
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

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
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { service: 'if-road-api', mode: isLlmConfigured() || isZhihuContentConfigured() ? 'live' : 'demo', uptime: process.uptime(), capabilities: { oauth: isOAuthConfigured(), llm: isLlmConfigured(), zhihu_search: isZhihuContentConfigured() } });
    if (req.method === 'GET' && url.pathname === '/api/zhihu/search') {
      try {
        const items = await searchZhihu(url.searchParams.get('q'), { count: url.searchParams.get('count') });
        return send(res, 200, { source: 'zhihu', items });
      } catch (error) {
        return send(res, 502, error instanceof Error ? error.message : '知乎搜索失败');
      }
    }
    // ---- 成员 C：LLM 能力（零侵入，仅在既有服务上追加只读路由）----
    if (req.method === 'GET' && url.pathname === '/api/llm/config') {
      const cfg = llmConfig();
      return send(res, 200, {
        configured: isLlmConfigured(),
        base_url: cfg.baseUrl,
        model: cfg.model,
        analysis_model: cfg.analysisModel,
        models: SUPPORTED_MODELS,
        api_key_masked: maskKey(cfg.apiKey),
        key_source: process.env.ZHIHU_LLM_API_KEY ? 'ZHIHU_LLM_API_KEY' : (process.env.ZHIHU_ACCESS_SECRET ? 'ZHIHU_ACCESS_SECRET(fallback)' : 'none'),
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/llm/ping') {
      try {
        const result = await chat([{ role: 'user', content: url.searchParams.get('q') || '只回复两个字：收到' }], { model: llmConfig().analysisModel, timeoutMs: 45_000 });
        return send(res, 200, { llm_ok: true, model: result.model, reply: result.content, has_reasoning: Boolean(result.reasoning), latency_ms: result.latencyMs });
      } catch (error) {
        return send(res, 502, error instanceof Error ? error.message : 'LLM 调用失败');
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/llm/analyze') {
      const goal = url.searchParams.get('goal') || demoPath.goal;
      const stepIndex = Number(url.searchParams.get('step') || 1);
      const choiceText = url.searchParams.get('choice') || demoPath.steps[0].options[1].text;
      const fallback = () => analysisFor(stepIndex, { key: 'B', text: choiceText }, goal);
      if (url.searchParams.get('fallback') === '1') return send(res, 200, { source: 'fallback', stage: 'forced', ok: true, error: null, analysis: fallback() });
      if (!isLlmConfigured()) return send(res, 200, { source: 'fallback', stage: 'not-configured', ok: false, error: 'LLM 未配置', analysis: fallback() });
      const result = await generateAnalysis({ goal, stepIndex, choiceText, constraints: demoPath.constraints, history: [], evidence: [] }, { chat, fallback });
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
      // 黑客松回调的不同版本对 state 支持不一致：有的版本会原样返回，
      // 有的版本只返回 authorization_code。优先使用回调参数，缺失时使用
      // 本次浏览器请求中保存的 HttpOnly state，仍能保证请求与会话关联。
      const callbackState = url.searchParams.get('state');
      if (!isOAuthConfigured()) return fail('后端未配置 OAuth 凭证');
      if (!code) return fail('回调缺少授权码');
      const cookieState = parseCookies(req.headers.cookie)['ifroad_oauth_state'];
      if (!cookieState) return fail('登录请求已失效，请重新发起登录');
      const state = callbackState || cookieState;
      if (callbackState && cookieState !== callbackState) return fail('state 校验失败，请重新发起登录');
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
      let generation = { source: 'fallback', stage: isLlmConfigured() ? 'not-run' : 'not-configured', error: null };
      if (isLlmConfigured()) {
        try {
          const evidence = isZhihuContentConfigured()
            ? await searchZhihu(input.goal, { count: 3, timeoutMs: 5000 })
            : [];
          const generated = await generateAnalysis({
            goal: result.session.goal,
            stepIndex: 1,
            choiceText: '',
            constraints: result.session.constraints,
            history: [],
            evidence,
            initial: true,
          }, { chat, fallback: () => null, model: llmConfig().analysisModel, timeoutMs: 45_000 });
          generation = { ...generated.meta, stage: generated.stage, error: generated.error || null };
          if (generated.ok && !generated.data.terminal && generated.data.next_options?.length >= 2) {
            result.step.title = generated.data.title || result.step.title;
            result.step.options = generated.data.next_options.slice(0, 4).map((option) => ({
              key: option.key,
              text: option.text,
              meta: option.meta || '基于目标与知乎资料生成',
            }));
            result.step.evidence = evidence;
            result.step.generationSource = 'llm';
            result.step.generationStage = generated.stage;
            result.step.totalSteps = Math.min(10, Math.max(8, Number(generated.data.total_steps) || 8));
            result.step.stagePlan = Array.isArray(generated.data.stage_plan) ? generated.data.stage_plan : [];
            result.session.totalSteps = result.step.totalSteps;
            result.session.stagePlan = result.step.stagePlan;
          }
        } catch (error) {
          generation = { source: 'fallback', stage: 'request', error: error instanceof Error ? error.message : '实时服务失败' };
        }
      }
      return send(res, 201, { session_id: result.session.id, step: result.step, session: result.session, generation });
    }
    const chooseMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/choose$/);
    if (req.method === 'POST' && chooseMatch) {
      const input = await readJson(req);
      if (typeof input.option_key !== 'string') return send(res, 400, 'option_key is required');
      const result = demoStore.choose(chooseMatch[1], input.option_key);
      // 实时能力优先：LLM/知乎不可用时保留 DemoStore 分析，保证主流程不中断。
      const session = result.session;
      if (!result.nextStep) {
        result.analysis = { ...result.analysis, terminal: true, outcome: { status: 'success', title: '阶段规划完成', summary: `已完成围绕「${session.goal}」的 ${session.totalSteps || 8} 步学习决策。` }, next_options: [] };
      }
      const chosenStep = [...session.steps].reverse().find((step) => step.choiceKey === input.option_key && step.analysis);
      let generation = { source: 'fallback', stage: isLlmConfigured() ? 'not-run' : 'not-configured' };
      let liveEvidence = [];
      if (isLlmConfigured() && chosenStep) {
        const fallback = () => analysisFor(chosenStep.index, { key: chosenStep.choiceKey, text: chosenStep.choiceText }, session.goal);
        const history = session.steps
          .filter((step) => step.index <= chosenStep.index)
          .map((step) => ({ step: step.index, choice: step.choiceText, summary: step.summary }))
          .filter((step) => step.choice);
        let evidence = session.steps
          .flatMap((step) => [
            ...(Array.isArray(step.evidence) ? step.evidence : []),
            ...(Array.isArray(step.analysis?.evidence) ? step.analysis.evidence : []),
          ])
          .slice(-8);
        if (isZhihuContentConfigured()) {
          try {
            liveEvidence = await searchZhihu(`${session.goal} ${chosenStep.choiceText}`, { count: 3, timeoutMs: 5000 });
            if (liveEvidence.length) evidence = liveEvidence;
          } catch { /* 分析仍可使用会话中已有资料 */ }
        }
          const generated = await generateAnalysis({ goal: session.goal, stepIndex: chosenStep.index, choiceText: chosenStep.choiceText, constraints: session.constraints, history, evidence, stagePlan: session.stagePlan || [] }, { chat, fallback, model: llmConfig().analysisModel, timeoutMs: 45_000 });
        generation = { ...generated.meta, stage: generated.stage, error: generated.error || null };
        result.analysis = generated.data;
        if (generated.ok && generated.data?.terminal) {
          result.nextStep = null;
          result.analysis = { ...result.analysis, terminal: true };
        } else if (generated.ok && Array.isArray(generated.data?.next_options) && result.nextStep) {
          // 下一步选项由模型根据目标、约束和当前选择生成；模型失败时保留 Demo 模板。
          result.nextStep.options = generated.data.next_options.slice(0, 4).map((option) => ({
            key: option.key,
            text: option.text,
            meta: option.meta || '根据当前路径动态生成',
          }));
          result.nextStep.title = generated.data.next_question || session.stagePlan?.[chosenStep.index]?.question || result.nextStep.title;
        }
      }
    if (liveEvidence.length) {
      result.analysis = { ...result.analysis, evidence: liveEvidence };
    } else if (isZhihuContentConfigured() && !result.analysis?.evidence?.length) {
        try {
          const evidence = await searchZhihu(`${session.goal} ${chosenStep?.choiceText || ''}`, { count: 3, timeoutMs: 5000 });
          if (evidence.length) result.analysis = { ...result.analysis, evidence };
        } catch { /* source failure falls back to bundled evidence */ }
      }
      if (result.nextStep && Array.isArray(result.analysis?.next_options) && result.analysis.next_options.length >= 2) {
        result.nextStep.options = result.analysis.next_options.slice(0, 4).map((option) => ({ key: option.key, text: option.text, meta: option.meta || '根据当前路径动态生成' }));
      }
      return send(res, 200, { session: result.session, analysis: result.analysis, next_step: result.nextStep, generation });
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
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      if (await serveFrontend(url.pathname, res)) return;
    }
    return send(res, 404, 'route not found');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal error';
    const status = /not found/.test(message) ? 404 : /invalid|required|at least/.test(message) ? 400 : 500;
    return send(res, status, message);
  }
});

server.listen(port, () => console.log(`if-road API listening on http://localhost:${port}`));
