import { OBSOLETE_LOCAL_STORAGE_KEYS } from '../constants/storage';

export const removeObsoleteKeys = (keys: string[] = OBSOLETE_LOCAL_STORAGE_KEYS) => {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (e) {
    console.error(e);
  }
};

export const runStorageMigrations = () => {
  removeObsoleteKeys();
};
