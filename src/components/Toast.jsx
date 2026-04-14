import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertCircle, Info, Undo2 } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const showToast = useCallback((message, type = 'success', onUndo) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, exiting: false, onUndo }]);
    timers.current[id] = setTimeout(() => removeToast(id), onUndo ? 5000 : 3000);
    return id;
  }, [removeToast]);

  function handleUndo(toast) {
    if (timers.current[toast.id]) {
      clearTimeout(timers.current[toast.id]);
    }
    toast.onUndo();
    removeToast(toast.id);
  }

  const icons = {
    success: <CheckCircle size={16} />,
    error: <AlertCircle size={16} />,
    info: <Info size={16} />,
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type} ${toast.exiting ? 'exiting' : ''}`}
            onClick={() => !toast.onUndo && removeToast(toast.id)}
          >
            {icons[toast.type]}
            <span style={{ flex: 1 }}>{toast.message}</span>
            {toast.onUndo && (
              <button
                className="toast-undo"
                onClick={(e) => { e.stopPropagation(); handleUndo(toast); }}
                aria-label="Undo"
              >
                <Undo2 size={14} />
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
