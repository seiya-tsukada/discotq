import React, { useState, useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { HeaderNav } from './components/HeaderNav';
import { AdVideoFeed } from './components/AdVideoFeed';
import { CreatorPortal } from './components/creator/CreatorPortal';
import { AdminPortal } from './components/admin/AdminPortal';
import { LandingPageModal } from './components/LandingPageModal';
import { PointStoreModal } from './components/PointStoreModal';
import { AuthModal } from './components/AuthModal';
import { CommentsModal } from './components/CommentsModal';
import { ShareModal } from './components/ShareModal';
import { ToastNotification } from './components/ToastNotification';

type AppRoute = 'feed' | 'creator' | 'admin';

function getInitialRoute(): AppRoute {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.includes('/creator') || hash.includes('creator')) {
    return 'creator';
  }
  if (path.includes('/admin') || hash.includes('admin')) {
    return 'admin';
  }
  return 'feed';
}

function MainApp() {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(getInitialRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const navigateTo = (route: AppRoute) => {
    setCurrentRoute(route);
    const targetUrl = route === 'feed' ? '/' : `/${route}`;
    window.history.pushState({}, '', targetUrl);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white antialiased">
      {/* Route: Creator Portal (/creator) */}
      {currentRoute === 'creator' && (
        <>
          <CreatorPortal />
          <LandingPageModal />
          <ToastNotification />
        </>
      )}

      {/* Route: Admin Portal (/admin) */}
      {currentRoute === 'admin' && (
        <>
          <AdminPortal />
          <LandingPageModal />
          <ToastNotification />
        </>
      )}

      {/* Route: Public Viewer Feed (/) */}
      {currentRoute === 'feed' && (
        <>
          <HeaderNav />
          <main className="pt-14">
            <AdVideoFeed />
          </main>
          <LandingPageModal />
          <PointStoreModal />
          <AuthModal />
          <CommentsModal />
          <ShareModal />
          <ToastNotification />
        </>
      )}

      {/* Discreet Development / Direct URL Helper (Bottom Right) */}
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 p-1 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-lg text-[10px] text-slate-400 opacity-60 hover:opacity-100 transition-opacity">
        <span className="px-1 font-semibold text-slate-500">直叩きURL:</span>
        <button
          onClick={() => navigateTo('feed')}
          className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
            currentRoute === 'feed' ? 'bg-blue-600 text-white font-bold' : 'hover:text-white'
          }`}
          title="一般ユーザー向けフィード (/)"
        >
          / (視聴)
        </button>
        <button
          onClick={() => navigateTo('creator')}
          className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
            currentRoute === 'creator' ? 'bg-blue-600 text-white font-bold' : 'hover:text-white'
          }`}
          title="広告配信者・出店管理画面 (/creator)"
        >
          /creator
        </button>
        <button
          onClick={() => navigateTo('admin')}
          className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
            currentRoute === 'admin' ? 'bg-emerald-600 text-white font-bold' : 'hover:text-white'
          }`}
          title="プラットフォーム広告審査 (/admin)"
        >
          /admin
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
