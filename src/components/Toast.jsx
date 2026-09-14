import React, { createContext, useContext, useEffect, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [offlineVisible, setOfflineVisible] = useState(true);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {offlineVisible ? (
        <div className="offline-demo-banner" role="status">
          <span>当前为离线 Demo 模式，数据为预置内容</span>
          <button type="button" aria-label="关闭离线 Demo 提示" onClick={() => setOfflineVisible(false)}>关闭</button>
        </div>
      ) : null}
      {children}
      {toast ? <div className={`report-toast toast-${toast.type}`} role="status">{toast.message}</div> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

export function DemoErrorState({ onRetry }) {
  return (
    <div className="demo-error-state" role="alert">
      <p>服务暂时不可用，已切换到 Demo 数据</p>
      <button type="button" onClick={onRetry}>重试</button>
    </div>
  );
}
