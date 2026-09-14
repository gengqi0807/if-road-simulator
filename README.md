# 如果路（if-road-simulator）

知乎黑客松 48h MVP：游戏化学习决策模拟器。

## 快速开始

```bash
npm install
# 终端 1：启动会读取 .env 的 API 服务
npm run dev:api
# 终端 2：启动 Vite 前端
npm run dev
```

当前前端默认使用本地 Demo 数据，优先保证现场可演示。真实知乎 OAuth、内容 API 和 LLM 通过服务端 Provider 接入，凭证请参考 `.env.example`，严禁提交到 Git。

## 开发计划

完整的三人任务拆分、时间排期、验收标准和 API 降级方案见 [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)。

## 生产部署

项目已支持由同一个 Node 服务同时提供前端页面和 `/api`。生产环境执行：

```bash
npm ci
npm run build
npm start
```

可直接使用仓库根目录的 `render.yaml` 部署到 Render。部署面板中至少配置 `ZHIHU_ACCESS_SECRET`；需要知乎登录时，再配置 OAuth 三项变量，并将 `ZHIHU_OAUTH_REDIRECT_URI` 设置为 `https://你的域名/api/auth/zhihu/callback`。所有外部变量缺失时，网站仍会使用 Demo 数据完成核心流程。

## 实现边界

- OAuth：黑客松 OAuth，服务端校验 `state`，Token 不下发浏览器。
- 内容：优先知乎搜索/回答摘要或授权收藏；接口失败自动回退 `data/demo`。
- LLM：优先知乎提供的 LLM API；不支持结构化 JSON 时使用 Schema 校验 + 预生成结果兜底。
- 移动端：暂不开发，先完成 Web 端比赛 Demo。
