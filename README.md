# 如果路（if-road-simulator）

知乎黑客松 48h MVP：游戏化学习决策模拟器。

## 快速开始

```bash
npm install
npm run dev
```

当前前端默认使用本地 Demo 数据，优先保证现场可演示。真实知乎 OAuth、内容 API 和 LLM 通过服务端 Provider 接入，凭证请参考 `.env.example`，严禁提交到 Git。

## 开发计划

完整的三人任务拆分、时间排期、验收标准和 API 降级方案见 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)。

## 实现边界

- OAuth：黑客松 OAuth，服务端校验 `state`，Token 不下发浏览器。
- 内容：优先知乎搜索/回答摘要或授权收藏；接口失败自动回退 `data/demo`。
- LLM：优先知乎提供的 LLM API；不支持结构化 JSON 时使用 Schema 校验 + 预生成结果兜底。
- 移动端：暂不开发，先完成 Web 端比赛 Demo。
