// LLM 端到端自检：配置 -> 连通性 -> 结构化输出（含降级），共消耗 2 次直答额度。
// 运行：npm run test:llm   或   node --env-file=.env scripts/test-llm.mjs
import { chat, isLlmConfigured, llmConfig, maskKey, SUPPORTED_MODELS } from '../src/lib/zhihu-llm.mjs';
import { generateAnalysis } from '../src/lib/llm-schema.mjs';
import { analysisFor, demoPath } from '../src/lib/demo-data.js';

const cfg = llmConfig();
console.log('\n[1/3] 配置检查');
console.log('  base_url :', cfg.baseUrl);
console.log('  model    :', cfg.model, SUPPORTED_MODELS.includes(cfg.model) ? '' : '(不在推荐档位内)');
console.log('  api_key  :', maskKey(cfg.apiKey) || '(空)');
console.log('  来源     :', process.env.ZHIHU_LLM_API_KEY ? 'ZHIHU_LLM_API_KEY' : (process.env.ZHIHU_ACCESS_SECRET ? 'ZHIHU_ACCESS_SECRET(回退)' : '未配置'));

if (!isLlmConfigured()) {
  console.error('\n[FAIL] 未配置密钥：请在 .env 填写 ZHIHU_LLM_API_KEY 或 ZHIHU_ACCESS_SECRET');
  process.exit(1);
}

console.log('\n[2/3] 连通性测试（消耗 1 次额度）');
try {
  const reply = await chat([{ role: 'user', content: '只回复两个字：收到' }], { model: 'zhida-fast-1p5', timeoutMs: 45_000 });
  console.log('  [OK] 调用成功');
  console.log('  回复     :', JSON.stringify(reply.content));
  console.log('  模型     :', reply.model);
  console.log('  延迟     :', reply.latencyMs, 'ms');
} catch (error) {
  console.error('  [FAIL] 调用失败：', error.message);
  process.exit(1);
}

console.log('\n[3/3] 结构化输出测试（消耗 1 次额度，验证 JSON Schema + 降级）');
const input = {
  goal: demoPath.goal,
  stepIndex: 1,
  choiceText: demoPath.steps[0].options[1].text,
  constraints: demoPath.constraints,
};
const result = await generateAnalysis(input, {
  chat,
  fallback: () => analysisFor(input.stepIndex, { key: 'B', text: input.choiceText }),
});
console.log('  来源     :', result.meta.source, result.ok ? '(真实 LLM)' : '(降级 fallback)');
console.log('  stage    :', result.stage);
if (result.error) console.log('  原因     :', result.error);
if (result.meta.latency_ms) console.log('  延迟     :', result.meta.latency_ms, 'ms');
console.log('  结果预览 :', JSON.stringify({
  title: result.data?.title,
  pitfalls: result.data?.pitfalls,
  metrics_delta: result.data?.metrics_delta,
  confidence: result.data?.confidence,
}, null, 2));

console.log('\n完成：若 [3/3] 显示「真实 LLM」，说明 Prompt + JSON 校验链路已跑通；\n若显示「降级 fallback」，stage 字段会指出失败环节（request/parse/validate）。\n');
