// 知乎直答 API（OpenAI 兼容）适配器 —— 仅服务端使用，密钥绝不进入前端。
// 协议参考：zhihu/references/http-api.md 「直答 API」章节。
// 仅保证 model / messages / stream 三个请求字段；不支持 response_format。

const DEFAULT_BASE_URL = 'https://developer.zhihu.com/v1';
const DEFAULT_MODEL = 'zhida-thinking-1p5';
// 直答模型在冷启动/深度推理时常超过 15 秒。优先等待真实结果，
// 由调用方和云托管网关预留更长的总请求窗口。
const REQUEST_TIMEOUT_MS = 45_000;

export const SUPPORTED_MODELS = ['zhida-fast-1p5', 'zhida-thinking-1p5', 'zhida-agent'];

export const llmConfig = () => ({
  baseUrl: (process.env.ZHIHU_LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
  // 未单独配置 LLM Key 时，回退复用 OAuth Access Secret（同一把开发者凭证）
  apiKey: process.env.ZHIHU_LLM_API_KEY || process.env.ZHIHU_ACCESS_SECRET || '',
  model: process.env.ZHIHU_LLM_MODEL || DEFAULT_MODEL,
  analysisModel: process.env.ZHIHU_LLM_ANALYSIS_MODEL || 'zhida-fast-1p5',
});

export function isLlmConfigured() {
  const { baseUrl, apiKey } = llmConfig();
  return Boolean(baseUrl && apiKey);
}

// 只保留尾部 4 位，便于日志/前端确认配置来源，同时避免泄露完整密钥
export function maskKey(key) {
  if (!key) return '';
  if (key.length <= 4) return '****';
  return `${'*'.repeat(key.length - 4)}${key.slice(-4)}`;
}

export async function chat(messages, options = {}) {
  const { baseUrl, apiKey, model: defaultModel } = llmConfig();
  if (!apiKey) throw new Error('LLM 未配置：请在 .env 设置 ZHIHU_LLM_API_KEY 或 ZHIHU_ACCESS_SECRET');
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages 不能为空');

  const model = options.model || defaultModel;
  const timeoutMs = Number(options.timeoutMs) || REQUEST_TIMEOUT_MS;
  const stream = options.stream === true;
  const startedAt = Date.now();

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // 秒级 Unix 时间戳，必须与本次请求在同一次调用中生成
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body: JSON.stringify({ model, messages, stream }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`直答接口返回非 JSON（HTTP ${response.status}）`);
  }

  const apiError = payload.error;
  if (!response.ok || apiError) {
    const message = apiError?.message || `直答调用失败（HTTP ${response.status}）`;
    const code = apiError?.code ? ` · ${apiError.code}` : '';
    throw new Error(`${message}${code}`);
  }

  const choice = payload.choices?.[0] || {};
  return {
    content: choice.message?.content ?? '',
    reasoning: choice.message?.reasoning_content ?? '',
    finishReason: choice.finish_reason ?? null,
    model: payload.model || model,
    usage: payload.usage ?? null,
    latencyMs: Date.now() - startedAt,
  };
}

// 轻量连通性探测：拿到简短回答即可确认密钥 + 时间戳鉴权有效
export async function ping(question = '只回复两个字：收到', options = {}) {
  return chat([{ role: 'user', content: question }], { model: 'zhida-fast-1p5', timeoutMs: 45_000, ...options });
}
