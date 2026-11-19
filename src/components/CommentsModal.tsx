import React, { useState } from 'react';
import { X, Send, MessageSquare, LogIn, Trash2, MailCheck, RotateCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useComments } from '../context/hooks/useComments';
import { COMMENT_MAX_LENGTH, errorMessage } from '../lib/api';
import { formatTimeAgo } from '../lib/format';

const authorLabel = (name: string | null) => name || 'ユーザー';

export const CommentsModal: React.FC = () => {
  const {
    isCommentsModalOpen,
    setIsCommentsModalOpen,
    setIsAuthModalOpen,
    currentVideo,
    setCommentCount,
    showNotification,
    user,
  } = useApp();
  const auth = useAuth();

  const comments = useComments({
    videoId: currentVideo?.id ?? null,
    enabled: isCommentsModalOpen,
    viewerId: auth.user?.id ?? null,
    onCountChange: setCommentCount,
  });

  const [commentInput, setCommentInput] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isCommentsModalOpen || !currentVideo) return null;

  const trimmed = commentInput.trim();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await comments.post(trimmed);
      setCommentInput('');
    } catch (err) {
      // 入力内容は残して、もう一度送れるようにする
      showNotification(`コメントを投稿できませんでした: ${errorMessage(err)}`, undefined, 'warning');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId || !window.confirm('このコメントを削除しますか？')) return;
    setDeletingId(commentId);
    try {
      await comments.remove(commentId);
      showNotification('コメントを削除しました', undefined, 'info');
    } catch (err) {
      showNotification(`コメントを削除できませんでした: ${errorMessage(err)}`, undefined, 'warning');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoadMore = async () => {
    try {
      await comments.loadMore();
    } catch (err) {
      showNotification(`コメントを読み込めませんでした: ${errorMessage(err)}`, undefined, 'warning');
    }
  };

  const handleResendVerification = async () => {
    try {
      await auth.resendVerification();
      showNotification('確認メールを送信しました', undefined, 'info');
    } catch (err) {
      showNotification(`確認メールを送信できませんでした: ${errorMessage(err)}`, undefined, 'warning');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg h-[75vh] sm:h-[560px] bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-white">
              ユーザーレビュー・コメント ({comments.totalCount}件)
            </h3>
          </div>
          <button
            onClick={() => setIsCommentsModalOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {comments.status === 'loading' ? (
            <div className="text-center py-12 text-slate-500 text-xs">読み込み中...</div>
          ) : comments.status === 'error' ? (
            <div className="text-center py-12 text-xs space-y-3">
              <p className="text-slate-400">コメントを読み込めませんでした: {errorMessage(comments.error)}</p>
              <button
                type="button"
                onClick={comments.reload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                再読み込み
              </button>
            </div>
          ) : comments.items.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">まだコメントはありません。</div>
          ) : (
            <>
              {comments.items.map((cmt) => (
                <div
                  key={cmt.id}
                  className="p-3 rounded-lg flex items-start gap-2.5 bg-slate-950 border border-slate-800"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {authorLabel(cmt.author_name).slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-xs text-slate-200 truncate">
                        {authorLabel(cmt.author_name)}
                      </span>
                      {cmt.is_mine && (
                        <span className="text-[10px] px-1 rounded bg-blue-500/15 text-blue-300 shrink-0">自分</span>
                      )}
                      <time
                        dateTime={cmt.created_at}
                        title={new Date(cmt.created_at).toLocaleString('ja-JP')}
                        className="text-[10px] text-slate-500 ml-auto shrink-0"
                      >
                        {formatTimeAgo(cmt.created_at)}
                      </time>
                      {cmt.can_delete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(cmt.id)}
                          disabled={deletingId !== null}
                          title="削除"
                          aria-label="コメントを削除"
                          className="p-0.5 rounded text-slate-500 hover:text-rose-400 disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{cmt.body}</p>
                  </div>
                </div>
              ))}
              {comments.hasMore && (
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={comments.loadingMore}
                  className="w-full py-2 text-xs text-slate-400 hover:text-white disabled:opacity-50 cursor-pointer"
                >
                  {comments.loadingMore ? '読み込み中...' : 'さらに表示'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Input Bar（ゲストはログイン、メール未確認なら確認を案内する） */}
        {!auth.user ? (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">コメントするにはログインが必要です</span>
            <button
              type="button"
              onClick={() => {
                setIsCommentsModalOpen(false);
                setIsAuthModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              ログイン
            </button>
          </div>
        ) : !auth.user.email_verified ? (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">コメントするにはメールアドレスの確認が必要です</span>
            <button
              type="button"
              onClick={() => void handleResendVerification()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
            >
              <MailCheck className="w-3.5 h-3.5" />
              確認メールを再送
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSend(e)}
            className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
            <input
              type="text"
              placeholder="コメントや質問を入力..."
              value={commentInput}
              maxLength={COMMENT_MAX_LENGTH}
              disabled={sending}
              onChange={(e) => setCommentInput(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!trimmed || sending}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
