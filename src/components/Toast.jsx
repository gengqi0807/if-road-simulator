import React, { createContext, useContext, useEffect, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

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
      <p>服务暂时不可用，请稍后重试</p>
      <button type="button" onClick={onRetry}>重试</button>
    </div>
  );
}
