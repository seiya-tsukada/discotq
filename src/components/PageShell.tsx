import React from 'react';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import { Link } from '../router';

interface PageShellProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

// /user・/admin などの管理系ページ共通のレイアウト
export const PageShell: React.FC<PageShellProps> = ({ title, subtitle, right, children }) => (
  <div className="min-h-screen bg-slate-950">
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 text-slate-300 hover:text-white" title="フィードに戻る">
          <ArrowLeft className="w-4 h-4" />
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600">
            <PlayCircle className="w-4 h-4 text-white" />
          </span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
    <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
  </div>
);
