import React from 'react';
import { Radio, Sparkles, HelpCircle, Clock, Cloud } from 'lucide-react';
import { ChimeType } from '../types';

interface HeaderProps {
  paHornMode?: boolean;
  onTogglePaHornMode?: () => void;
  onOpenAiGenerator: () => void;
  onOpenHelp: () => void;
  selectedChime?: ChimeType;
  onChangeChime?: (chime: ChimeType) => void;
  globalCooldown: number;
  onOpenGoogleDriveModal: () => void;
  isDriveConnected: boolean;
  userEmail?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAiGenerator,
  onOpenHelp,
  globalCooldown,
  onOpenGoogleDriveModal,
  isDriveConnected,
  userEmail,
}) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-2xl bg-black/60 border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* iOS App Brand & Identity */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-[12px] bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 shadow-md shadow-amber-500/25 text-slate-950 transition-transform active:scale-95 cursor-default">
              <Radio className="w-5 h-5 text-slate-950 stroke-[2.2]" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white font-sans">
                  PA Voice Studio
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300 border border-white/[0.08] font-medium hidden sm:inline-block">
                  Phát Thanh Đa Ngữ
                </span>
                {globalCooldown > 0 && (
                  <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse font-mono font-semibold">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Giãn cách: {globalCooldown}s</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block tracking-normal">
                Hệ thống kịch bản loa công cộng • Việt • Anh • Hàn • Trung • Nga
              </p>
            </div>
          </div>

          {/* iOS Navigation Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Google Drive Integration Button */}
            <button
              type="button"
              onClick={onOpenGoogleDriveModal}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 active:scale-95 cursor-pointer backdrop-blur-md ${
                isDriveConnected
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/20 shadow-sm'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 border-white/[0.08]'
              }`}
              title={isDriveConnected ? `Google Drive đã liên kết (${userEmail || ''})` : 'Liên kết Google Drive để lưu audio'}
            >
              <Cloud className={`w-3.5 h-3.5 ${isDriveConnected ? 'text-blue-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Drive</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                isDriveConnected ? 'bg-blue-500/25 text-blue-300' : 'bg-white/[0.08] text-slate-400'
              }`}>
                {isDriveConnected ? 'Đã bật' : 'Tùy chọn'}
              </span>
            </button>

            {/* AI Generator Button */}
            <button
              type="button"
              onClick={onOpenAiGenerator}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/20 transition-all duration-200 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Soạn kịch bản AI</span>
            </button>

            {/* Help Button */}
            <button
              type="button"
              onClick={onOpenHelp}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-slate-400 hover:text-white border border-white/[0.08] transition-all duration-200 flex items-center justify-center cursor-pointer"
              title="Hướng dẫn & Tiêu chuẩn phát thanh"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

