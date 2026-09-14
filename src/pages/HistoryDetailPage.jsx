import React from 'react';
import { ArrowRight, History } from 'lucide-react';

function formatDate(value) {
  return new Date(value || Date.now()).toISOString().slice(0, 10);
}

export default function HistoryDetailPage({ session, onBack, onOpenOutcome, onContinue }) {
  if (!session) {
    return (
      <main className="history-page">
        <section className="history-empty">
          <h2>找不到这条历史记录</h2>
          <button className="btn btn-primary" type="button" onClick={onBack}>返回历史</button>
        </section>
      </main>
    );
  }

  return (
    <main className="history-page">
      <header className="history-page-header">
        <div>
          <span className="eyebrow-pill"><History size={15} /> 问题详情</span>
          <h1>{session.goal}</h1>
          <p>创建于 {formatDate(session.createdAt)}，共 {session.branches.length} 条分支。</p>
        </div>
        <button className="outline-nav-button" type="button" onClick={onBack}>返回历史</button>
      </header>

      <section className="branch-history-list" aria-label="分支列表">
        {session.branches.map((branch) => {
          const ended = branch.status === 'ended';
          return (
            <button
              className="branch-history-item"
              type="button"
              key={branch.id}
              onClick={() => ended ? onOpenOutcome(session.id, branch.id) : onContinue(session.id, branch.id)}
            >
              <div className="branch-history-copy">
                <div className="branch-history-title">
                  <h2>{branch.name}</h2>
                  <span className={ended ? 'history-status status-ended' : 'history-status status-progress'}>
                    {ended ? '已完成' : '进行中'}
                  </span>
                </div>
                {ended ? <p>{branch.outcome?.totalTime || '路径'}速通型 / 评级 {branch.outcome?.rating || '待评估'}</p> : <p>继续完成剩余决策题</p>}
                <span className="history-branch-date">创建于 {formatDate(branch.createdAt || session.createdAt)}</span>
              </div>
              <ArrowRight size={18} />
            </button>
          );
        })}
      </section>
    </main>
  );
}
