// LLM 结构化输出：Prompt 构造、宽容 JSON 提取、严格 Schema 校验、失败降级。
// analysis 结构与前端演示数据保持一致（见 src/lib/demo-data.js analysisFor）。

const ANALYSIS_SHAPE = `{
  "title": "一句话概括这次选择的后果",
  "content": "2-3 句具体后果分析",
  "pitfalls": [{ "name": "卡点名称", "probability": 0.73 }],
  "metrics_delta": { "time_days": 2, "mastery": 0.14, "exam_benefit": 0.1, "risk": 0.08 },
  "next_options": [{ "key": "A", "text": "下一步选项", "meta": "备注" }],
  "evidence": [{ "title": "来源标题", "url": "https://www.zhihu.com/", "year": 2024 }],
  "freshness": [{ "level": "slightly_old", "reason": "时效说明" }],
  "confidence": 0.86
}`;

export const buildAnalysisPrompt = ({ goal, stepIndex = 1, choiceText, constraints = {} }) => [
  {
    role: 'system',
    content: '你是「如果路」学习决策模拟器的推演引擎。基于学习目标与用户当前选择，推演接下来 2-3 天的后果、卡点概率与时效风险。只输出一个 JSON 对象，不要输出 markdown 代码块或任何解释文字。',
  },
  {
    role: 'user',
    content: [
      `学习目标：${goal}`,
      `当前是第 ${stepIndex} 步决策。`,
      `用户选择：${choiceText}`,
      `约束条件：${JSON.stringify(constraints)}`,
      '请严格按下列结构输出 JSON（字段名与类型必须一致；time_days 单位为天，其余为 0-1 的小数）：',
      ANALYSIS_SHAPE,
    ].join('\n'),
  },
];

// 宽容提取：允许模型包裹 ```json 代码块或携带前后缀说明文字
export function extractJson(raw) {
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

export function validateAnalysis(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, errors: ['输出不是 JSON 对象'] };
  const errors = [];
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

  if (!Array.isArray(value.next_options)) errors.push('next_options 不是数组');

  return { ok: errors.length === 0, errors };
}

// 完整流水线：调用 -> 宽容解析 -> 严格校验，任一环节失败即回退 fallback。
// 返回 { ok, stage, error, data, meta }，调用方永远拿到可渲染的 data。
export async function generateAnalysis(input, { chat, fallback, model, timeoutMs } = {}) {
  if (typeof chat !== 'function') throw new Error('generateAnalysis 需要注入 chat 函数');
  const useFallback = () => (typeof fallback === 'function' ? fallback(input) : null);

  let raw;
  try {
    raw = await chat(buildAnalysisPrompt(input), { model, timeoutMs });
  } catch (error) {
    return { ok: false, stage: 'request', error: error.message, data: useFallback(), meta: { source: 'fallback' } };
  }

  let parsed;
  try {
    parsed = extractJson(raw.content);
  } catch (error) {
    return { ok: false, stage: 'parse', error: error.message, data: useFallback(), meta: { source: 'fallback', latency_ms: raw.latencyMs, raw: String(raw.content).slice(0, 300) } };
  }

  const check = validateAnalysis(parsed);
  if (!check.ok) {
    return { ok: false, stage: 'validate', error: check.errors.join('；'), data: useFallback(), meta: { source: 'fallback', latency_ms: raw.latencyMs, raw: String(raw.content).slice(0, 300) } };
  }

  return {
    ok: true,
    stage: 'llm',
    error: null,
    data: parsed,
    meta: { source: 'llm', model: raw.model, latency_ms: raw.latencyMs, has_reasoning: Boolean(raw.reasoning) },
  };
}
