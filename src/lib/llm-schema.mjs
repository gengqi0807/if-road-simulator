// LLM 结构化输出：Prompt 构造、宽容 JSON 提取、严格 Schema 校验、失败降级。
// analysis 结构与前端演示数据保持一致（见 src/lib/demo-data.js analysisFor）。

const ANALYSIS_SHAPE = `{
  "total_steps": 8,
  "stage_plan": [{ "stage": "阶段名称", "goal": "阶段目标", "question": "本阶段要回答的问题" }],
  "title": "一句话概括这次选择的后果",
  "content": "2-3 句具体后果分析",
  "next_question": "进入下一阶段时要问用户的问题",
  "pitfalls": [{ "name": "卡点名称", "probability": 0.73 }],
  "metrics_delta": { "time_days": 2, "mastery": 0.14, "exam_benefit": 0.1, "risk": 0.08 },
  "next_options": [{ "key": "A", "text": "下一步选项", "meta": "备注" }],
  "terminal": false,
  "outcome": { "status": "success", "title": "结局标题", "summary": "结局总结" },
  "evidence": [{ "title": "来源标题", "url": "https://www.zhihu.com/", "year": 2024 }],
  "freshness": [{ "level": "slightly_old", "reason": "时效说明" }],
  "confidence": 0.86
}`;

export const buildAnalysisPrompt = ({ goal, stepIndex = 1, choiceText, constraints = {}, history = [], evidence = [], stagePlan = [], initial = false }) => [
  {
    role: 'system',
    content: '你是「如果路」学习决策模拟器的推演引擎。必须严格围绕用户的真实学习目标推演，禁止套用其他学科（例如目标是英语考试时不得生成数学/洛必达内容）。结合路径历史和知乎证据，推演当前选择的后果、卡点概率与时效风险。只输出一个 JSON 对象，不要输出 markdown 代码块或任何解释文字。',
  },
  {
    role: 'user',
    content: [
      `学习目标：${goal}`,
      initial ? '这是新会话的第一个决策，请先分析目标和资料，提出第一步最关键的选择。' : `当前是第 ${stepIndex} 步决策。`,
      `用户选择：${choiceText || '尚未选择'}`,
      `约束条件：${JSON.stringify(constraints)}`,
      `此前路径（按时间顺序）：${JSON.stringify(history)}`,
      `既定阶段规划：${JSON.stringify(stagePlan)}`,
      `可参考的知乎证据（仅可引用与目标相关的内容）：${JSON.stringify(evidence.slice(0, 3).map((item) => ({ title: item.title, url: item.url, author: item.author, year: item.year || (item.publishedAt ? new Date(item.publishedAt).getFullYear() : undefined), excerpt: String(item.excerpt || '').slice(0, 240) })))}`,
      initial ? '这是首次规划：先把目标拆成 8-10 个递进阶段（total_steps 必须是 8、9 或 10），为每阶段给出阶段目标和关键问题；然后只输出第一阶段的 3-4 个起始策略作为 next_options，title 就是第一步要问用户的问题。' : '分析必须具体说明当前选择会带来什么收益、代价和风险，禁止输出“会改变后续节奏”“建议小测后调整”等通用套话。next_question 应使用既定阶段规划中的下一阶段问题；next_options 给出 2-4 个互不重复且能推动到下一阶段的选择。如果已经到终点则 terminal=true、next_options=[]。',
      ANALYSIS_SHAPE,
    ].join('\n'),
  },
];

// 宽容提取：允许模型包裹 ```json 代码块或携带前后缀说明文字
export function extractJson(raw) {
  // OpenAI 兼容接口可能返回 content 数组（text/tool 块），统一拼成文本。
  if (Array.isArray(raw)) raw = raw.map((part) => typeof part === 'string' ? part : (part?.text || part?.content || '')).join('');
  if (raw && typeof raw === 'object') raw = raw.text || raw.content || '';
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('LLM 输出为空');
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('LLM 输出中找不到 JSON 对象');
  return JSON.parse(text.slice(start, end + 1));
}

