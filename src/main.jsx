import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, CalendarRange, Clock3, History, Sparkles, Target, UserRound } from 'lucide-react';
import './styles.css';
import HistoryListPage from './pages/HistoryListPage';
import HistoryDetailPage from './pages/HistoryDetailPage';
import ReportPage from './pages/ReportPage';
import { ToastProvider } from './components/Toast';
import { buildGoalFirstStep, buildGoalNextStep } from './lib/demo-data';

const defaultGoalForm = {
  goal: '',
  scenario: '学科知识',
  dailyMinutes: 60,
  deadlineDays: 14,
  foundation: '零基础',
  goalType: '期末',
};

const DEFAULT_TOTAL_STEPS = 8;
// 同源部署时使用 Vite/反向代理转发 /api；跨域部署可通过 VITE_API_BASE 覆盖。
const API_BASE = import.meta.env.VITE_API_BASE || '';

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || `API ${response.status}`);
  return payload.data;
}

function mapApiAnalysis(value, generation = null) {
  const delta = value.metrics_delta || {};
  const signedDays = Number(delta.time_days || 0);
  const signedPercent = (number) => `${number >= 0 ? '+' : ''}${Math.round(number * 100)}%`;
  const freshnessLevel = value.freshness?.[0]?.level;
  const freshness = freshnessLevel === 'expired' ? 'expired' : freshnessLevel === 'old' ? 'old' : freshnessLevel === 'slightly_old' ? 'recent' : 'fresh';
  return {
    ...demoAnalysis,
    title: value.title || demoAnalysis.title,
    summary: value.content || demoAnalysis.summary,
    blockers: (value.pitfalls || []).map((item) => typeof item === 'string' ? item : `${item.name}（${Math.round((item.probability || 0) * 100)}%）`),
    changes: [
      { label: '时间', value: `${signedDays >= 0 ? '+' : ''}${signedDays} 天` },
      { label: '掌握度', value: signedPercent(Number(delta.mastery || 0)) },
      { label: '考试收益', value: signedPercent(Number(delta.exam_benefit || 0)) },
      { label: '风险', value: signedPercent(Number(delta.risk || 0)) },
    ],
    freshness,
    sources: (value.evidence || []).map((item) => ({ ...item, author: item.author || '知乎来源', publishedAt: item.year ? `${item.year}-01-01` : item.publishedAt, isDemo: false })),
    terminal: Boolean(value.terminal), outcome: value.outcome || null, totalSteps: value.total_steps, stagePlan: value.stage_plan || [],
    generationSource: generation?.source || 'llm',
    generationStage: generation?.stage || 'llm',
  };
}

function createBranch(id, name, parentBranchId = null, forkStepIndex = null, steps = []) {
  return {
    id,
    name,
    parentBranchId,
    forkStepIndex,
    steps,
    outcome: null,
    status: 'in_progress',
    createdAt: new Date().toISOString(),
    totalSteps: DEFAULT_TOTAL_STEPS,
    stagePlan: [],
  };
}

function getBranchName(counter) {
  let value = counter;
  let name = '';
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return `分支 ${name}`;
}

function createStepRecord(stepIndex, option, apiStepId = null, options = [], analysis = null) {
  return {
    stepIndex,
    optionKey: option.key,
    optionText: option.text,
    summary: analysis?.summary || (stepIndex === 1 ? '先建立基础，再进入核心方法。' : '根据当前卡点调整学习路径。'),
    fullAnalysis: analysis?.summary || `${option.text}会改变后续的学习节奏。建议结合当前卡点及时复盘，并在下一步验证这条路径是否适合自己。`,
    sourceCount: analysis?.sources?.length || 0,
    expiredSourceCount: analysis?.sources?.filter((source) => source.freshness === 'expired').length || 0,
    apiStepId,
    options,
  };
}

function buildLocalGoalAnalysis(goal, option) {
  const label = goal || '当前目标';
  return {
    ...demoAnalysis,
    title: `你选择了「${option.text}」`,
    summary: `围绕「${label}」的这一步会影响后续学习节奏。建议完成一个小练习或测验，用结果验证当前路径，再决定下一步。`,
    blockers: ['目标拆解与持续执行（42%）'],
    sources: [{ title: `${label} 学习方法参考`, author: '目标化 Demo 资料', publishedAt: '—', url: 'https://www.zhihu.com/search?q=' + encodeURIComponent(label), isDemo: true }],
  };
}

function createOutcome(branch) {
  const directPath = branch.steps.some((step) => step.optionKey === 'B');
  return {
    rating: directPath ? '稳中有进' : '基础扎实',
    totalTime: directPath ? '9 天' : '14 天',
    mastery: directPath ? '64%' : '82%',
    examGain: directPath ? '88%' : '76%',
    review: directPath
      ? '这条路径反馈快，但需要在后续复习中补齐适用前提。'
      : '这条路径前期投入较多，但更适合建立长期可复用的基础。',
    radar: directPath ? [64, 88, 52, 86, 68] : [82, 76, 88, 72, 90],
  };
}

