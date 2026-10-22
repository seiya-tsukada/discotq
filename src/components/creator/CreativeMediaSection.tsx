import React from 'react';
import { Upload, Video } from 'lucide-react';
import { PRESET_CREATIVES } from '../../constants/ads';
import { CreatorAdForm } from './useCreatorAdForm';

interface CreativeMediaSectionProps {
  form: CreatorAdForm;
}

export const CreativeMediaSection: React.FC<CreativeMediaSectionProps> = ({ form }) => {
  const { videoUrl, uploadedFileName, handleFileUpload, handleSelectPreset } = form;

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <Video className="w-4 h-4 text-blue-400" />
        <span>1. クリエイティブ素材のアップロード</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dropzone */}
        <div className="relative border-2 border-dashed border-slate-750 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors bg-slate-950/60">
          <input
            type="file"
            accept="video/*,image/*"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Upload className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-white">
            {uploadedFileName ? `選択中: ${uploadedFileName}` : '動画・静止画ファイルをドラッグ＆ドロップ'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">MP4, MOV, WebM, PNG, JPG (9:16縦型推奨)</p>
        </div>

        {/* Preset alternatives */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-slate-400 block">または サンプル動画から選択:</span>
          <div className="space-y-2">
            {PRESET_CREATIVES.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center gap-2.5 cursor-pointer ${
                  videoUrl === p.url && !uploadedFileName
                    ? 'bg-slate-850 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
