import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['api-server.mjs'], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, API_PORT: '8788' } });
await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
const base = 'http://localhost:8788';
const create = await fetch(`${base}/api/sessions`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ goal: '我想学会洛必达法则' }) });
assert.equal(create.status, 201); const created = await create.json(); assert.equal(created.ok, true); assert.equal(created.data.step.index, 1);
const choose = await fetch(`${base}/api/sessions/${created.data.session_id}/choose`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ option_key: 'B' }) });
assert.equal(choose.status, 200); const chosen = await choose.json(); assert.equal(chosen.data.analysis.confidence, 0.86); assert.equal(chosen.data.next_step.index, 2);
const timeline = await fetch(`${base}/api/sessions/${created.data.session_id}/timeline`); const timelineBody = await timeline.json(); assert.equal(timelineBody.data.steps.length, 2);
const invalid = await fetch(`${base}/api/sessions/${created.data.session_id}/choose`, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ option_key: 'Z' }) }); assert.equal(invalid.status, 400);
const report = await fetch(`${base}/api/sessions/${created.data.session_id}/report`, { method: 'POST' }); assert.equal(report.status, 200); const reportBody = await report.json(); assert.equal(reportBody.data.report_type, 'global');
const publish = await fetch(`${base}/api/sessions/${created.data.session_id}/publish`, { method: 'POST' }); assert.equal(publish.status, 200); const publishBody = await publish.json(); assert.equal(publishBody.data.status, 'draft');
child.kill(); console.log('API checks passed');
