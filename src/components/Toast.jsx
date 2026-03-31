import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-64 max-w-sm px-4 py-3 rounded-xl shadow-lg transform transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-right-1/2 data-[state=open]:slide-in-from-bottom-2 duration-300 backdrop-blur-md flex items-center justify-between gap-4 border ${
              toast.type === 'success' ? 'bg-[#10b981]/20 border-[#10b981]/30 text-[#10b981]' :
              toast.type === 'error' ? 'bg-[#ef4444]/20 border-[#ef4444]/30 text-[#ef4444]' :
              toast.type === 'warning' ? 'bg-[#f59e0b]/20 border-[#f59e0b]/30 text-[#f59e0b]' :
              'bg-[#3b82f6]/20 border-[#3b82f6]/30 text-[#3b82f6]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span>{
                toast.type === 'success' ? '✅' :
                toast.type === 'error' ? '❌' :
                toast.type === 'warning' ? '⚠️' : 'ℹ️'
              }</span>
              <p className="font-semibold text-sm text-white">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="text-white/50 hover:text-white transition">✖</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
