import React, { useEffect, useState } from 'react';
import { ArrowLeft, Copy, Send } from 'lucide-react';
import { demoReport } from '../data/demoReport';
import { useToast } from '../components/Toast';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

const freshnessMap = {
  fresh: { icon: '🟢', label: '新鲜' },
  recent: { icon: '🟡', label: '微旧' },
  old: { icon: '🟠', label: '过时' },
  expired: { icon: '🔴', label: '过期' },
};

function renderMarkdown(text) {
  return text.split('\n').map((paragraph, index) => (
    <p key={`${paragraph}-${index}`}>
      {paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => (
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={partIndex}>{part.slice(2, -2)}</strong>
          : part
      ))}
    </p>
  ));
}

export default function ReportPage({ branch, onBack, onRestart, apiSessionId }) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);
  const [apiReport, setApiReport] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (apiSessionId) {
        try {
          const response = await fetch(`${API_BASE}/api/sessions/${apiSessionId}/report`, { method: 'POST' });
          const payload = await response.json();
          if (!cancelled && payload.ok) setApiReport(payload.data);
        } catch { /* keep local report fallback */ }
      }
      if (!cancelled) setIsGenerating(false);
    };
    const timer = window.setTimeout(load, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [apiSessionId]);

  if (!branch) {
    return (
      <main className="report-page report-empty-page">
        <section className="report-empty-state">
          <h1>请先完成一次完整推演</h1>
          <button className="outline-nav-button" type="button" onClick={onBack}>返回结局</button>
        </section>
      </main>
    );
  }

  if (isGenerating) {
    return (
      <main className="report-page report-generating-page">
        <div className="report-generating" role="status">
          <span className="loading-dots" aria-hidden="true"><i /><i /><i /></span>
          <strong>正在生成复盘...</strong>
        </div>
      </main>
    );
  }

  const report = apiReport ? {
    globalReview: apiReport.summary,
    conditionalGuide: apiReport.guide,
    freshnessSources: (apiReport.freshness || []).map((item, index) => ({ title: item.reason, author: '知乎资料', publishedAt: '2024', level: item.level === 'slightly_old' ? 'recent' : item.level })),
  } : {
    ...demoReport,
    globalReview: demoReport.globalReview.replace('分支 A', branch.name),
  };

  const copyGuide = async () => {
    try {
      await navigator.clipboard.writeText(report.conditionalGuide);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = report.conditionalGuide;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const publishGuide = async () => {
    if (apiSessionId) {
      try {
        const response = await fetch(`${API_BASE}/api/sessions/${apiSessionId}/publish`, { method: 'POST' });
        const payload = await response.json();
        if (payload.ok) return showToast(payload.data.message, 'success');
      } catch { /* local toast fallback */ }
    }
    showToast('已生成攻略草稿，请前往知乎粘贴发布', 'success');
  };

  return (
    <main className="report-page">
      <header className="report-header">
        <button className="outline-nav-button" type="button" onClick={onBack}><ArrowLeft size={16} /> 返回结局</button>
        <h1>学习报告</h1>
        <span className="report-branch-name">{branch.name}</span>
      </header>

      <div className="report-content">
        <section className="report-section">
          <span className="analysis-kicker">路径复盘</span>
          <h2>全局复盘</h2>
          <div className="report-markdown">{renderMarkdown(report.globalReview)}</div>
        </section>

        <section className="report-section">
          <span className="analysis-kicker">行动建议</span>
          <h2>条件化攻略</h2>
          <div className="report-markdown">{renderMarkdown(report.conditionalGuide)}</div>
        </section>

        <section className="report-section">
          <span className="analysis-kicker">资料质量</span>
          <h2>时效性报告</h2>
          <div className="report-source-list">
            {report.freshnessSources.map((source) => {
              const freshness = freshnessMap[source.level];
              return <div className="report-source-item" key={source.title}>
                <div><strong>{source.title}</strong><span>{source.author} · {source.publishedAt}</span></div>
                <span className={`report-freshness freshness-${source.level}`}>{freshness.icon} {freshness.label}</span>
              </div>;
            })}
          </div>
        </section>
      </div>

      <footer className="report-actions">
        <button className="btn btn-primary" type="button" onClick={copyGuide}><Copy size={16} />{copied ? '已复制 ✓' : '复制攻略'}</button>
        <button className="outline-nav-button" type="button" onClick={publishGuide}><Send size={16} />发布到知乎</button>
        <button className="btn btn-link" type="button" onClick={onRestart}>重新开始</button>
      </footer>
    </main>
  );
}
