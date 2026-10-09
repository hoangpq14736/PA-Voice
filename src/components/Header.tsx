import React from 'react';
import { Radio, Volume2, Sparkles, Bell, HelpCircle, Key, Clock, Cloud } from 'lucide-react';
import { ChimeType } from '../types';
import { createChimeAudioBuffer, getAudioContext } from '../utils/audioSynthesizer';

interface HeaderProps {
  paHornMode: boolean;
  onTogglePaHornMode: () => void;
  onOpenAiGenerator: () => void;
  onOpenHelp: () => void;
  selectedChime: ChimeType;
  onChangeChime: (chime: ChimeType) => void;
  onOpenApiKeyModal: () => void;
  hasCustomApiKey: boolean;
  globalCooldown: number;
  onOpenGoogleDriveModal: () => void;
  isDriveConnected: boolean;
  userEmail?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  paHornMode,
  onTogglePaHornMode,
  onOpenAiGenerator,
  onOpenHelp,
  selectedChime,
  onChangeChime,
  onOpenApiKeyModal,
  hasCustomApiKey,
  globalCooldown,
  onOpenGoogleDriveModal,
  isDriveConnected,
  userEmail,
}) => {
  const [isPlayingChime, setIsPlayingChime] = React.useState(false);

  const handleTestChime = async () => {
    try {
      setIsPlayingChime(true);
      const ctx = getAudioContext();
      const buffer = await createChimeAudioBuffer(selectedChime);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onended = () => setIsPlayingChime(false);
        source.start(0);
      } else {
        setIsPlayingChime(false);
      }
    } catch {
      setIsPlayingChime(false);
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 shadow-lg shadow-amber-500/20 text-slate-950">
              <Radio className="w-6 h-6 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-wider text-amber-400">PA VOICE STUDIO</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium hidden sm:inline-block">
                  Phát Thanh Đa Ngữ
                </span>
                {globalCooldown > 0 && (
                  <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-mono font-bold">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Giãn cách 3 RPM: {globalCooldown}s</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 hidden md:block">
                Hệ thống chuyển đổi kịch bản thông báo qua loa tự nhiên (Việt • Anh • Hàn • Trung • Nga)
              </p>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Chime selector & test */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 rounded-lg p-1 border border-slate-700/60 text-xs">
              <span className="text-slate-400 pl-2 flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                Chuông hiệu:
              </span>
              <select
                value={selectedChime}
                onChange={(e) => onChangeChime(e.target.value as ChimeType)}
                aria-label="Chọn điệu chuông thông báo"
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="sunworld">Chuông ngân 4 nốt (Êm ái)</option>
                <option value="dingdong">Ding-Dong (Tiêu chuẩn)</option>
                <option value="attention">Attention Chime (3 nốt)</option>
                <option value="urgent">Cảnh báo khẩn cấp (2 nốt)</option>
                <option value="none">Không dùng chuông</option>
              </select>
              <button
                type="button"
                onClick={handleTestChime}
                disabled={isPlayingChime || selectedChime === 'none'}
                title="Nghe thử chuông hiệu"
                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded font-medium transition cursor-pointer disabled:opacity-40"
              >
                {isPlayingChime ? 'Đang reo...' : 'Nghe thử'}
              </button>
            </div>

            {/* PA Outdoor Speaker Horn Simulator Toggle */}
            <button
              type="button"
              onClick={onTogglePaHornMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                paHornMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Mô phỏng hiệu ứng âm thanh qua hệ thống loa nén ngoài trời thực tế"
            >
              <Volume2 className="w-4 h-4" />
              <span className="hidden sm:inline">Mô phỏng</span> Loa Ngoài Trời
              {paHornMode && <span className="text-[10px] bg-slate-950/30 px-1 rounded">BẬT</span>}
            </button>

            {/* Google Drive Integration Button */}
            <button
              type="button"
              onClick={onOpenGoogleDriveModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                isDriveConnected
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title={isDriveConnected ? `Google Drive đã kết nối (${userEmail || ''})` : 'Liên kết Google Drive (Tùy chọn) để lưu file MP3'}
            >
              <Cloud className={`w-3.5 h-3.5 ${isDriveConnected ? 'text-blue-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Google Drive</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                isDriveConnected ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'
              }`}>
                {isDriveConnected ? 'Đã kết nối' : 'Tùy chọn'}
              </span>
            </button>

            {/* Custom Gemini API Key Settings Button */}
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                hasCustomApiKey
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Cấu hình API Key Gemini cá nhân (khi chia sẻ/publish cho người khác dùng)"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Khóa API</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                hasCustomApiKey ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
              }`}>
                {hasCustomApiKey ? 'Key riêng' : 'Mặc định'}
              </span>
            </button>

            {/* AI Generator Button */}
            <button
              type="button"
              onClick={onOpenAiGenerator}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md shadow-emerald-900/30 border border-emerald-400/30 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Soạn kịch bản AI</span>
            </button>

            {/* Help Button */}
            <button
              type="button"
              onClick={onOpenHelp}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition cursor-pointer"
              title="Hướng dẫn sử dụng & Quy chuẩn phát thanh"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