function EntryGate({ onQuickStart, onZhihuLogin, onHistory }) {
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('login_error');
    if (error) {
      setNotice(`知乎登录失败：${error}`);
      window.history.replaceState({}, '', '/');
      return;
    }
    if (params.get('login') !== 'success') return;
    window.history.replaceState({}, '', '/');
    setIsLoading(true);
    fetch('/api/auth/zhihu/me')
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.user) {
          throw new Error(payload?.error || `会话校验失败（${response.status}）`);
        }
        setNotice(`欢迎你，${payload.data.user.name || '知乎用户'}`);
        onZhihuLogin();
      })
      .catch((error) => {
        setNotice(`知乎登录未完成：${error.message}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleZhihuLogin = async () => {
    setIsLoading(true);
    setNotice('');
    try {
      const response = await fetch('/api/auth/zhihu/start');
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || `登录服务不可用（${response.status}）`);
      window.location.href = payload.data.authorize_url;
    } catch (error) {
      setIsLoading(false);
      setNotice(`无法发起知乎登录：${error.message}`);
    }
  };

  return (
    <main className="landing-shell">
      <div className="hero-glow glow-one" />
      <div className="hero-glow glow-two" />

      <header className="topbar topbar-landing">
        <div className="brand-wrap">
          <div className="brand-mark">if</div>
          <span className="brand-text">如果路</span>
        </div>

        <div className="entry-nav-actions">
          <button className="outline-nav-button" type="button" onClick={onHistory}>历史</button>
        </div>
      </header>

      <section className="hero-panel">
        <div className="eyebrow-pill">
          <Sparkles size={15} />
          游戏化学习决策模拟器
        </div>

        <h1>
          人生有如果，
          <span>决策有如果。</span>
        </h1>

        <p className="hero-subtitle">
          把知识路径选择变成一段可比较、可回溯、可复盘的学习决策体验。
        </p>

        <div className="entry-card">
          <div className="card-header-row">
            <div className="card-title">开始你的路径</div>
          </div>

          <div className="primary-actions">
            <button className="btn btn-primary" onClick={handleZhihuLogin} type="button" disabled={isLoading}>
              {isLoading ? '正在进入...' : '使用知乎登录'}
              <UserRound size={16} />
            </button>

            <button className="btn btn-secondary" onClick={onQuickStart} type="button">
              先体验一下
            </button>
          </div>

          {notice ? <div className="inline-note">{notice}</div> : null}

          <div className="entry-footer">
            <span className="footer-flag">
              <UserRound size={15} />
              登录后可保存档案与攻略
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

function GoalForm({ initialGoal, onSubmit }) {
  const [form, setForm] = useState({ ...defaultGoalForm, goal: initialGoal || '' });
  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.goal.trim()) {
      nextErrors.goal = '学习目标不能为空';
    }
    if (Number(form.dailyMinutes) < 15) {
      nextErrors.dailyMinutes = '每天可用时间必须至少 15 分钟';
    }
    if (Number(form.deadlineDays) < 3) {
      nextErrors.deadlineDays = '目标截止天数必须至少 3 天';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    onSubmit(form);
  };

  const isSubmitDisabled = !form.goal.trim();

  return (
    <main className="goal-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">if</div>
          <div className="brand-stack">
            <span className="brand-text">如果路</span>
            <small>游戏化学习决策模拟器</small>
          </div>
        </div>

      </header>

      <section className="goal-panel">
        <div className="panel-heading">
          <div className="heading-copy">
            <span className="eyebrow-pill">
              <Target size={15} />
              目标设定
            </span>
            <h2>为你的学习路径定一个方向</h2>
          </div>

          <button type="button" className="btn btn-link" onClick={() => onSubmit(null)}>
            返回首页
          </button>
        </div>

        <form className="goal-form" onSubmit={handleSubmit}>
          <div className="field field-full">
            <label htmlFor="goal">学习目标</label>
            <div className="input-wrap input-icon">
              <Target size={17} />
              <input
                id="goal"
                type="text"
                placeholder="例如：我想学会洛必达法则"
                value={form.goal}
                onChange={(event) => updateField('goal', event.target.value)}
              />
            </div>
            {errors.goal ? <span className="field-error">{errors.goal}</span> : null}
          </div>

          <div className="field-grid">
            <div className="field">
              <label>场景选择</label>
              <div className="choice-row">
                {['学科知识', '升学就业'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`choice-pill ${form.scenario === option ? 'selected' : ''}`}
                    onClick={() => updateField('scenario', option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>当前基础</label>
              <div className="select-wrap">
                <select value={form.foundation} onChange={(event) => updateField('foundation', event.target.value)}>
                  <option value="零基础">零基础</option>
                  <option value="基础一般">基础一般</option>
                  <option value="有基础">有基础</option>
                </select>
              </div>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label htmlFor="dailyMinutes">每天可用时间</label>
              <div className="input-wrap">
                <Clock3 size={16} />
                <input
                  id="dailyMinutes"
                  type="number"
                  min="15"
                  step="5"
                  value={form.dailyMinutes}
                  onChange={(event) => updateField('dailyMinutes', event.target.value)}
                />
                <span className="unit-label">分钟</span>
              </div>
              {errors.dailyMinutes ? <span className="field-error">{errors.dailyMinutes}</span> : null}
            </div>

            <div className="field">
              <label htmlFor="deadlineDays">目标截止天数</label>
              <div className="input-wrap">
                <CalendarRange size={16} />
                <input
                  id="deadlineDays"
                  type="number"
                  min="3"
                  step="1"
                  value={form.deadlineDays}
                  onChange={(event) => updateField('deadlineDays', event.target.value)}
                />
                <span className="unit-label">天</span>
              </div>
              {errors.deadlineDays ? <span className="field-error">{errors.deadlineDays}</span> : null}
            </div>
          </div>

          <div className="field">
            <label>目标类型</label>
            <div className="choice-row">
              {['期末', '考研', '兴趣', '补基础'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`choice-pill ${form.goalType === option ? 'selected' : ''}`}
                  onClick={() => updateField('goalType', option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="submit-row">
            <button type="submit" className="btn btn-primary submit-btn" disabled={isSubmitDisabled}>
              开始如果路
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function StatusBar({ step, resources, onBacktrack }) {
  return (
    <header className="simulation-status-bar">
      <div className="step-count">
        第 {step.stepIndex} 步 <span>/ 共 {step.totalSteps} 步</span>
      </div>

      <div className="resource-status" aria-label="学习资源状态">
        {resources.map((resource) => (
          <div className="resource-item" key={resource.label}>
            <div className="resource-label">
              <span>{resource.label}</span>
              <strong>{resource.value}%</strong>
            </div>
            <div className="resource-track" aria-hidden="true">
              <span className={`resource-fill ${resource.tone}`} style={{ width: `${resource.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <button className="backtrack-button" type="button" onClick={onBacktrack}>
        <History size={16} />
        回到之前的题
      </button>
    </header>
  );
}

function ChoiceCard({ step, selectedKey, onChoose, disabled }) {
  return (
    <section className="choice-card" aria-labelledby="choice-card-title">
      <div className="choice-card-heading">
        <span className="choice-card-kicker">路径选择</span>
        <h1 id="choice-card-title">{step.title}</h1>
        <p>选择一个起点，看看这条学习路径会如何展开。</p>
      </div>

      <div className="choice-list">
        {step.options.map((option) => (
          <button
            className={`choice-option ${selectedKey === option.key ? 'is-selected' : ''}`}
            key={option.key}
            type="button"
            aria-pressed={selectedKey === option.key}
            disabled={disabled}
            onClick={() => onChoose(option)}
          >
            <span className="choice-selected-dot" aria-hidden="true" />
            <span className="choice-key">{option.key}</span>
            <span className="choice-text">{option.text}</span>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>
    </section>
  );
}

function FreshnessBadge({ status }) {
  const freshnessMap = {
    fresh: { label: '新鲜', icon: '🟢' },
    recent: { label: '微旧', icon: '🟡' },
    old: { label: '过时', icon: '🟠' },
    expired: { label: '过期', icon: '🔴' },
  };
  const freshness = freshnessMap[status] || freshnessMap.fresh;

  return (
    <span className={`freshness-badge freshness-${status}`}>
      {freshness.icon} {freshness.label}
    </span>
  );
}

function AnalysisCard({ data, isLoading }) {
  return (
    <section className={`analysis-card ${isLoading ? 'is-loading' : 'is-ready'}`} aria-live="polite">
      {isLoading ? (
        <div className="analysis-loading">
          <span className="skeleton-bar skeleton-bar-wide" />
          <span className="skeleton-bar skeleton-bar-medium" />
          <span className="skeleton-bar skeleton-bar-short" />
        </div>
      ) : (
        <>
          <div className="analysis-card-header">
            <div>
              <span className="analysis-kicker">AI 路径分析 · {data.generationSource === 'llm' ? '实时生成' : '安全降级'}</span>
              <h2>{data.title}</h2>
            </div>
            <FreshnessBadge status={data.freshness} />
          </div>

          <p className="analysis-summary">{data.summary}</p>

          <div className="analysis-blocker">
            <span className="analysis-blocker-label">可能的卡点</span>
            <ul>
              {data.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </div>

          <div className="metric-changes">
            {data.changes.map((change) => (
              <span className={change.value.startsWith('-') ? 'metric-negative' : 'metric-positive'} key={change.label}>
                {change.label} {change.value}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SourceCard({ sources }) {
  return (
    <section className="source-card" aria-labelledby="source-card-title">
      <div className="source-card-header">
        <div>
          <span className="analysis-kicker">参考来源</span>
          <h2 id="source-card-title">知乎资料</h2>
        </div>
        <span className="source-count">{sources.length} 条</span>
      </div>

      <div className="source-list">
        {sources.map((source) => (
          <article className="source-item" key={source.title}>
            <div className="source-item-main">
              <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
              <div className="source-meta">
                <span>{source.author}</span>
                <span>{source.publishedAt}</span>
                {source.isDemo ? <span className="demo-source-label">参考资料</span> : null}
              </div>
            </div>
            <ArrowRight size={16} />
          </article>
        ))}
      </div>
    </section>
  );
}

const demoAnalysis = {
  title: '你选了直接学洛必达',
  summary: '这条路径上手速度快，适合先获得解题反馈，再回头补齐极限与连续性的基础。需要注意的是，短期会更依赖题型识别，遇到陌生题目时要及时回到前置概念。',
  blockers: ['适用前提（73% 的人在此卡住）', '未定式判断（41% 的人在此卡住）'],
  freshness: 'fresh',
  changes: [
    { label: '时间', value: '+2 天' },
    { label: '掌握度', value: '+35%' },
    { label: '信心', value: '-10%' },
  ],
  sources: [
    {
      title: '洛必达法则到底该怎么用？',
      author: '知乎答主：数学学习笔记',
      publishedAt: '2025-06-18',
      url: 'https://www.zhihu.com/question/21473299',
      isDemo: true,
    },
    {
      title: '如何判断极限题能不能使用洛必达法则',
      author: '知乎答主：微积分自习室',
      publishedAt: '2024-11-03',
      url: 'https://www.zhihu.com/question/29725740',
      isDemo: true,
    },
  ],
};

const comparisonBranches = {
  A: {
    label: '分支 A',
    name: '先学极限再进阶',
    metrics: {
      totalTime: '14 天',
      mastery: '82%',
      examGain: '76%',
      forgetting: '慢',
      freshnessRisk: '低',
    },
    radar: [82, 76, 88, 72, 90],
  },
  B: {
    label: '分支 B',
    name: '直接学洛必达',
    metrics: {
      totalTime: '9 天',
      mastery: '64%',
      examGain: '88%',
      forgetting: '快',
      freshnessRisk: '中',
    },
    radar: [64, 88, 52, 86, 68],
  },
};

const comparisonRows = [
  { key: 'totalTime', label: '总时间（天）' },
  { key: 'mastery', label: '掌握深度（百分比）' },
  { key: 'examGain', label: '考试收益（百分比）' },
  { key: 'forgetting', label: '遗忘速度（快/中/慢）' },
  { key: 'freshnessRisk', label: '时效性风险（高/中/低）' },
];

function RadarChart({ firstBranch, secondBranch }) {
  const center = 150;
  const radius = 104;
  const labels = ['掌握', '收益', '稳定', '记忆', '时效'];
  const getPoint = (index, value) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
    const pointRadius = radius * (value / 100);
    return {
      x: center + Math.cos(angle) * pointRadius,
      y: center + Math.sin(angle) * pointRadius,
    };
  };
  const pointsFor = (values) => values.map((value, index) => {
    const point = getPoint(index, value);
    return `${point.x},${point.y}`;
  }).join(' ');

  return (
    <div className="radar-card">
      <div className="comparison-section-heading">
        <span className="analysis-kicker">路径画像</span>
        <h2>能力维度对比</h2>
      </div>
      <svg className="radar-chart" viewBox="0 0 300 300" role="img" aria-label="两个学习分支的能力维度雷达图">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            className="radar-grid"
            key={scale}
            points={labels.map((_, index) => {
              const point = getPoint(index, scale * 100);
              return `${point.x},${point.y}`;
            }).join(' ')}
          />
        ))}
        {labels.map((label, index) => {
          const point = getPoint(index, 112);
          const axisPoint = getPoint(index, 100);
          return (
            <g key={label}>
              <line className="radar-axis" x1={center} y1={center} x2={axisPoint.x} y2={axisPoint.y} />
              <text className="radar-label" x={point.x} y={point.y}>{label}</text>
            </g>
          );
        })}
        <polygon className="radar-area radar-area-a" points={pointsFor(firstBranch.radar)} />
        <polygon className="radar-area radar-area-b" points={pointsFor(secondBranch.radar)} />
      </svg>
      <div className="radar-legend">
        <span><i className="legend-dot legend-dot-a" />{firstBranch.label}</span>
        <span><i className="legend-dot legend-dot-b" />{secondBranch.label}</span>
      </div>
    </div>
  );
}

function LegacyComparisonPage({ onReturnSimulation }) {
  const [firstKey, setFirstKey] = useState('A');
  const [secondKey, setSecondKey] = useState('B');
  const firstBranch = comparisonBranches[firstKey];
  const secondBranch = comparisonBranches[secondKey];

  const summary = firstKey === 'A' && secondKey === 'B'
    ? '如果你每天 1 小时、目标是期末，路径 A 更现实；如果考研，路径 B 更稳。'
    : `${firstBranch.label}适合${firstBranch.name}，${secondBranch.label}则更偏向${secondBranch.name}，可以结合你的时间和目标取舍。`;

  return (
    <main className="comparison-page">
      <header className="comparison-header">
        <div>
          <span className="eyebrow-pill"><Sparkles size={15} /> 路径对比</span>
          <h1>哪条学习路径更适合你？</h1>
          <p>把不同选择放在一起，看看时间投入和学习收益的差异。</p>
        </div>
        <button className="outline-nav-button" type="button" onClick={onReturnSimulation}>返回推演</button>
      </header>

      <section className="comparison-selectors" aria-label="分支选择">
        <label>
          <span>对比路径一</span>
          <select value={firstKey} onChange={(event) => setFirstKey(event.target.value)}>
            {Object.entries(comparisonBranches).map(([key, branch]) => <option key={key} value={key}>{branch.label}</option>)}
          </select>
        </label>
        <span className="comparison-vs">VS</span>
        <label>
          <span>对比路径二</span>
          <select value={secondKey} onChange={(event) => setSecondKey(event.target.value)}>
            {Object.entries(comparisonBranches).map(([key, branch]) => <option key={key} value={key}>{branch.label}</option>)}
          </select>
        </label>
      </section>

      <div className="comparison-layout">
        <section className="comparison-table-card">
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>对比指标</th>
                  <th>{firstBranch.label}<small>{firstBranch.name}</small></th>
                  <th>{secondBranch.label}<small>{secondBranch.name}</small></th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.key}>
                    <th>{row.label}</th>
                    <td>{firstBranch.metrics[row.key]}</td>
                    <td>{secondBranch.metrics[row.key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="comparison-summary">
            <span className="analysis-kicker">AI 总结</span>
            <p>{summary}</p>
          </div>
        </section>

        <RadarChart firstBranch={firstBranch} secondBranch={secondBranch} />
      </div>
    </main>
  );
}

function OutcomePage({ branch, endedBranches, canCompare, onSwitchBranch, onBacktrack, onCompare, onReport, onRestart, onHome }) {
  const outcome = branch.outcome || createOutcome(branch);
  return (
    <main className="comparison-page outcome-page">
      <header className="comparison-header">
        <div>
          <span className="eyebrow-pill"><Sparkles size={15} /> 学习结局</span>
          <h1>{branch.name} · 路径结局</h1>
          <p>这条路径已经完成 {branch.steps.length} 个决策点，下面是你的学习结果。</p>
        </div>
        <span className="timeline-progress">已完成</span>
      </header>
      <div className="branch-tabs" role="tablist" aria-label="已完成分支">
        {endedBranches.map((item) => (
          <button className={item.id === branch.id ? 'branch-tab is-active' : 'branch-tab'} type="button" key={item.id} onClick={() => onSwitchBranch(item.id)}>
            {item.name}
          </button>
        ))}
      </div>
      <section className="outcome-hero-card">
        <span className="analysis-kicker">路径评级</span>
        <strong>{outcome.rating}</strong>
        <p>{outcome.review}</p>
      </section>
      <section className="outcome-metrics-grid">
        <div><span>总时间</span><strong>{outcome.totalTime}</strong></div>
        <div><span>掌握深度</span><strong>{outcome.mastery}</strong></div>
        <div><span>考试收益</span><strong>{outcome.examGain}</strong></div>
      </section>
      <section className="outcome-path-card">
        <span className="analysis-kicker">你的路径</span>
        {branch.steps.map((step) => <div className="outcome-step" key={step.stepIndex}><b>第 {step.stepIndex} 题</b><span>{step.optionText}</span></div>)}
      </section>
      <div className="outcome-actions">
        <button className="btn btn-primary" type="button" onClick={onBacktrack}>回溯到某一步</button>
        <button className="outline-nav-button" type="button" disabled={!canCompare} onClick={onCompare}>查看对比</button>
        <button className="btn btn-primary" type="button" onClick={onReport}>查看详细报告</button>
        <button className="btn btn-secondary" type="button" onClick={onRestart}>重新开始</button>
        <button className="btn btn-link" type="button" onClick={onHome}>回到主页</button>
      </div>
      {!canCompare ? <p className="outcome-hint">完成至少两条路径后才能进行对比。</p> : null}
    </main>
  );
}

function MultiRadarChart({ branches }) {
  const labels = ['掌握', '收益', '稳定', '记忆', '时效'];
  const center = 150;
  const radius = 104;
  const colors = ['#1859D4', '#F59E0B', '#22C55E', '#EF4444', '#7C3AED', '#0891B2'];
  const getPoint = (index, value) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / labels.length;
    const pointRadius = radius * value / 100;
    return { x: center + Math.cos(angle) * pointRadius, y: center + Math.sin(angle) * pointRadius };
  };
  const pointString = (values) => values.map((value, index) => {
    const point = getPoint(index, value);
    return `${point.x},${point.y}`;
  }).join(' ');
  return (
    <div className="radar-card">
      <div className="comparison-section-heading"><span className="analysis-kicker">路径画像</span><h2>已选分支对比</h2></div>
      <svg className="radar-chart" viewBox="0 0 300 300" role="img" aria-label="多个分支能力维度雷达图">
        {[25, 50, 75, 100].map((scale) => <polygon className="radar-grid" key={scale} points={labels.map((_, index) => { const point = getPoint(index, scale); return `${point.x},${point.y}`; }).join(' ')} />)}
        {labels.map((label, index) => { const axis = getPoint(index, 100); const text = getPoint(index, 112); return <g key={label}><line className="radar-axis" x1={center} y1={center} x2={axis.x} y2={axis.y} /><text className="radar-label" x={text.x} y={text.y}>{label}</text></g>; })}
        {branches.map((branch, index) => <polygon className="radar-area" style={{ stroke: colors[index % colors.length], fill: `${colors[index % colors.length]}22` }} key={branch.id} points={pointString(branch.radar)} />)}
      </svg>
      <div className="radar-legend">{branches.map((branch, index) => <span key={branch.id}><i className="legend-dot" style={{ background: colors[index % colors.length] }} />{branch.name}</span>)}</div>
    </div>
  );
}

function BranchComparisonPage({ branches, onReturnOutcome }) {
  const [remoteComparison, setRemoteComparison] = useState(null);
  const apiSessionId = branches.find((branch) => branch.apiSessionId)?.apiSessionId;
  const [selectedIds, setSelectedIds] = useState(branches.map((branch) => branch.id));
  const selectedBranches = branches.filter((branch) => selectedIds.includes(branch.id));
  const rows = [
    ['总时间（天）', (branch) => branch.outcome?.totalTime || '-'],
    ['掌握深度（百分比）', (branch) => branch.outcome?.mastery || '-'],
    ['考试收益（百分比）', (branch) => branch.outcome?.examGain || '-'],
    ['遗忘速度（快/中/慢）', (branch) => branch.name.includes('B') ? '快' : '慢'],
    ['时效性风险（高/中/低）', (branch) => branch.name.includes('B') ? '中' : '低'],
  ];
  const toggleBranch = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  useEffect(() => {
    const selected = branches.filter((branch) => selectedIds.includes(branch.id));
    const a = selected[0]?.apiBranchId, b = selected[1]?.apiBranchId;
    if (!apiSessionId || !a || !b) return undefined;
    let cancelled = false;
    apiRequest('/api/compare', { method: 'POST', body: JSON.stringify({ session_id: apiSessionId, branch_a_id: a, branch_b_id: b }) })
      .then((data) => { if (!cancelled) setRemoteComparison(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [apiSessionId, selectedIds.join(','), branches]);
  return (
    <main className="comparison-page">
  <header className="comparison-header"><div><span className="eyebrow-pill"><Sparkles size={15} /> 路径对比</span><h1>已完成路径的对比</h1><p>完成全部决策点的分支会出现在这里。</p></div><button className="outline-nav-button" type="button" onClick={onReturnOutcome}>返回结局</button></header>
      {branches.length < 2 ? <section className="timeline-empty comparison-empty">请先在推演页完成至少两条路径</section> : <>
        <div className="branch-filter-row">{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={selectedIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} /> {branch.name}</label>)}</div>
        <div className="comparison-layout">
          <section className="comparison-table-card"><div className="comparison-table-wrap"><table className="comparison-table"><thead><tr><th>对比指标</th>{selectedBranches.map((branch) => <th key={branch.id}>{branch.name}<small>已完成</small></th>)}</tr></thead><tbody>{rows.map(([label, getter], rowIndex) => <tr key={label}><th>{label}</th>{selectedBranches.map((branch, branchIndex) => <td key={branch.id}>{remoteComparison && rowIndex === 0 ? `${remoteComparison.metrics.time_days[branchIndex === 0 ? 'a' : 'b']} 天` : remoteComparison && rowIndex === 1 ? `${Math.round(remoteComparison.metrics.mastery[branchIndex === 0 ? 'a' : 'b'] * 100)}%` : getter(branch)}</td>)}</tr>)}</tbody></table></div>{remoteComparison ? <p className="comparison-remote-note">已同步路径对比结果：{remoteComparison.summary}</p> : null}</section>
          {selectedBranches.length ? <MultiRadarChart branches={selectedBranches.map((branch) => ({ ...branch, radar: branch.outcome?.radar || [72, 76, 70, 74, 78] }))} /> : <section className="radar-card timeline-empty">至少选择一条分支</section>}
        </div>
      </>}
    </main>
  );
}

function TimelinePage({ history, currentStepIndex, onReturnStep, onReturnSimulation, returnLabel = '返回推演', currentBranchName = '分支 A', newBranchName = '分支 B' }) {
  const [expandedStep, setExpandedStep] = useState(history[history.length - 1]?.stepIndex || null);
  const [pendingStep, setPendingStep] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const handleReturnConfirm = () => {
    if (!pendingStep) return;
    onReturnStep(pendingStep);
    setPendingStep(null);
  };

  return (
    <main className="timeline-page">
      <header className="timeline-header">
        <div>
          <span className="eyebrow-pill"><History size={15} /> 路径回溯</span>
          <h1>你的学习路径时间线</h1>
          <p>点击节点查看分析，或从任意一步创建一条新的分支。</p>
        </div>
        <div className="timeline-header-actions">
          <span className="timeline-progress">当前第 {currentStepIndex} 步</span>
          <button className="outline-nav-button" type="button" onClick={onReturnSimulation}>{returnLabel}</button>
        </div>
      </header>

      <section className="timeline-track" aria-label="学习路径时间线">
        {isLoading ? <div className="timeline-skeleton"><span /><span /><span /></div> : null}
        {!isLoading && history.map((node) => {
          const isCurrent = node.stepIndex === currentStepIndex;
          const isExpanded = expandedStep === node.stepIndex;

          return (
            <article
              className={`timeline-node is-visited ${isCurrent ? 'is-current' : ''} ${node.branch ? 'is-branch' : ''}`}
              key={`${node.stepIndex}-${node.optionKey}-${node.branch ? 'branch' : 'main'}`}
            >
              <div className="timeline-rail" aria-hidden="true">
                <span className="timeline-dot" />
              </div>
              <div
                className="timeline-node-card"
                role="button"
                tabIndex="0"
                aria-expanded={isExpanded}
                onClick={() => setExpandedStep(isExpanded ? null : node.stepIndex)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setExpandedStep(isExpanded ? null : node.stepIndex);
                  }
                }}
              >
                <div className="timeline-card-topline">
                  <span>第 {node.stepIndex} 步</span>
                  {node.branch ? <span className="branch-badge">分支</span> : null}
                </div>
                <h2>{node.optionText}</h2>
                <p>{node.summary}</p>
                <span className="timeline-source-note">
                  本步引用 {node.sourceCount} 条资料{node.expiredSourceCount ? `，其中 ${node.expiredSourceCount} 条已过期` : ''}
                </span>
                {isExpanded ? (
                  <div className="timeline-expanded-analysis">
                    <span>完整分析</span>
                    <p>{node.fullAnalysis}</p>
                    <span className="timeline-return-action">回到这一步重新选择</span>
                  </div>
                ) : null}
                <span className="timeline-card-hint">{isExpanded ? '收起分析' : '展开分析'}</span>
                <button className="timeline-return-button" type="button" onClick={(event) => {
                  event.stopPropagation();
                  setPendingStep(node.stepIndex);
                }}>
                  回到这一步
                </button>
              </div>
            </article>
          );
        })}
        {!isLoading && history.length === 0 ? <p className="timeline-empty">还没有开始模拟，请先输入学习目标</p> : null}
      </section>

      {pendingStep ? (
        <div className="timeline-modal-backdrop" role="presentation" onClick={() => setPendingStep(null)}>
          <section className="timeline-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="timeline-confirm-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="timeline-confirm-title">回到第 {pendingStep} 步？</h2>
            <p>确定回到第 {pendingStep} 题吗？当前路径会保留为{currentBranchName}，新建{newBranchName}。</p>
            <div className="timeline-modal-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setPendingStep(null)}>取消</button>
              <button className="btn btn-primary" type="button" onClick={handleReturnConfirm}>确认回溯</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function MidwayBacktrackPanel({ steps, onConfirm }) {
  const [selectedStep, setSelectedStep] = useState(null);
  const [confirmStep, setConfirmStep] = useState(null);

  return (
    <div className="midway-backtrack-panel">
      <div className="midway-panel-header">
        <strong>回到之前的题</strong>
        <span>选择已完成的题目进行纠错</span>
      </div>
      <div className="midway-step-list">
        {steps.map((step) => (
          <button key={step.stepIndex} type="button" onClick={() => setSelectedStep(step.stepIndex)}>
            第 {step.stepIndex} 题 · {step.optionText}
          </button>
        ))}
      </div>
      {selectedStep ? (
        <div className="midway-confirm-row">
          <span>确定回到第 {selectedStep} 题吗？</span>
          <button type="button" onClick={() => setConfirmStep(selectedStep)}>继续</button>
        </div>
      ) : null}
      {confirmStep ? (
        <div className="timeline-modal-backdrop" role="presentation" onClick={() => setConfirmStep(null)}>
          <section className="timeline-confirm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2>回到第 {confirmStep} 题？</h2>
            <p>确定回到第 {confirmStep} 题吗？第 {confirmStep + 1} 题之后的作答会被清除。</p>
            <div className="timeline-modal-actions">
              <button className="btn btn-link" type="button" onClick={() => setConfirmStep(null)}>取消</button>
              <button className="btn btn-primary" type="button" onClick={() => onConfirm(confirmStep)}>确定回溯</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SimulationPage({ branch, initialStepIndex = null, onBranchUpdate, onOutcome }) {
  const totalSteps = Math.min(10, Math.max(8, Number(branch.totalSteps) || DEFAULT_TOTAL_STEPS));
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex || (branch.steps.length < totalSteps ? branch.steps.length + 1 : totalSteps));
  const currentRecord = branch.steps.find((step) => step.stepIndex === currentStepIndex);
  const [selectedKey, setSelectedKey] = useState(currentRecord?.optionKey || null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [pendingBranch, setPendingBranch] = useState(null);
  const [pendingRemoteStep, setPendingRemoteStep] = useState(null);
  const [remoteStep, setRemoteStep] = useState(branch.remoteStep || null);
  const [showBacktrackPanel, setShowBacktrackPanel] = useState(false);

  const apiOptions = remoteStep && remoteStep.index === currentStepIndex
    ? remoteStep.options.map((option) => ({ key: option.key, text: option.text, meta: option.meta || '' }))
    : null;
  const goalFirstStep = branch.goalFirstStep || buildGoalFirstStep(branch.goal || '');
  const previousChoice = branch.steps.find((step) => step.stepIndex === currentStepIndex - 1)?.optionText || '';
  const fallbackStep = currentStepIndex === 1 ? goalFirstStep : buildGoalNextStep(branch.goal || '', currentStepIndex, previousChoice);
  const currentOptions = apiOptions || (currentRecord?.options?.length ? currentRecord.options : null) || fallbackStep.options;
  const currentStep = { title: remoteStep?.title || fallbackStep.title, options: currentOptions, stepIndex: currentStepIndex, totalSteps: remoteStep?.totalSteps || totalSteps };
  const metrics = [
    { label: '时间', value: Math.max(72 - branch.steps.length * 5, 0), tone: 'blue' },
    { label: '掌握度', value: Math.min(18 + branch.steps.length * 8, 100), tone: 'green' },
    { label: '信心', value: Math.min(54 + branch.steps.length * 6, 100), tone: 'orange' },
  ];

  const handleConfirm = async () => {
    if (!selectedKey || isAnalyzing) return;
    const selectedOption = currentOptions.find((option) => option.key === selectedKey);
    const currentApiStepId = branch.remoteStep?.id || null;
    setIsAnalyzing(true);
    let remoteAnalysis = null;
    let remoteNext = null;
    let remoteEnded = false;
    if (branch.apiSessionId) {
      try {
        const remote = await apiRequest(`/api/sessions/${branch.apiSessionId}/choose`, { method: 'POST', body: JSON.stringify({ option_key: selectedKey }) });
        remoteAnalysis = mapApiAnalysis(remote.analysis, remote.generation);
        remoteNext = remote.next_step;
        remoteEnded = Boolean(remote.ended || remoteNext?.terminal || remote.analysis?.terminal);
      } catch {
        // 云托管实例重启后内存会话会丢失。改用无状态 LLM 分析恢复，
        // 避免旧 apiSessionId 让整条后续路径永久降级为本地 Demo。
        try {
          const query = new URLSearchParams({ goal: branch.goal || '', step: String(currentStepIndex), choice: selectedOption.text });
          const recovered = await apiRequest(`/api/llm/analyze?${query}`);
          remoteAnalysis = mapApiAnalysis(recovered.analysis, recovered);
          const nextOptions = recovered.analysis?.next_options || [];
          remoteEnded = Boolean(recovered.analysis?.terminal);
          remoteNext = remoteEnded ? { terminal: true } : (nextOptions.length >= 2 ? {
            index: currentStepIndex + 1,
            title: recovered.analysis?.next_question || buildGoalNextStep(branch.goal || '', currentStepIndex + 1, selectedOption.text).title,
            options: nextOptions,
            totalSteps: recovered.analysis?.total_steps || branch.totalSteps || DEFAULT_TOTAL_STEPS,
          } : null);
        } catch { /* LLM 本身失败时才使用本地安全降级 */ }
      }
    }
    if (!branch.apiSessionId) {
      try {
        const query = new URLSearchParams({ goal: branch.goal || '', step: String(currentStepIndex), choice: selectedOption.text });
        const recovered = await apiRequest(`/api/llm/analyze?${query}`);
        remoteAnalysis = mapApiAnalysis(recovered.analysis, recovered);
        const nextOptions = recovered.analysis?.next_options || [];
        remoteEnded = Boolean(recovered.analysis?.terminal);
        remoteNext = remoteEnded ? { terminal: true } : (nextOptions.length >= 2 ? {
          index: currentStepIndex + 1,
          title: recovered.analysis?.next_question || buildGoalNextStep(branch.goal || '', currentStepIndex + 1, selectedOption.text).title,
          options: nextOptions,
          totalSteps: recovered.analysis?.total_steps || branch.totalSteps || DEFAULT_TOTAL_STEPS,
        } : null);
      } catch { /* LLM 本身失败时才使用本地安全降级 */ }
    }
    const resolvedAnalysis = remoteAnalysis || { ...buildLocalGoalAnalysis(branch.goal, selectedOption), generationSource: 'fallback', generationStage: 'request' };
    const nextRecord = createStepRecord(currentStepIndex, selectedOption, currentApiStepId, currentOptions, resolvedAnalysis);
    const nextSteps = [...branch.steps.filter((step) => step.stepIndex !== currentStepIndex && step.stepIndex < currentStepIndex), nextRecord]
      .sort((left, right) => left.stepIndex - right.stepIndex);
    const nextBranch = { ...branch, steps: nextSteps };
    setAnalysis(resolvedAnalysis);
    setIsAnalyzing(false);
    setPendingBranch(nextBranch);
    setPendingRemoteStep(remoteNext ? { ...remoteNext, totalSteps: remoteAnalysis?.totalSteps || branch.totalSteps || DEFAULT_TOTAL_STEPS, stagePlan: remoteAnalysis?.stagePlan || branch.stagePlan || [], terminal: remoteEnded } : (remoteEnded ? { terminal: true } : null));
  };

  const handleContinue = () => {
    if (!pendingBranch) return;
    if (pendingRemoteStep?.terminal || (!pendingRemoteStep && currentStepIndex >= totalSteps)) {
      const ended = { ...pendingBranch, status: 'ended', outcome: analysis?.outcome ? { ...createOutcome(pendingBranch), rating: analysis.outcome.status, review: analysis.outcome.summary } : createOutcome(pendingBranch) };
      onBranchUpdate(ended);
      onOutcome(ended);
      return;
    }
    const nextBranch = { ...pendingBranch, totalSteps: Number(pendingRemoteStep?.totalSteps) || branch.totalSteps || DEFAULT_TOTAL_STEPS, stagePlan: pendingRemoteStep?.stagePlan || branch.stagePlan || [], apiStepId: pendingRemoteStep?.id || branch.apiStepId, remoteStep: pendingRemoteStep || branch.remoteStep };
    onBranchUpdate(nextBranch);
    setRemoteStep(pendingRemoteStep || null);
    setCurrentStepIndex(currentStepIndex + 1);
    setSelectedKey(null);
    setAnalysis(null);
    setPendingBranch(null);
    setPendingRemoteStep(null);
  };

  const handleMidwayBacktrack = (stepIndex) => {
    const retainedSteps = branch.steps.filter((step) => step.stepIndex <= stepIndex);
    onBranchUpdate({ ...branch, steps: retainedSteps, status: 'in_progress', outcome: null });
    setCurrentStepIndex(stepIndex);
    setSelectedKey(retainedSteps.find((step) => step.stepIndex === stepIndex)?.optionKey || null);
    setAnalysis(null);
    setShowBacktrackPanel(false);
  };

  return (
    <main className="simulation-shell">
      <StatusBar step={currentStep} resources={metrics} onBacktrack={() => setShowBacktrackPanel((current) => !current)} />
      <div className="simulation-content">
        <div className="simulation-branch-label">{branch.name}</div>
        {showBacktrackPanel ? <MidwayBacktrackPanel steps={branch.steps} onConfirm={handleMidwayBacktrack} /> : null}
        {!analysis ? <ChoiceCard step={currentStep} selectedKey={selectedKey} onChoose={(option) => !isAnalyzing && setSelectedKey(option.key)} disabled={isAnalyzing} /> : null}
        {!analysis ? <button className="confirm-choice-button" type="button" disabled={!selectedKey || isAnalyzing} onClick={handleConfirm}>
          {isAnalyzing ? '分析中...' : '确认选择'}
        </button> : null}
        {isAnalyzing ? <AnalysisCard isLoading /> : null}
        {analysis ? <><AnalysisCard data={analysis} isLoading={false} /><SourceCard sources={analysis.sources} /></> : null}
        {analysis && pendingBranch ? <button className="confirm-choice-button next-step-button" type="button" onClick={handleContinue}>{currentStepIndex === totalSteps ? '查看结局复盘' : '进入下一步选择'} <ArrowRight size={16} /></button> : null}
      </div>
    </main>
  );
}

function App() {
  const parseRoute = () => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (!parts.length) return { stage: 'entry' };
    if (parts[0] === 'form') return { stage: 'form' };
    if (parts[0] === 'history' && !parts[1]) return { stage: 'history' };
    if (parts[0] === 'history' && parts[1]) return { stage: 'history-detail', sessionId: parts[1] };
    if (parts[0] === 'simulate') return { stage: 'simulation', sessionId: parts[1], branchId: parts[2] };
    if (parts[0] === 'outcome' && parts[3] === 'timeline') return { stage: 'outcome-timeline', sessionId: parts[1], branchId: parts[2] };
    if (parts[0] === 'outcome' && parts[2]) return { stage: 'outcome', sessionId: parts[1], branchId: parts[2] };
    if (parts[0] === 'report' && parts[2]) return { stage: 'report', sessionId: parts[1], branchId: parts[2] };
    if (parts[0] === 'compare') return { stage: 'compare', sessionId: parts[1] };
    return { stage: 'entry' };
  };
  const stored = (() => {
    try { return JSON.parse(window.localStorage.getItem('ifroad-sessions') || '{}'); } catch { return {}; }
  })();
  const [route, setRoute] = useState(parseRoute);
  const [sessions, setSessions] = useState(stored.sessions || []);
  const [activeSessionId, setActiveSessionId] = useState(stored.activeSessionId || null);
  const [resumeStep, setResumeStep] = useState(1);

  useEffect(() => {
    window.localStorage.setItem('ifroad-sessions', JSON.stringify({ sessions, activeSessionId }));
  }, [sessions, activeSessionId]);

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path, nextRoute = null) => {
    window.history.pushState({}, '', path);
    setRoute(nextRoute || parseRoute());
  };
  const currentSession = sessions.find((session) => session.id === (route.sessionId || activeSessionId)) || null;
  const currentBranch = currentSession?.branches.find((branch) => branch.id === route.branchId || branch.id === currentSession.activeBranchId) || null;
  const endedBranches = currentSession?.branches.filter((branch) => branch.status === 'ended') || [];

  const updateSession = (nextSession) => setSessions((current) => current.map((session) => session.id === nextSession.id ? nextSession : session));

  const startSession = async (payload) => {
    const sessionId = `session-${Date.now()}`;
    const branch = createBranch('branch-1', '分支 A');
    const goalFirstStep = buildGoalFirstStep(payload.goal, { level: payload.foundation });
    branch.goal = payload.goal.trim();
    branch.goalFirstStep = goalFirstStep;
    let apiSessionId = null;
    let remoteStep = null;
    try {
      const remote = await apiRequest('/api/sessions', { method: 'POST', body: JSON.stringify({ goal: payload.goal.trim(), scene: payload.scenario === '升学就业' ? 'career' : 'subject', constraints: { daily_minutes: payload.dailyMinutes, deadline_days: payload.deadlineDays, level: payload.foundation, target: payload.goalType } }) });
      apiSessionId = remote.session_id;
      remoteStep = remote.step;
    } catch { /* local demo fallback */ }
    const totalSteps = Math.min(10, Math.max(8, Number(remoteStep?.totalSteps) || DEFAULT_TOTAL_STEPS));
    const session = { id: sessionId, goal: payload.goal.trim(), createdAt: new Date().toISOString(), totalSteps, stagePlan: remoteStep?.stagePlan || [], branches: [{ ...branch, totalSteps, stagePlan: remoteStep?.stagePlan || [], apiSessionId, apiBranchId: remoteStep?.branchId || null, apiStepId: remoteStep?.id || null, remoteStep }], activeBranchId: branch.id, branchCounter: 1 };
    setSessions((current) => [...current, session]);
    setActiveSessionId(sessionId);
    setResumeStep(1);
    navigate(`/simulate/${sessionId}`, { stage: 'simulation', sessionId });
  };

  const handleBranchUpdate = (nextBranch) => {
    if (!currentSession) return;
    updateSession({ ...currentSession, branches: currentSession.branches.map((branch) => branch.id === nextBranch.id ? nextBranch : branch) });
  };

  const handleOutcome = (endedBranch) => {
    if (!currentSession) return;
    const nextSession = { ...currentSession, activeBranchId: endedBranch.id, branches: currentSession.branches.map((branch) => branch.id === endedBranch.id ? endedBranch : branch) };
    updateSession(nextSession);
    setActiveSessionId(nextSession.id);
    navigate(`/outcome/${nextSession.id}/${endedBranch.id}`, { stage: 'outcome', sessionId: nextSession.id, branchId: endedBranch.id });
  };

  const handleMidwayRollback = (stepIndex) => setResumeStep(stepIndex);
  const handleOutcomeBacktrack = () => navigate(`/outcome/${currentSession.id}/${currentBranch.id}/timeline`, { stage: 'outcome-timeline', sessionId: currentSession.id, branchId: currentBranch.id });

  const handleCreateBranch = async (stepIndex) => {
    if (!currentSession || !currentBranch) return;
    const nextCounter = currentSession.branchCounter + 1;
    let apiBranchId = null;
    let remoteStep = null;
    let apiStepId = currentBranch.steps.find((step) => step.stepIndex === stepIndex)?.apiStepId || currentBranch.remoteStep?.id;
    if (currentBranch.apiSessionId && apiStepId) {
      try {
        const remote = await apiRequest(`/api/sessions/${currentBranch.apiSessionId}/backtrack`, { method: 'POST', body: JSON.stringify({ step_id: apiStepId }) });
        apiBranchId = remote.branch?.id || null;
        apiStepId = remote.step?.id || apiStepId;
        remoteStep = remote.step || null;
      } catch { /* local branch fallback */ }
    }
    const branch = { ...createBranch(`branch-${nextCounter}`, getBranchName(nextCounter), currentBranch.id, stepIndex, currentBranch.steps.filter((step) => step.stepIndex <= stepIndex)), totalSteps: currentBranch.totalSteps || currentSession.totalSteps || DEFAULT_TOTAL_STEPS, stagePlan: currentBranch.stagePlan || currentSession.stagePlan || [], goal: currentSession.goal, goalFirstStep: currentBranch.goalFirstStep || buildGoalFirstStep(currentSession.goal), apiSessionId: currentBranch.apiSessionId, apiBranchId, apiStepId, remoteStep };
    const nextSession = {
      ...currentSession,
      // 分叉点之前的原路径视为已完成，确保结局页可同时比较原路径与新分支。
      branches: currentSession.branches.map((item) => item.id === currentBranch.id ? { ...item, status: 'ended' } : item).concat(branch),
      activeBranchId: branch.id,
      branchCounter: nextCounter,
    };
    updateSession(nextSession);
    setActiveSessionId(nextSession.id);
    setResumeStep(stepIndex);
    navigate(`/simulate/${nextSession.id}`, { stage: 'simulation', sessionId: nextSession.id });
  };

  const createNewBranch = async (sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    const parentBranch = session?.branches.find((branch) => branch.id === route.branchId) || session?.branches.find((branch) => branch.id === session.activeBranchId);
    if (!session || !parentBranch) return;

    const nextCounter = session.branchCounter + 1;
    let apiBranchId = null;
    let remoteStep = null;
    let apiStepId = parentBranch.steps.find((step) => step.stepIndex === 1)?.apiStepId || parentBranch.apiStepId || parentBranch.remoteStep?.id || null;
    if (parentBranch.apiSessionId && apiStepId) {
      try {
        const remote = await apiRequest(`/api/sessions/${parentBranch.apiSessionId}/backtrack`, { method: 'POST', body: JSON.stringify({ step_id: apiStepId }) });
        apiBranchId = remote.branch?.id || null;
        remoteStep = remote.step || null;
        apiStepId = remoteStep?.id || apiStepId;
      } catch { /* 远程分支不可用时才回退本地 */ }
    }
    const branch = {
      ...createBranch(`branch-${nextCounter}`, getBranchName(nextCounter), parentBranch.id, 0),
      goal: session.goal,
      goalFirstStep: parentBranch.goalFirstStep || buildGoalFirstStep(session.goal),
      totalSteps: parentBranch.totalSteps || session.totalSteps || DEFAULT_TOTAL_STEPS,
      stagePlan: parentBranch.stagePlan || session.stagePlan || [],
      apiSessionId: parentBranch.apiSessionId || null,
      apiBranchId,
      apiStepId,
      remoteStep,
    };
    const nextSession = {
      ...session,
      branches: [...session.branches, branch],
      activeBranchId: branch.id,
      branchCounter: nextCounter,
    };

    updateSession(nextSession);
    setActiveSessionId(sessionId);
    setResumeStep(1);
    navigate(`/simulate/${sessionId}`, { stage: 'simulation', sessionId, branchId: branch.id });
  };

  const handleOpenReport = () => {
    if (!currentSession || !currentBranch) return;
    navigate(`/report/${currentSession.id}/${currentBranch.id}`, { stage: 'report', sessionId: currentSession.id, branchId: currentBranch.id });
  };

  const handleContinueBranch = (sessionId, branchId) => {
    const session = sessions.find((item) => item.id === sessionId);
    const branch = session?.branches.find((item) => item.id === branchId);
    if (!session || !branch) return;
    const nextSession = { ...session, activeBranchId: branchId };
    updateSession(nextSession);
    setActiveSessionId(sessionId);
    setResumeStep(Math.min(branch.steps.length + 1, Number(branch.totalSteps) || DEFAULT_TOTAL_STEPS));
    navigate(`/simulate/${sessionId}/${branchId}`, { stage: 'simulation', sessionId, branchId });
  };

  if (route.stage === 'entry') return <EntryGate onQuickStart={() => navigate('/form', { stage: 'form' })} onZhihuLogin={() => navigate('/form', { stage: 'form' })} onHistory={() => navigate('/history', { stage: 'history' })} />;
  if (route.stage === 'form') return <GoalForm initialGoal="" onSubmit={(payload) => payload ? startSession(payload) : navigate('/', { stage: 'entry' })} />;
  if (route.stage === 'history') return <HistoryListPage sessions={sessions} onOpenSession={(id) => navigate(`/history/${id}`, { stage: 'history-detail', sessionId: id })} onHome={() => navigate('/', { stage: 'entry' })} />;
  if (route.stage === 'history-detail') return <HistoryDetailPage session={currentSession} onBack={() => navigate('/history', { stage: 'history' })} onOpenOutcome={(sessionId, branchId) => navigate(`/outcome/${sessionId}/${branchId}`, { stage: 'outcome', sessionId, branchId })} onContinue={handleContinueBranch} />;
  if (!currentSession || !currentBranch) return <HistoryListPage sessions={sessions} onOpenSession={(id) => navigate(`/history/${id}`, { stage: 'history-detail', sessionId: id })} onHome={() => navigate('/', { stage: 'entry' })} />;
  if (route.stage === 'simulation') return <SimulationPage key={currentBranch.id} branch={currentBranch} initialStepIndex={resumeStep} onBranchUpdate={handleBranchUpdate} onOutcome={handleOutcome} />;
  if (route.stage === 'outcome') return <OutcomePage branch={currentBranch} endedBranches={endedBranches} canCompare={endedBranches.length >= 2} onSwitchBranch={(branchId) => navigate(`/outcome/${currentSession.id}/${branchId}`, { stage: 'outcome', sessionId: currentSession.id, branchId })} onBacktrack={handleOutcomeBacktrack} onCompare={() => navigate(`/compare/${currentSession.id}`, { stage: 'compare', sessionId: currentSession.id })} onReport={handleOpenReport} onRestart={() => createNewBranch(currentSession.id)} onHome={() => navigate('/', { stage: 'entry' })} />;
  if (route.stage === 'outcome-timeline') return <TimelinePage history={currentBranch.steps} currentStepIndex={Number(currentBranch.totalSteps) || DEFAULT_TOTAL_STEPS} currentBranchName={currentBranch.name} newBranchName={getBranchName(currentSession.branchCounter + 1)} returnLabel="返回结局" onReturnSimulation={() => navigate(`/outcome/${currentSession.id}/${currentBranch.id}`, { stage: 'outcome', sessionId: currentSession.id, branchId: currentBranch.id })} onReturnStep={handleCreateBranch} />;
  if (route.stage === 'compare') return <BranchComparisonPage branches={endedBranches} onReturnOutcome={() => navigate(`/outcome/${currentSession.id}/${currentBranch.id}`, { stage: 'outcome', sessionId: currentSession.id, branchId: currentBranch.id })} />;
  if (route.stage === 'report') return <ReportPage branch={currentBranch} apiSessionId={currentBranch.apiSessionId} onBack={() => navigate(`/outcome/${currentSession.id}/${currentBranch.id}`, { stage: 'outcome', sessionId: currentSession.id, branchId: currentBranch.id })} onRestart={() => createNewBranch(currentSession.id)} />;
  return null;
}

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
);

