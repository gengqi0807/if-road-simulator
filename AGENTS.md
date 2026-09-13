# AGENTS.md

## Project overview

This repo is a small Vite + React demo for the “如果路” learning-decision simulator. The primary goal is to deliver a polished, demoable web MVP quickly, not to build a large production app.

- Main app entry: [src/main.jsx](src/main.jsx)
- Styling: [src/styles.css](src/styles.css)
- Product context and startup steps: [README.md](README.md)
- Delivery plan / acceptance criteria: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)

## Essential commands

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Production build: `npm run build`
- Preview build: `npm run preview`

## Working conventions

- Keep the app demo-first and resilient. The default behavior should work with local demo data even when Zhihu OAuth, content APIs, or LLM services fail.
- Treat OAuth secrets, access tokens, and app credentials as strictly server-side only. Never put them in frontend code or commit them to the repo.
- Prefer simple, incremental frontend changes and avoid introducing heavy framework or backend complexity unless the task explicitly requires it.
- This project is web-first; mobile support is explicitly out of scope for the current MVP.
- If an external service is unavailable, fail gracefully to the demo dataset or a safe fallback rather than breaking the flow.

## Architecture and boundaries

- The product is structured around a decision-simulation flow: goal input -> choice -> analysis -> branch/timeline -> comparison -> report.
- UI state is primarily local in the React app; the repo currently focuses on frontend simulation and demo flows rather than a full backend implementation.
- Real Zhihu OAuth / API / LLM integrations are expected to be added through provider abstraction and safe fallback paths, not as hard dependencies for basic demo operation.

## Before changing code

- Check whether the task fits the MVP scope in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).
- Keep changes small and consistent with the existing Vite/React structure.
- Preserve the app’s current demo-friendly behavior when external services are unavailable.
- Prefer matching the existing visual language and interaction patterns already present in the app instead of introducing a different design system.

## Do not do

- Do not commit secrets or `.env` values.
- Do not make the app depend on a real Zhihu or LLM call for the default demo flow.
- Do not broaden scope into mobile, multiplayer, or large backend infrastructure without explicit direction.
- Do not remove the graceful fallback behavior that allows the simulator to remain demoable offline.
