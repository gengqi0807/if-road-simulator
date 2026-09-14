import { randomUUID } from 'node:crypto';
import { analysisFor, buildGoalFirstStep, buildGoalNextStep, demoPath } from './demo-data.js';
import { isValidSessionInput } from './types.js';

export class DemoStore {
  constructor() { this.sessions = new Map(); }

  createSession(input) {
    if (!isValidSessionInput(input)) throw new Error('goal must be at least 2 characters');
    const id = randomUUID();
    const rootBranch = { id: randomUUID(), sessionId: id, parentBranchId: null, forkStepId: null, name: '主路径', status: 'active' };
    const firstTemplate = buildGoalFirstStep(input.goal, input.constraints || {});
    const first = this.#makeStep(id, rootBranch.id, 1, firstTemplate, null, null);
    const session = {
      id, goal: input.goal.trim(), scene: input.scene || 'subject',
      constraints: input.constraints || demoPath.constraints, status: 'active',
      totalSteps: 8, stagePlan: [],
      currentStepId: first.id, rootBranchId: rootBranch.id, steps: [first], branches: [rootBranch], createdAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return { session, step: first };
  }

  getSession(id) { return this.sessions.get(id) || null; }

  choose(id, optionKey) {
    const session = this.getSession(id);
    if (!session) throw new Error('session not found');
    const current = session.steps.find((step) => step.id === session.currentStepId);
    if (!current) throw new Error('current step not found');
    const option = current.options.find((item) => item.key === optionKey);
    if (!option) throw new Error('invalid option_key');
    const analysis = analysisFor(current.index, option, session.goal);
    current.choiceKey = option.key; current.choiceText = option.text; current.analysis = analysis;
    // Demo fallback 也必须围绕用户目标生成后续问题，不能复用洛必达模板。
    // 保留洛必达的既有演示路径以兼容历史演示数据。
    const nextTemplate = /洛必达|极限|微积分/.test(session.goal)
      ? demoPath.steps[Math.min(current.index, demoPath.steps.length - 1)]
      : buildGoalNextStep(session.goal, current.index + 1, option.text);
    const next = current.index >= (session.totalSteps || 8) ? null : this.#makeStep(id, current.branchId, current.index + 1, nextTemplate, current.id, null);
    next.analysis = null;
    if (next) { session.steps.push(next); session.currentStepId = next.id; }
    return { analysis, nextStep: next, session };
  }

  timeline(id) { const session = this.getSession(id); if (!session) throw new Error('session not found'); return session.steps; }

  backtrack(id, stepId) {
    const session = this.getSession(id);
    if (!session) throw new Error('session not found');
    const target = session.steps.find((step) => step.id === stepId);
    if (!target) throw new Error('step not found');
    const branch = { id: randomUUID(), sessionId: id, parentBranchId: target.branchId, forkStepId: target.id, name: `分支 ${session.branches.length}`, status: 'active' };
    const template = target.index === 1
      ? buildGoalFirstStep(session.goal, session.constraints)
      : buildGoalNextStep(session.goal, target.index, target.choiceText || '');
    const step = this.#makeStep(id, branch.id, target.index, template, target.parentStepId, null);
    session.branches.push(branch); session.steps.push(step); session.currentStepId = step.id; session.status = 'active';
    return { session, branch, step };
  }

  compare(id, branchAId, branchBId) {
    const session = this.getSession(id);
    if (!session) throw new Error('session not found');
    const branchA = session.branches.find((branch) => branch.id === branchAId);
    const branchB = session.branches.find((branch) => branch.id === branchBId);
    if (!branchA || !branchB) throw new Error('branch not found');
    const stepsFor = (branchId) => session.steps.filter((step) => step.branchId === branchId);
    const a = stepsFor(branchAId), b = stepsFor(branchBId);
    const total = (steps) => steps.reduce((sum, step) => sum + (step.metrics.time_days || 0), 0);
    const mastery = (steps) => steps.at(-1)?.metrics.mastery || 0;
    const metrics = { time_days: { a: total(a), b: total(b) }, mastery: { a: mastery(a), b: mastery(b) }, exam_benefit: { a: 0.55, b: 0.72 }, freshness_risk: { a: 0.35, b: 0.2 } };
    return { branch_a: branchA, branch_b: branchB, metrics, summary: metrics.time_days.a <= metrics.time_days.b ? '路径 A 更节省时间；路径 B 掌握度和考试收益更高。' : '路径 B 更节省时间；路径 A 掌握度和考试收益更高。' };
  }

  report(id) {
    const session = this.getSession(id);
    if (!session) throw new Error('session not found');
    const completed = session.steps.filter((step) => step.choiceText);
    const choices = completed.map((step) => `第${step.index}步选择「${step.choiceText}」`).join('；');
    return {
      id: randomUUID(), session_id: id, report_type: 'global', title: `${session.goal} · 学习决策复盘`,
      summary: `你围绕「${session.goal}」完成了 ${completed.length} 个决策。${choices || '尚未完成选择。'}`,
      guide: `如果你每天 ${session.constraints.daily_minutes || 60} 分钟、目标是${session.constraints.target === 'final_exam' ? '期末' : '兴趣学习'}，建议先补齐极限基础，再用题目验证洛必达法则的适用前提。`,
      freshness: [{ level: 'slightly_old', reason: '部分参考内容来自 2019 年，建议查看 2024 年更新资料。' }],
      steps: completed,
      created_at: new Date().toISOString(),
    };
  }

  publish(id) {
    const report = this.report(id);
    return { status: 'draft', title: report.title, content: `${report.guide}\n\n${report.summary}`, message: '已生成知乎发布草稿（模拟），请登录知乎后确认发布。' };
  }

  #makeStep(sessionId, branchId, index, template, parentStepId, choice) {
    return { id: randomUUID(), sessionId, branchId, parentStepId, index, choiceKey: choice?.key || null, choiceText: choice?.text || null, title: template.title, options: template.options, analysis: null, metrics: { time_days: index === 1 ? 0 : 2, mastery: index === 1 ? 0.28 : 0.42, exam_benefit: 0.35, risk: 0.2 }, evidence: [], freshness: [] };
  }
}

export const demoStore = new DemoStore();
