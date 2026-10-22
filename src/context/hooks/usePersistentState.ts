import { useEffect, useState } from 'react';
import { loadFromStorage, saveToStorage } from '../../lib/storage';

export const usePersistentState = <T>(key: string, fallback: () => T) => {
  const [value, setValue] = useState<T>(() => loadFromStorage(key, fallback));

  useEffect(() => {
    saveToStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
};
