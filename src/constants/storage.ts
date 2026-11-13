export const LOCAL_STORAGE_KEY_USER = 'discotq_user_v3';
// 端末ごとの匿名投稿者ID（X-Anonymous-Id として送る）
export const LOCAL_STORAGE_KEY_ANONYMOUS_ID = 'discotq_anonymous_id';

// 旧ブランド名 (AdTok) 時代のキー。起動時に新キーへ移行する
export const LEGACY_LOCAL_STORAGE_KEY_USER = 'adtok_user_v3';

// 広告モック時代に使っていたキー。動画 API への移行に伴い起動時に削除する
export const OBSOLETE_LOCAL_STORAGE_KEYS = ['discotq_ads_v3', 'adtok_ads_v3'];
