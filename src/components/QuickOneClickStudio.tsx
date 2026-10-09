import React, { useState } from 'react';
import {
  LanguageCode,
  ScriptState,
  AudioFormat,
  PacingState,
} from '../types';
import { LANGUAGES_CONFIG } from '../utils/presets';
import {
  Sparkles,
  Zap,
  Download,
  FileArchive,
  Loader2,
  CheckCircle2,
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileDown,
  Layers,
  Mic,
  Sliders,
  Users,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Cloud,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  decodeAudioData,
  processAudioBuffer,
  getAudioContext,
  encodeAudioBlob,
} from '../utils/audioSynthesizer';
import { createAndDownloadZip, downloadFilesIndividually } from '../utils/zipExporter';
import {
  googleSignIn,
  getOrCreateAppFolder,
  uploadAudioToDrive,
} from '../services/googleDriveService';

interface QuickOneClickStudioProps {
  scriptsState: Record<LanguageCode, ScriptState>;
  onUpdateVietnameseText: (text: string) => void;
  onUpdateScript: (lang: LanguageCode, partial: Partial<ScriptState>) => void;
  onExecuteOneClickFlow: () => Promise<void>;
  isProcessingOneClick: boolean;
  onAutoTranslateOnly: () => Promise<void>;
  isTranslating: boolean;
  onGenerateAudioOnly: () => Promise<void>;
  isGeneratingAudio: boolean;
  audioFormat: AudioFormat;
  onChangeAudioFormat: (format: AudioFormat) => void;
  announcementTitle: string;
  masterBuffer: AudioBuffer | null;
  paHornMode: boolean;
  pacingState: PacingState;
  globalCooldown: number;
  onCancelPacing: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onAuthChange: (user: User | null, token: string | null) => void;
  onOpenGoogleDriveModal: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const QuickOneClickStudio: React.FC<QuickOneClickStudioProps> = ({
  scriptsState,
  onUpdateVietnameseText,
  onUpdateScript,
  onExecuteOneClickFlow,
  isProcessingOneClick,
  onAutoTranslateOnly,
  isTranslating,
  onGenerateAudioOnly,
  isGeneratingAudio,
  audioFormat,
  onChangeAudioFormat,
  announcementTitle,
  masterBuffer,
  paHornMode,
  pacingState,
  globalCooldown,
  onCancelPacing,
  currentUser,
  accessToken,
  onAuthChange,
  onOpenGoogleDriveModal,
  onShowToast,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const [showApiExplainer, setShowApiExplainer] = useState(false);
  const [showVoiceCustomizer, setShowVoiceCustomizer] = useState(true);

  const viText = scriptsState.vi.text;
  const wordCount = viText.trim() ? viText.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.round((wordCount / 120) * 60);

  // Check how many languages have audio ready
  const languages: LanguageCode[] = ['vi', 'en', 'ko', 'zh', 'ru'];
  const readyLangs = languages.filter((l) => !!scriptsState[l].audioBase64);
  const allReady = readyLangs.length === 5;

  // Batch presets for voices
  const handleSetAllVoices = (type: 'female' | 'male' | 'alternating') => {
    if (type === 'female') {
      onUpdateScript('vi', { voice: 'Kore' });
      onUpdateScript('en', { voice: 'Kore' });
      onUpdateScript('ko', { voice: 'Zephyr' });
      onUpdateScript('zh', { voice: 'Kore' });
      onUpdateScript('ru', { voice: 'Kore' });
    } else if (type === 'male') {
      onUpdateScript('vi', { voice: 'Puck' });
      onUpdateScript('en', { voice: 'Puck' });
      onUpdateScript('ko', { voice: 'Puck' });
      onUpdateScript('zh', { voice: 'Puck' });
      onUpdateScript('ru', { voice: 'Puck' });
    } else if (type === 'alternating') {
      onUpdateScript('vi', { voice: 'Kore' }); // Nữ
      onUpdateScript('en', { voice: 'Puck' }); // Nam
      onUpdateScript('ko', { voice: 'Zephyr' }); // Nữ
      onUpdateScript('zh', { voice: 'Puck' }); // Nam
      onUpdateScript('ru', { voice: 'Zephyr' }); // Nữ
    }
  };

  const handleSetAllSpeeds = (speed: number) => {
    languages.forEach((l) => {
      onUpdateScript(l, { speed });
    });
  };

  const handleResetToDefaultVoices = () => {
    LANGUAGES_CONFIG.forEach((cfg) => {
      onUpdateScript(cfg.code, {
        voice: cfg.defaultVoice,
        speed: cfg.defaultSpeed,
        pitch: cfg.defaultPitch,
      });
    });
  };

  const handleDownloadAllZip = async () => {
    if (readyLangs.length === 0) {
      alert('Chưa có file audio nào được tạo! Hãy bấm nút "1-Chạm: Dịch & Tạo 5 file audio" trước.');
      return;
    }

    setIsZipping(true);
    try {
      const ctx = getAudioContext();
      const items = [];

      for (const lang of readyLangs) {
        const state = scriptsState[lang];
        if (state.audioBase64) {
          const raw = await decodeAudioData(state.audioBase64, ctx);
          const processed = await processAudioBuffer(raw, {
            speed: state.speed,
            pitchSemitones: state.pitch,
            paHornEffect: paHornMode,
          });

          const langLabels: Record<LanguageCode, string> = {
            vi: 'Tiếng Việt',
            en: 'Tiếng Anh (English)',
            ko: 'Tiếng Hàn (한국어)',
            zh: 'Tiếng Trung (中文)',
            ru: 'Tiếng Nga (Русский)',
          };

          items.push({
            code: lang,
            label: langLabels[lang],
            buffer: processed,
            text: state.text,
          });
        }
      }

      await createAndDownloadZip({
        title: announcementTitle || 'ThongBao_PhatThanh',
        items,
        masterBuffer,
        format: audioFormat,
      });
    } catch (err) {
      console.error('ZIP download error:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadIndividually = async () => {
    if (readyLangs.length === 0) {
      alert('Chưa có file audio nào được tạo để tải!');
      return;
    }

    setIsZipping(true);
    try {
      const ctx = getAudioContext();
      const items = [];

      for (const lang of readyLangs) {
        const state = scriptsState[lang];
        if (state.audioBase64) {
          const raw = await decodeAudioData(state.audioBase64, ctx);
          const processed = await processAudioBuffer(raw, {
            speed: state.speed,
            pitchSemitones: state.pitch,
            paHornEffect: paHornMode,
          });

          items.push({
            code: lang,
            label: lang,
            buffer: processed,
            text: state.text,
          });
        }
      }

      await downloadFilesIndividually({
        title: announcementTitle,
        items,
        format: audioFormat,
      });
    } catch (err) {
      console.error('Individual download error:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveSaveProgress, setDriveSaveProgress] = useState<{
    current: number;
    total: number;
    langName: string;
  } | null>(null);

  const handleSaveAllToGoogleDrive = async () => {
    if (readyLangs.length === 0) {
      onShowToast('Chưa có file audio nào được tạo! Hãy bấm nút "1-Chạm" để tạo âm thanh trước.', 'info');
      return;
    }

    let token = accessToken;
    if (!token) {
      try {
        const authResult = await googleSignIn();
        token = authResult.accessToken;
        onAuthChange(authResult.user, authResult.accessToken);
        onShowToast(`Đã liên kết Google Drive: ${authResult.user.email}`, 'success');
      } catch (err: any) {
        if (err.code !== 'auth/popup-closed-by-user') {
          onShowToast('Cần đăng nhập Google để lưu file: ' + (err.message || ''), 'error');
        }
        return;
      }
    }

    setIsSavingToDrive(true);
    try {
      const folder = await getOrCreateAppFolder(token);
      const ctx = getAudioContext();
      const langLabels: Record<LanguageCode, string> = {
        vi: 'Tiếng Việt',
        en: 'Tiếng Anh (English)',
        ko: 'Tiếng Hàn (한국어)',
        zh: 'Tiếng Trung (中文)',
        ru: 'Tiếng Nga (Русский)',
      };

      let uploadedCount = 0;
      for (let i = 0; i < readyLangs.length; i++) {
        const lang = readyLangs[i];
        const state = scriptsState[lang];
        if (!state.audioBase64) continue;

        setDriveSaveProgress({
          current: i + 1,
          total: readyLangs.length,
          langName: langLabels[lang] || lang,
        });

        const raw = await decodeAudioData(state.audioBase64, ctx);
        const processed = await processAudioBuffer(raw, {
          speed: state.speed,
          pitchSemitones: state.pitch,
          paHornEffect: paHornMode,
        });

        const { blob, extension, mimeType } = encodeAudioBlob(processed, audioFormat);
        const cleanTitle = (announcementTitle || 'ThongBao_PhatThanh').replace(/[/\\?%*:|"<>]/g, '-');
        const fileName = `${cleanTitle}_${lang.toUpperCase()}_${Date.now()}.${extension}`;

        await uploadAudioToDrive({
          accessToken: token,
          fileName,
          blob,
          mimeType: mimeType || 'audio/mpeg',
          folderId: folder.id,
          description: `Thông báo phát thanh (${langLabels[lang]}): ${state.text.substring(0, 100)}...`,
        });

        uploadedCount++;
      }

      onShowToast(
        `Đã lưu thành công ${uploadedCount} file ${audioFormat.toUpperCase()} vào thư mục Drive "${folder.name}"!`,
        'success'
      );
    } catch (err: any) {
      console.error('Drive save error:', err);
      onShowToast('Lỗi lưu Google Drive: ' + (err.message || ''), 'error');
    } finally {
      setIsSavingToDrive(false);
      setDriveSaveProgress(null);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30">
            <Zap className="w-6 h-6 fill-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-100">
                Chế Độ 1-Chạm: Nhập Tiếng Việt ➔ Tải 5 File Audio
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Tối Ưu Ít API Nhất
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Chỉ cần soạn bản Việt Nam: Chọn chất giọng tùy ý, AI tự dịch sang Anh, Hàn, Trung, Nga và tạo file MP3 tải về cùng lúc
            </p>
          </div>
        </div>

        {/* Format Selector: MP3 vs WAV */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <span className="text-[11px] font-medium text-slate-400 pl-2">Định dạng file:</span>
          <button
            type="button"
            onClick={() => onChangeAudioFormat('mp3')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              audioFormat === 'mp3'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Định dạng MP3 tiêu chuẩn: nhỏ gọn, tương thích mọi loại loa nén, amply và USB phát thanh"
          >
            MP3 (Khuyên dùng)
          </button>
          <button
            type="button"
            onClick={() => onChangeAudioFormat('wav')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              audioFormat === 'wav'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Định dạng WAV: chuẩn phòng thu không nén (dung lượng lớn hơn)"
          >
            WAV
          </button>
        </div>
      </div>

      {/* 1. Main Vietnamese Input Field */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between text-xs">
          <label className="font-bold text-slate-200 flex items-center gap-2">
            <span className="text-lg">🇻🇳</span>
            <span>Nội dung kịch bản thông báo Tiếng Việt (Bản gốc):</span>
          </label>
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-amber-400" /> ~{estimatedSeconds} giây đọc
            </span>
            <span>•</span>
            <span className="font-mono">{wordCount} từ</span>
          </div>
        </div>

        <textarea
          rows={3}
          value={viText}
          onChange={(e) => onUpdateVietnameseText(e.target.value)}
          placeholder="Nhập nội dung thông báo tiếng Việt tại đây... Ví dụ: Kính thưa quý khách, chương trình biểu diễn nghệ thuật sẽ chính thức bắt đầu sau 15 phút nữa tại khu vực sân khấu chính. Xin mời quý khách vui lòng ổn định chỗ ngồi..."
          className="w-full bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition leading-relaxed shadow-inner font-normal"
        />
      </div>

      {/* 2. PRE-GENERATION VOICE & SPEED CONFIGURATOR (NEW REQUESTED FEATURE) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 relative z-10 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>Chọn Chất Giọng & Tốc Độ Cho Từng Ngôn Ngữ (Trước Khi Bấm Tạo)</span>
                <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-medium hidden md:inline">
                  Áp dụng ngay cho 1-Chạm
                </span>
              </h3>
            </div>
          </div>

          {/* Quick Voice Batch Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400 hidden lg:inline">Chọn nhanh:</span>
            <button
              type="button"
              onClick={() => handleSetAllVoices('female')}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700/80 transition cursor-pointer"
              title="Đặt toàn bộ 5 ngôn ngữ sang giọng Nữ truyền cảm"
            >
              👩 Tất cả giọng Nữ
            </button>
            <button
              type="button"
              onClick={() => handleSetAllVoices('male')}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700/80 transition cursor-pointer"
              title="Đặt toàn bộ 5 ngôn ngữ sang giọng Nam trầm ấm dõng dạc"
            >
              👨 Tất cả giọng Nam
            </button>
            <button
              type="button"
              onClick={() => handleSetAllVoices('alternating')}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700/80 transition cursor-pointer"
              title="Đan xen Nữ & Nam theo chuẩn phát thanh quốc tế"
            >
              🎭 Đan xen Nữ - Nam
            </button>
            <button
              type="button"
              onClick={handleResetToDefaultVoices}
              className="p-1 text-slate-500 hover:text-slate-300 transition cursor-pointer"
              title="Khôi phục mặc định"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowVoiceCustomizer(!showVoiceCustomizer)}
              className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer sm:hidden"
            >
              {showVoiceCustomizer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 5 Languages Voice & Speed Cards Grid */}
        {showVoiceCustomizer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {LANGUAGES_CONFIG.map((cfg) => {
              const langState = scriptsState[cfg.code];
              const selectedVoiceOption = cfg.voiceOptions.find((v) => v.id === langState.voice) || cfg.voiceOptions[0];

              return (
                <div
                  key={cfg.code}
                  className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col justify-between space-y-2.5 transition"
                >
                  {/* Language Card Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                    <span className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                      <span className="text-base">{cfg.flag}</span>
                      <span>{cfg.name}</span>
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        selectedVoiceOption?.gender === 'Nữ'
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                          : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      }`}
                    >
                      {selectedVoiceOption?.gender === 'Nữ' ? 'Giọng Nữ' : 'Giọng Nam'}
                    </span>
                  </div>

                  {/* Voice Selector */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-medium text-slate-400">
                        Chất giọng (AI Voice):
                      </label>
                      <span className="text-[10px] text-amber-400/90 font-mono">
                        {cfg.voiceOptions.length} lựa chọn
                      </span>
                    </div>
                    <select
                      value={langState.voice}
                      onChange={(e) => onUpdateScript(cfg.code, { voice: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      <optgroup label="👩 Giọng Nữ (8 chất giọng)">
                        {cfg.voiceOptions.filter(v => v.gender === 'Nữ').map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="👨 Giọng Nam (8 chất giọng)">
                        {cfg.voiceOptions.filter(v => v.gender === 'Nam').map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {selectedVoiceOption?.style && (
                      <p className="mt-1 text-[10px] text-slate-400 italic line-clamp-1">
                        🎯 {selectedVoiceOption.style}
                      </p>
                    )}
                  </div>

                  {/* Speed Selector */}
                  <div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                      <span>Tốc độ đọc:</span>
                      <span className="font-mono font-bold text-amber-400">{langState.speed.toFixed(2)}x</span>
                    </div>
                    <select
                      value={langState.speed}
                      onChange={(e) => onUpdateScript(cfg.code, { speed: parseFloat(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      <option value={0.85}>0.85x (Chậm rõ ràng)</option>
                      <option value={0.95}>0.95x (Vừa phải ngoài trời)</option>
                      <option value={1.0}>1.00x (Chuẩn tự nhiên)</option>
                      <option value={1.1}>1.10x (Nhanh gọn)</option>
                      <option value={1.2}>1.20x (Khẩn cấp)</option>
                    </select>
                  </div>

                  {/* Tone Pitch Selector */}
                  <div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                      <span>Tông giọng (Pitch):</span>
                      <span className="font-mono font-bold text-amber-400">
                        {langState.pitch > 0 ? `+${langState.pitch}` : langState.pitch === 0 ? 'Chuẩn' : langState.pitch}
                      </span>
                    </div>
                    <select
                      value={langState.pitch}
                      onChange={(e) => onUpdateScript(cfg.code, { pitch: parseInt(e.target.value, 10) })}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
                    >
                      <option value={-2}>Trầm ấm (-2)</option>
                      <option value={0}>Chuẩn tự nhiên (0)</option>
                      <option value={2}>Sáng bổng (+2)</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Global Speed Presets Bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>Đồng bộ tốc độ cả 5 thứ tiếng:</span>
            <button
              type="button"
              onClick={() => handleSetAllSpeeds(0.9)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 cursor-pointer"
            >
              🐢 Chậm rõ (0.9x ngoài trời)
            </button>
            <button
              type="button"
              onClick={() => handleSetAllSpeeds(1.0)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 cursor-pointer"
            >
              ⚡ Chuẩn tự nhiên (1.0x)
            </button>
            <button
              type="button"
              onClick={() => handleSetAllSpeeds(1.15)}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 cursor-pointer"
            >
              🚀 Nhanh gọn (1.15x)
            </button>
          </div>
        </div>
      </div>

      {/* Live Voice Summary Banner (Displays exact voices selected) */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-3.5 py-2 text-[11px] text-slate-300 flex items-center justify-between flex-wrap gap-2 relative z-10">
        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <Mic className="w-3.5 h-3.5" />
          <span>Giọng sẽ tạo:</span>
        </span>
        <div className="flex items-center gap-3 flex-wrap font-medium">
          {LANGUAGES_CONFIG.map((cfg) => {
            const st = scriptsState[cfg.code];
            return (
              <span key={cfg.code} className="flex items-center gap-1">
                <span>{cfg.flag}</span>
                <span className="text-slate-200">{st.voice}</span>
                <span className="text-slate-500 text-[10px]">({st.speed.toFixed(1)}x)</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* 2.5 ACTIVE 20s RATE-LIMIT PACING CARD (Shown when 1-Click or Batch Pacing is running) */}
      {(pacingState.isActive && pacingState.mode === 'one-click') && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-4.5 space-y-3 relative z-10 animate-in fade-in duration-200 shadow-xl shadow-amber-950/30">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-amber-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 font-black animate-pulse">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extrabold text-amber-300">
                    Chế Độ 1-Chạm An Toàn (Giới Hạn 3 RPM): Đang Giãn Cách 20 Giây
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                    {pacingState.completedCount}/5 Hoàn tất
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  {pacingState.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onCancelPacing}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 transition cursor-pointer"
            >
              Dừng / Hủy
            </button>
          </div>

          {/* 20s Delay Countdown Progress Bar */}
          {pacingState.phase === 'delaying_cooldown' && (
            <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-amber-500/30">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Đang đếm ngược 20 giây chống khóa 3 RPM:
                </span>
                <span className="font-mono font-black text-amber-400 text-sm">
                  {pacingState.remainingSeconds}s / 20s
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${Math.max(5, ((20 - pacingState.remainingSeconds) / 20) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Mô hình TTS giới hạn 3 request/phút. Việc tạm dừng đúng 20 giây đảm bảo không bao giờ bị lỗi 429 Quota Exceeded.
              </p>
            </div>
          )}

          {/* 5-Language Stepper Indicator */}
          <div className="grid grid-cols-5 gap-2 pt-1 text-center">
            {LANGUAGES_CONFIG.map((cfg) => {
              const hasAudio = !!scriptsState[cfg.code].audioBase64;
              const isCurrent = pacingState.currentLang === cfg.code;
              const isNext = pacingState.nextLang === cfg.code;

              return (
                <div
                  key={cfg.code}
                  className={`p-2 rounded-xl text-xs font-medium border transition ${
                    hasAudio
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : isCurrent
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 ring-2 ring-amber-400/30 animate-pulse'
                      : isNext && pacingState.phase === 'delaying_cooldown'
                      ? 'bg-orange-500/10 border-orange-500/40 text-orange-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="text-base mb-0.5">{cfg.flag}</div>
                  <div className="font-bold text-[11px] truncate">{cfg.name}</div>
                  <div className="text-[10px] mt-1 font-semibold">
                    {hasAudio ? (
                      <span className="text-emerald-400 flex items-center justify-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Xong
                      </span>
                    ) : isCurrent ? (
                      <span className="text-amber-300">Đang tạo...</span>
                    ) : isNext && pacingState.phase === 'delaying_cooldown' ? (
                      <span className="text-orange-400">Đợi {pacingState.remainingSeconds}s</span>
                    ) : (
                      <span className="text-slate-500">Chờ</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Primary Action Buttons Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 relative z-10 pt-1">
        {/* BIG ONE-CLICK BUTTON */}
        <button
          type="button"
          onClick={onExecuteOneClickFlow}
          disabled={isProcessingOneClick || isTranslating || isGeneratingAudio || !viText.trim()}
          className="sm:col-span-12 lg:col-span-5 flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl font-black text-sm text-slate-950 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:from-amber-300 hover:to-orange-300 shadow-xl shadow-amber-500/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isProcessingOneClick || pacingState.isActive ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>
                {pacingState.phase === 'delaying_cooldown'
                  ? `⏳ Đang giãn cách 20s (còn ${pacingState.remainingSeconds}s)...`
                  : `Đang tạo ${pacingState.completedCount}/5 file audio ${audioFormat.toUpperCase()}...`}
              </span>
            </>
          ) : globalCooldown > 0 ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              <span>⚡ 1-CHẠM: TẠO 5 FILE (Đợi giãn cách {globalCooldown}s)</span>
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 fill-slate-950 group-hover:scale-110 transition" />
              <span>⚡ 1-CHẠM: DỊCH & TẠO 5 FILE {audioFormat.toUpperCase()}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </>
          )}
        </button>

        {/* ONE-CLICK DOWNLOAD 5 FILES BUTTON */}
        <button
          type="button"
          onClick={handleDownloadAllZip}
          disabled={isZipping || readyLangs.length === 0}
          className={`sm:col-span-6 lg:col-span-3.5 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-extrabold text-xs sm:text-sm transition shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            allReady
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40 border border-emerald-400/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
          title="Tải 1 file nén ZIP chứa toàn bộ 5 file MP3/WAV riêng biệt + 1 file Master liên hoàn"
        >
          {isZipping ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Đang gói ZIP...</span>
            </>
          ) : (
            <>
              <FileArchive className="w-4 h-4" />
              <span>📦 TẢI TRỌN BỘ (.ZIP)</span>
            </>
          )}
        </button>

        {/* ONE-CLICK SAVE ALL 5 FILES TO GOOGLE DRIVE BUTTON */}
        <button
          type="button"
          onClick={handleSaveAllToGoogleDrive}
          disabled={isSavingToDrive || readyLangs.length === 0}
          className={`sm:col-span-6 lg:col-span-3.5 flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-extrabold text-xs sm:text-sm transition shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            allReady
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-950/40 border border-blue-400/40'
              : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700'
          }`}
          title="Lưu tất cả file âm thanh MP3 trực tiếp vào thư mục Google Drive của bạn"
        >
          {isSavingToDrive ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>
                {driveSaveProgress
                  ? `Lưu Drive (${driveSaveProgress.current}/${driveSaveProgress.total})...`
                  : 'Đang tải lên Drive...'}
              </span>
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4 text-blue-300" />
              <span>☁️ LƯU VÀO GOOGLE DRIVE</span>
            </>
          )}
        </button>
      </div>

      {/* 4. Secondary Quick Actions & Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
        {/* Readiness Badges for the 5 Languages */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-medium">Trạng thái Audio:</span>
          {languages.map((code) => {
            const hasAudio = !!scriptsState[code].audioBase64;
            const flags: Record<LanguageCode, string> = {
              vi: '🇻🇳 Việt',
              en: '🇬🇧 Anh',
              ko: '🇰🇷 Hàn',
              zh: '🇨🇳 Trung',
              ru: '🇷🇺 Nga',
            };

            return (
              <span
                key={code}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
                  hasAudio
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                {hasAudio && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                <span>{flags[code]}</span>
                {hasAudio && <span className="text-[10px] text-emerald-400 font-bold">.{audioFormat}</span>}
              </span>
            );
          })}
        </div>

        {/* Additional download option: direct loose files & Google Drive status */}
        <div className="flex items-center gap-2">
          {readyLangs.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadIndividually}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Tải 5 file rời trực tiếp vào thư mục Downloads của máy tính"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Tải 5 file rời</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenGoogleDriveModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/40 text-blue-300 border border-blue-800/60 text-xs font-semibold transition cursor-pointer"
            title="Mở thư mục và xem các file đã lưu trên Google Drive"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentUser ? 'Quản lý Google Drive' : 'Liên kết Drive'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowApiExplainer(!showApiExplainer)}
            className="flex items-center gap-1 text-slate-400 hover:text-amber-300 transition text-[11px] font-medium cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Ít API</span>
          </button>
        </div>
      </div>

      {/* Explainer Accordion: How this uses the minimal API calls */}
      {showApiExplainer && (
        <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-4 text-xs space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Chiến Lược Tối Ưu Tối Thiểu Lượt Gọi API Của Hệ Thống:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-300">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-amber-300 block mb-1">1. Dịch thuật: Chỉ 1 Lần Gọi Duy Nhất</span>
              <p className="text-[11px] text-slate-400">
                Gửi toàn bộ văn bản tiếng Việt lên và Gemini trả về cả 4 thứ tiếng (Anh, Hàn, Trung, Nga) cùng lúc trong 1 JSON payload. Tiết kiệm 75% số lượng request.
              </p>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-amber-300 block mb-1">2. Bộ Nhớ Đệm Thông Minh (Smart Cache)</span>
              <p className="text-[11px] text-slate-400">
                Nếu kịch bản không thay đổi, hệ thống giữ nguyên file âm thanh. Bấm nghe lại, chỉnh tốc độ đọc, đổi tông giọng tốn <strong>0 lượt API</strong>.
              </p>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="font-bold text-amber-300 block mb-1">3. Ghép Chuông & Xuất MP3/ZIP Offline</span>
              <p className="text-[11px] text-slate-400">
                Chuông hiệu, nén MP3 128kbps, và đóng gói file .ZIP đều chạy bằng Web Audio & LameJS ngay trên trình duyệt máy bạn, không tốn API.
              </p>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-amber-500/30">
              <span className="font-bold text-amber-300 block mb-1">4. Giãn Cách 20s (Chống Lỗi 3 RPM)</span>
              <p className="text-[11px] text-slate-400">
                Mô hình TTS giới hạn 3 RPM (3 lượt/phút). Hệ thống tự động giãn cách 20 giây giữa mỗi ngôn ngữ để không bao giờ bị lỗi 429 Quota Exceeded.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
