import { useCallback, useState } from 'react';
import { NotificationType } from '../../types';
import { NOTIFICATION_DURATION_MS } from '../../constants/timing';

export interface AppNotification {
  message: string;
  points?: number;
  type: NotificationType;
}

export type ShowNotification = (message: string, points?: number, type?: NotificationType) => void;

export const useNotification = () => {
  const [notification, setNotification] = useState<AppNotification | null>(null);

  // 依存配列に入れても再実行されないよう、同じ関数を返し続ける
  const showNotification: ShowNotification = useCallback((message, points, type = 'success') => {
    setNotification({ message, points, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, NOTIFICATION_DURATION_MS);
  }, []);

  return { notification, showNotification };
};
