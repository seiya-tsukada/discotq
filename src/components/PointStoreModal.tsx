import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, History, Check, Copy, ArrowRight, CreditCard, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GiftItem } from '../types';
import { COPY_FEEDBACK_DURATION_MS } from '../constants/timing';

export const PointStoreModal: React.FC = () => {
  const {
    isPointStoreOpen,
    setIsPointStoreOpen,
    user,
    giftItems,
    exchangePoints,
    pointHistory,
    hasMoreHistory,
    historyStatus,
    loadHistory,
    setIsAuthModalOpen,
    showNotification,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'store' | 'history'>('store');
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  // 交換を送っている間のギフト ID（連打で二重に送らない）
  const [exchangingGiftId, setExchangingGiftId] = useState<string | null>(null);

  // 履歴はサーバーから読む。開いたとき・ログイン状態や交換で中身が空に戻ったときに取り直す
  const needsHistory = isPointStoreOpen && activeTab === 'history' && pointHistory.length === 0;
  useEffect(() => {
    if (needsHistory) void loadHistory();
    // loadHistory はカーソルが変わるたびに作り直されるため、取り直す条件だけで動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsHistory, user.isLoggedIn]);

  if (!isPointStoreOpen) return null;

  const handleExchange = async (gift: GiftItem) => {
    if (!user.isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }
    if (exchangingGiftId) return;

    setExchangingGiftId(gift.id);
    const result = await exchangePoints(gift.id);
    setExchangingGiftId(null);
    if (result.success && result.code) {
      setSelectedGift(gift);
      setIssuedCode(result.code);
    } else {
      showNotification(result.message, undefined, 'warning');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    showNotification('デジタルコードをコピーしました', undefined, 'success');
    setTimeout(() => setCopiedCode(false), COPY_FEEDBACK_DURATION_MS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">リワード交換プログラム</h2>
              <p className="text-xs text-slate-400">提携サービスのデジタルギフト・ポイントへ交換</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsPointStoreOpen(false);
              setIssuedCode(null);
            }}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Balance Bar */}
        <div className="bg-slate-950/60 p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">利用可能ポイント</span>
                <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {user.level}会員
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-white tracking-tight">{user.points.toLocaleString()}</span>
                <span className="text-xs font-semibold text-slate-400">pt</span>
                <span className="text-xs text-slate-500 ml-2">
                  (累計獲得: {user.totalEarnedPoints.toLocaleString()} pt)
                </span>
              </div>
            </div>
          </div>

          {!user.isLoggedIn && (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-sm"
            >
              会員登録でポイントを有効化
            </button>
          )}
        </div>

        {/* Sub Tabs */}
        <div className="flex items-center gap-4 px-5 pt-2.5 bg-slate-950 border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('store')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'store'
                ? 'border-blue-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            交換ラインナップ（{giftItems.length}件）
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-blue-500 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            取引・獲得履歴
          </button>
        </div>

        {/* Issued Gift Code Notice */}
        {issuedCode && selectedGift && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <Check className="w-4 h-4" />
                <span>交換手続きが完了しました</span>
              </div>
              <button onClick={() => setIssuedCode(null)} className="text-xs text-slate-400 hover:text-white">
                閉じる
              </button>
            </div>
            <div className="p-3 bg-slate-900 rounded-lg border border-slate-750 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400">{selectedGift.name}</p>
                <p className="font-mono text-sm font-bold text-white tracking-wider">{issuedCode}</p>
              </div>
              <button
                onClick={() => copyCode(issuedCode)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-medium text-xs rounded-md transition-colors cursor-pointer border border-slate-700"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'コピー済' : 'コードをコピー'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'store' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {giftItems.map((gift) => {
                const canAfford = user.points >= gift.pointsCost;
                const isExchanging = exchangingGiftId === gift.id;
                return (
                  <div
                    key={gift.id}
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start gap-3 mb-2">
                        <img
                          src={gift.iconUrl}
                          alt={gift.name}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">{gift.brand}</span>
                          <h3 className="font-semibold text-xs text-white truncate">{gift.name}</h3>
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{gift.valueDescription}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-slate-100">{gift.pointsCost.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400">pt</span>
                      </div>

                      <button
                        onClick={() => void handleExchange(gift)}
                        disabled={(user.isLoggedIn && !canAfford) || exchangingGiftId !== null}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                          !user.isLoggedIn
                            ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                            : canAfford
                              ? 'bg-blue-600 hover:bg-blue-500 text-white'
                              : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        {!user.isLoggedIn ? (
                          '登録して交換'
                        ) : isExchanging ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>手続き中</span>
                          </>
                        ) : canAfford ? (
                          <>
                            <span>交換申請</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        ) : (
                          `あと ${gift.pointsCost - user.points}pt`
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {pointHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                  {historyStatus === 'loading' ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <p className="text-xs">リワードの獲得・交換履歴はありません。</p>
                  )}
                </div>
              ) : (
                <>
                  {pointHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs font-medium text-slate-200">{item.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.date}</p>
                        {item.giftCode && (
                          <p className="font-mono text-[11px] text-slate-300 mt-0.5 tracking-wider">{item.giftCode}</p>
                        )}
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${item.points > 0 ? 'text-emerald-400' : 'text-slate-400'}`}
                      >
                        {item.points > 0 ? `+${item.points}` : item.points} pt
                      </span>
                    </div>
                  ))}
                  {hasMoreHistory && (
                    <button
                      onClick={() => void loadHistory(true)}
                      disabled={historyStatus === 'loading'}
                      className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {historyStatus === 'loading' ? '読み込み中…' : 'さらに表示'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