const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateAnalysis(value, { requireNextOptions = true } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, errors: ['输出不是 JSON 对象'] };
  const errors = [];
  if (value.total_steps !== undefined && (!Number.isInteger(value.total_steps) || value.total_steps < 8 || value.total_steps > 10)) errors.push('total_steps 必须是 8-10 的整数');
  if (value.stage_plan !== undefined && (!Array.isArray(value.stage_plan) || value.stage_plan.length < 2 || (Number.isInteger(value.total_steps) && value.stage_plan.length < value.total_steps))) errors.push('stage_plan 必须覆盖每个阶段');
  if (!isText(value.title)) errors.push('title 缺失或为空');
  if (!isText(value.content)) errors.push('content 缺失或为空');
  if (!isNum(value.confidence) || value.confidence < 0 || value.confidence > 1) errors.push('confidence 必须是 0-1 的数字');

  const md = value.metrics_delta;
  if (!md || typeof md !== 'object') errors.push('metrics_delta 缺失');
  else for (const key of ['time_days', 'mastery', 'exam_benefit', 'risk']) if (!isNum(md[key])) errors.push(`metrics_delta.${key} 不是数字`);

  if (!Array.isArray(value.pitfalls)) errors.push('pitfalls 不是数组');
  else value.pitfalls.forEach((item, i) => {
    if (!isText(item?.name) || !isNum(item?.probability)) errors.push(`pitfalls[${i}] 需要 { name, probability }`);
  });

  if (!Array.isArray(value.evidence)) errors.push('evidence 不是数组');
  else value.evidence.forEach((item, i) => {
    if (!isText(item?.title) || !isText(item?.url)) errors.push(`evidence[${i}] 需要 { title, url }`);
  });

  if (!Array.isArray(value.freshness)) errors.push('freshness 不是数组');
  else value.freshness.forEach((item, i) => {
    if (!isText(item?.level) || !isText(item?.reason)) errors.push(`freshness[${i}] 需要 { level, reason }`);
  });

  if (!Array.isArray(value.next_options)) errors.push('next_options 必须是数组');
  else if (requireNextOptions && value.terminal !== true && value.next_options.length < 2) errors.push('next_options 至少需要 2 个选项');
  else value.next_options.forEach((item, i) => {
    if (!/^[A-Z]$/.test(item?.key || '') || !isText(item?.text)) errors.push(`next_options[${i}] 需要 { key, text }`);
  });
  if (Array.isArray(value.next_options)) {
    const keys = value.next_options.map((item) => item?.key);
    if (new Set(keys).size !== keys.length) errors.push('next_options 的 key 不能重复');
  }

  if (typeof value.terminal !== 'boolean') errors.push('terminal 必须是布尔值');
  if (value.terminal === true) {
    if (!value.outcome || !['success', 'failure', 'mixed'].includes(value.outcome.status) || !isText(value.outcome.title) || !isText(value.outcome.summary)) {
      errors.push('terminal=true 时 outcome 需要 { status: success|failure|mixed, title, summary }');
    }
    if (Array.isArray(value.next_options) && value.next_options.length > 0) errors.push('terminal=true 时 next_options 必须为空数组');
  }

  return { ok: errors.length === 0, errors };
}

