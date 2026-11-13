import {
  LEGACY_LOCAL_STORAGE_KEY_USER,
  LOCAL_STORAGE_KEY_USER,
  OBSOLETE_LOCAL_STORAGE_KEYS,
} from '../constants/storage';

// 新キーが未作成で旧キーが残っている場合のみ移行し、旧キーは削除する
export const migrateStorageKey = (
  oldKey: string,
  newKey: string,
  transform: (raw: string) => string = (raw) => raw
) => {
  try {
    const legacy = localStorage.getItem(oldKey);
    if (legacy === null) return;
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, transform(legacy));
    }
    localStorage.removeItem(oldKey);
  } catch (e) {
    console.error(e);
  }
};

export const removeObsoleteKeys = (keys: string[] = OBSOLETE_LOCAL_STORAGE_KEYS) => {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error(e);
  }
};

export const runStorageMigrations = () => {
  migrateStorageKey(LEGACY_LOCAL_STORAGE_KEY_USER, LOCAL_STORAGE_KEY_USER);
  removeObsoleteKeys();
};
