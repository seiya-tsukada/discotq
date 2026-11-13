import React from 'react';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { useLocation } from './router';
import { HeaderNav } from './components/HeaderNav';
import { VideoFeed } from './components/VideoFeed';
import { PointStoreModal } from './components/PointStoreModal';
import { AuthModal } from './components/AuthModal';
import { CommentsModal } from './components/CommentsModal';
import { ShareModal } from './components/ShareModal';
import { ToastNotification } from './components/ToastNotification';
import { UserPage } from './pages/user/UserPage';
import { AdminPage } from './pages/admin/AdminPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

const FeedPage: React.FC = () => (
  <>
    <HeaderNav />
    <main className="pt-14">
      <VideoFeed />
    </main>
    <PointStoreModal />
    <AuthModal />
    <CommentsModal />
    <ShareModal />
  </>
);

// パス → 画面。一致しないパスはフィードを表示する（vercel.json で SPA の index.html に集約）
const ROUTES: Record<string, React.FC> = {
  '/': FeedPage,
  '/user': UserPage,
  '/admin': AdminPage,
  '/verify-email': VerifyEmailPage,
  '/reset-password': ResetPasswordPage,
};

const normalize = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname).toLowerCase();

function MainApp() {
  const { pathname } = useLocation();
  const Page = ROUTES[normalize(pathname)] ?? FeedPage;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white antialiased">
      <Page />
      <ToastNotification />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <MainApp />
      </AppProvider>
    </AuthProvider>
  );
}