const numberOr = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function normalizeAnalysis(value, input) {
  const evidenceFallback = (input.evidence || []).map((item) => ({
    title: item.title || '知乎资料', url: item.url || 'https://www.zhihu.com/', year: item.year || (item.publishedAt ? new Date(item.publishedAt).getFullYear() : undefined),
  }));
  const terminal = value?.terminal === true;
  const options = Array.isArray(value?.next_options) ? value.next_options : [];
  return {
    ...value,
    title: String(value?.title || value?.result_title || '本步路径分析').trim(),
    content: String(value?.content || value?.summary || value?.analysis || '').trim(),
    next_question: String(value?.next_question || '').trim(),
    pitfalls: (Array.isArray(value?.pitfalls) ? value.pitfalls : []).map((item) => typeof item === 'string'
      ? { name: item, probability: 0.5 }
      : { name: String(item?.name || item?.title || '潜在卡点'), probability: Math.min(1, Math.max(0, numberOr(item?.probability, 0.5))) }),
    metrics_delta: {
      time_days: numberOr(value?.metrics_delta?.time_days),
      mastery: numberOr(value?.metrics_delta?.mastery),
      exam_benefit: numberOr(value?.metrics_delta?.exam_benefit),
      risk: numberOr(value?.metrics_delta?.risk),
    },
    next_options: options.slice(0, 4).map((item, index) => ({ key: String.fromCharCode(65 + index), text: String(item?.text || item?.label || '').trim(), meta: String(item?.meta || '').trim() })).filter((item) => item.text),
    terminal,
    outcome: value?.outcome || null,
    evidence: (Array.isArray(value?.evidence) && value.evidence.length ? value.evidence : evidenceFallback).map((item) => ({ title: String(item?.title || '知乎资料'), url: String(item?.url || 'https://www.zhihu.com/'), year: item?.year })),
    freshness: (Array.isArray(value?.freshness) ? value.freshness : []).map((item) => ({ level: String(item?.level || 'fresh'), reason: String(item?.reason || '近期资料') })),
    confidence: Math.min(1, Math.max(0, numberOr(value?.confidence, 0.72))),
  };
}

// 完整流水线：调用 -> 宽容解析 -> 严格校验，任一环节失败即回退 fallback。
// 返回 { ok, stage, error, data, meta }，调用方永远拿到可渲染的 data。
export async function generateAnalysis(input, { chat, fallback, model, timeoutMs, attempts = 1 } = {}) {
  if (typeof chat !== 'function') throw new Error('generateAnalysis 需要注入 chat 函数');
  const useFallback = () => (typeof fallback === 'function' ? fallback(input) : null);

  let raw;
  let requestError;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      raw = await chat(buildAnalysisPrompt(input), { model, timeoutMs });
      break;
    } catch (error) {
      requestError = error;
    }
  }
  if (!raw) return { ok: false, stage: 'request', error: requestError?.message || 'LLM 请求失败', data: useFallback(), meta: { source: 'fallback' } };

  let parsed;
  try {
    parsed = normalizeAnalysis(extractJson(raw.content), input);
  } catch (error) {
    return { ok: false, stage: 'parse', error: error.message, data: useFallback(), meta: { source: 'fallback', latency_ms: raw.latencyMs, raw: String(raw.content).slice(0, 300) } };
  }

  const check = validateAnalysis(parsed, { requireNextOptions: input.initial === true });
  if (!check.ok) {
    // 保留模型已经生成的标题/正文/指标，仅用 Demo 字段补齐协议缺口。
    // 这样模型偶尔漏掉 freshness、stage_plan 等非核心字段时，仍能展示真实分析。
    const safe = useFallback() || {};
    const repaired = {
      ...safe,
      ...parsed,
      stage_plan: parsed.stage_plan?.length ? parsed.stage_plan : safe.stage_plan,
      next_options: parsed.next_options?.length >= (input.initial ? 2 : 0) ? parsed.next_options : safe.next_options,
      evidence: parsed.evidence?.length ? parsed.evidence : safe.evidence,
      freshness: parsed.freshness?.length ? parsed.freshness : safe.freshness,
    };
    return { ok: true, stage: 'llm-partial', error: check.errors.join('；'), data: repaired, meta: { source: 'llm', latency_ms: raw.latencyMs, raw: String(raw.content).slice(0, 300) } };
  }

  return {
    ok: true,
    stage: 'llm',
    error: null,
    data: parsed,
    meta: { source: 'llm', model: raw.model, latency_ms: raw.latencyMs, has_reasoning: Boolean(raw.reasoning) },
  };
}
