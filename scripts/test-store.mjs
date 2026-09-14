import assert from 'node:assert/strict';
import { DemoStore } from '../src/lib/demo-store.js';

const store = new DemoStore();
const created = store.createSession({ goal: '我想学会洛必达法则', scene: 'subject' });
assert.equal(created.step.index, 1);
assert.equal(created.step.options.length, 4);
const chosen = store.choose(created.session.id, 'B');
assert.equal(chosen.analysis.confidence, 0.86);
assert.equal(chosen.nextStep.index, 2);
assert.equal(store.timeline(created.session.id).length, 2);
assert.throws(() => store.choose(created.session.id, 'Z'), /invalid option_key/);
assert.throws(() => store.createSession({ goal: '' }), /goal/);
console.log('DemoStore checks passed');
