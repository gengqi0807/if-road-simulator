import React from 'react';
import { ArrowRight, History } from 'lucide-react';

function formatDate(value) {
  return new Date(value || Date.now()).toISOString().slice(0, 10);
}

export default function HistoryListPage({ sessions, onOpenSession, onHome }) {
  return (
    <main className="history-page">
      <header className="history-page-header">
        <div>
          <span className="eyebrow-pill"><History size={15} /> 历史记录</span>
          <h1>你的学习路径</h1>
          <p>查看过去创建的问题与所有分支。</p>
        </div>
        <button className="outline-nav-button" type="button" onClick={onHome}>返回首页</button>
      </header>

      {sessions.length === 0 ? (
        <section className="history-empty">
          <History size={30} />
          <h2>还没有历史记录，去创建一个吧</h2>
          <button className="btn btn-primary" type="button" onClick={onHome}>返回首页</button>
        </section>
      ) : (
        <section className="history-list" aria-label="历史问题列表">
          {sessions.map((session) => {
            const inProgressCount = session.branches.filter((branch) => branch.status === 'in_progress').length;
            return (
              <button className="history-list-item" type="button" key={session.id} onClick={() => onOpenSession(session.id)}>
                <div>
                  <h2>{session.goal}</h2>
                  <div className="history-meta">
                    <span>{formatDate(session.createdAt)}</span>
                    <span>共 {session.branches.length} 条分支</span>
                    <span className={inProgressCount ? 'history-status status-progress' : 'history-status status-ended'}>
                      {inProgressCount ? `${inProgressCount} 条进行中` : '全部完成'}
                    </span>
                  </div>
                </div>
                <ArrowRight size={18} />
              </button>
            );
          })}
        </section>
      )}
    </main>
  );
}
