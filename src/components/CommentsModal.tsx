import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const CommentsModal: React.FC = () => {
  const { 
    isCommentsModalOpen, 
    setIsCommentsModalOpen, 
    ads, 
    currentAdIndex, 
    comments, 
    addComment,
    user 
  } = useApp();

  const [commentInput, setCommentInput] = useState('');

  if (!isCommentsModalOpen) return null;

  const currentAd = ads[currentAdIndex] || ads[0];
  const adComments = comments[currentAd.id] || [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    addComment(currentAd.id, commentInput);
    setCommentInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg h-[75vh] sm:h-[560px] bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-white">
              ユーザーレビュー・コメント ({adComments.length}件)
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
          {adComments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              まだコメントはありません。
            </div>
          ) : (
            adComments.map((cmt) => (
              <div 
                key={cmt.id} 
                className={`p-3 rounded-lg flex items-start gap-2.5 ${
                  cmt.isSponsorReply 
                    ? 'bg-slate-950 border border-blue-500/30' 
                    : 'bg-slate-950 border border-slate-800'
                }`}
              >
                <img
                  src={cmt.userAvatar}
                  alt={cmt.userName}
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-semibold text-xs text-slate-200 truncate">
                      {cmt.userName}
                    </span>
                    {cmt.isSponsorReply && (
                      <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                        公式回答
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 ml-auto">{cmt.timeAgo}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {cmt.comment}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-7 h-7 rounded-full object-cover shrink-0"
          />
          <input
            type="text"
            placeholder={user.isLoggedIn ? "コメントや質問を入力..." : "ビジターとしてコメントを入力..."}
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!commentInput.trim()}
            className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
