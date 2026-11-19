// 端末ごとの匿名ID（X-Anonymous-Id として送る）
export const LOCAL_STORAGE_KEY_ANONYMOUS_ID = 'discotq_anonymous_id';

// 使わなくなったキー。起動時に削除する
// * discotq_ads_v3 / adtok_ads_v3: 広告モック時代の動画データ
// * discotq_user_v3 / adtok_user_v3: 端末内のリワードウォレット（残高はサーバーの point_ledger に移した。
//   端末の値は書き換えられるため、サーバーへは移さずに破棄する）
export const OBSOLETE_LOCAL_STORAGE_KEYS = ['discotq_ads_v3', 'adtok_ads_v3', 'discotq_user_v3', 'adtok_user_v3'];
