import http from 'node:http';
import { URL } from 'node:url';
import { demoStore } from './src/lib/demo-store.js';

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
