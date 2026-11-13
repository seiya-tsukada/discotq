/// <reference types="vite/client" />

interface ImportMetaEnv {
  // 同一ドメインで配信する場合は空（/api を使う）
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
