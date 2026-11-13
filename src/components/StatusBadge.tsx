import React from 'react';
import { STATUS_LABELS, STATUS_TONES } from '../lib/videoFile';
import type { VideoStatus } from '../types/api';

export const StatusBadge: React.FC<{ status: VideoStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${STATUS_TONES[status]}`}
  >
    {STATUS_LABELS[status]}
  </span>
);
