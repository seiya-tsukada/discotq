import React from 'react';
import { Coins, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ToastNotification: React.FC = () => {
  const { notification } = useApp();

  if (!notification) return null;

  const { message, points, type } = notification;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
      <div
        className={`px-3.5 py-2 rounded-lg shadow-lg backdrop-blur-md flex items-center gap-2 border text-xs font-medium ${
          type === 'success'
            ? 'bg-slate-900/95 border-emerald-500/30 text-slate-100'
            : type === 'warning'
              ? 'bg-slate-900/95 border-amber-500/30 text-amber-200'
              : 'bg-slate-900/95 border-blue-500/30 text-slate-200'
        }`}
      >
        {points !== undefined ? (
          <div className="w-5 h-5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
            <Coins className="w-3.5 h-3.5" />
          </div>
        ) : type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : type === 'warning' ? (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
        )}

        <span>{message}</span>
      </div>
    </div>
  );
};
