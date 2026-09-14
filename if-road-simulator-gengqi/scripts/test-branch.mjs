import assert from 'node:assert/strict';
import { DemoStore } from '../src/lib/demo-store.js';

const store = new DemoStore();
const created = store.createSession({ goal: '我想学会洛必达法则' });
const first = created.step;
store.choose(created.session.id, 'B');
const fork = store.backtrack(created.session.id, first.id);
assert.equal(fork.branch.parentBranchId, first.branchId);
assert.equal(fork.step.index, first.index);
assert.notEqual(fork.branch.id, first.branchId);
assert.equal(store.timeline(created.session.id).length, 3);
const comparison = store.compare(created.session.id, first.branchId, fork.branch.id);
assert.equal(comparison.metrics.time_days.a, 2);
assert.equal(typeof comparison.summary, 'string');
assert.throws(() => store.backtrack(created.session.id, 'missing'), /step not found/);
assert.throws(() => store.compare(created.session.id, first.branchId, 'missing'), /branch not found/);
console.log('Branch checks passed');
