import React, { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../lib/api';

// メール未確認のログインユーザーに確認を促す
export const VerifyEmailBanner: React.FC = () => {
  const { user, resendVerification } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!user || user.email_verified) return null;

  const resend = async () => {
    setSending(true);
    try {
      await resendVerification();
      setMessage('確認メールを再送しました');
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
      <MailWarning className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-[200px]">
        {user.email} 宛の確認メールのリンクを開くと、匿名投稿の紐づけなどが使えるようになります。
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-60 cursor-pointer"
      >
        確認メールを再送
      </button>
      {message && <span className="w-full text-amber-100">{message}</span>}
    </div>
  );
};
