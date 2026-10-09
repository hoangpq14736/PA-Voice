import React, { useState, useRef } from 'react';
import {
  LanguageCode,
  ScriptState,
  AudioFormat,
  PacingState,
} from '../types';
import { LANGUAGES_CONFIG } from '../utils/presets';
import {
  Volume2,
  Play,
  Pause,
  Download,
  Sparkles,
  Loader2,
  Languages,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Columns3,
  Square,
  Wand2,
  Clock,
  Cloud,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  decodeAudioData,
  processAudioBuffer,
  encodeAudioBlob,
  fallbackSpeak,
  getAudioContext,
} from '../utils/audioSynthesizer';
import {
  googleSignIn,
  getOrCreateAppFolder,
  uploadAudioToDrive,
} from '../services/googleDriveService';

interface MultiLanguageEditorProps {
  scriptsState: Record<LanguageCode, ScriptState>;
  onUpdateScript: (lang: LanguageCode, partial: Partial<ScriptState>) => void;
  onAutoTranslateAll: () => Promise<void>;
  isTranslating: boolean;
  onGenerateSpeechForLang: (lang: LanguageCode) => Promise<void>;
  onGenerateSpeechForAll: () => Promise<void>;
  isGeneratingAll: boolean;
  paHornMode: boolean;
  audioFormat?: AudioFormat;
  globalCooldown?: number;
  pacingState?: PacingState;
  onCancelPacing?: () => void;
  currentUser?: User | null;
  accessToken?: string | null;
  onAuthChange?: (user: User | null, token: string | null) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onOpenGoogleDriveModal?: () => void;
  announcementTitle?: string;
}

export const MultiLanguageEditor: React.FC<MultiLanguageEditorProps> = ({
  scriptsState,
  onUpdateScript,
  onAutoTranslateAll,
  isTranslating,
  onGenerateSpeechForLang,
  onGenerateSpeechForAll,
  isGeneratingAll,
  paHornMode,
  audioFormat = 'mp3',
  globalCooldown = 0,
  pacingState,
  onCancelPacing,
  currentUser,
  accessToken,
  onAuthChange,
  onShowToast,
  onOpenGoogleDriveModal,
  announcementTitle = 'ThongBao_PhatThanh',
}) => {
  const [activeTab, setActiveTab] = useState<LanguageCode>('vi');
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [playingLang, setPlayingLang] = useState<LanguageCode | null>(null);
  const activeAudioNodeRef = useRef<{ source: AudioBufferSourceNode; stop: () => void } | null>(null);

  const stopActiveAudio = () => {
    if (activeAudioNodeRef.current) {
      try {
        activeAudioNodeRef.current.stop();
      } catch {}
      activeAudioNodeRef.current = null;
    }
    setPlayingLang(null);
  };

  const handlePlayAudio = async (lang: LanguageCode) => {
    if (playingLang === lang) {
      stopActiveAudio();
      return;
    }

    stopActiveAudio();
    const state = scriptsState[lang];

    const isVoiceStale = state.audioBase64 && state.generatedVoice && state.generatedVoice !== state.voice;
    if (isVoiceStale) {
      // User changed voice selection: regenerate with the newly selected voice
      onGenerateSpeechForLang(lang);
      return;
    }

    // If we have generated audio base64 or blob
    if (state.audioBase64) {
      try {
        setPlayingLang(lang);
        const ctx = getAudioContext();
        const rawBuffer = await decodeAudioData(state.audioBase64, ctx);
        const processedBuffer = await processAudioBuffer(rawBuffer, {
          speed: state.speed,
          pitchSemitones: state.pitch,
          paHornEffect: paHornMode,
        });

        const source = ctx.createBufferSource();
        source.buffer = processedBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
          setPlayingLang(null);
          activeAudioNodeRef.current = null;
        };

        source.start(0);
        activeAudioNodeRef.current = {
          source,
          stop: () => source.stop(),
        };
      } catch (err) {
        console.error('Audio playback error:', err);
        setPlayingLang(null);
      }
    } else {
      // Fallback to Web Speech API
      if (!state.text.trim()) return;
      try {
        setPlayingLang(lang);
        const pitchNorm = 1.0 + (state.pitch / 8);
        await fallbackSpeak(state.text, lang, state.speed, pitchNorm, state.voice);
      } catch (err) {
        console.error('Speech synthesis error:', err);
      } finally {
        setPlayingLang(null);
      }
    }
  };

  const [savingDriveLang, setSavingDriveLang] = useState<LanguageCode | null>(null);

  const handleSaveSingleAudioToDrive = async (lang: LanguageCode) => {
    const state = scriptsState[lang];
    if (!state.audioBase64) return;

    let token = accessToken;
    if (!token) {
      try {
        const authResult = await googleSignIn();
        token = authResult.accessToken;
        if (onAuthChange) onAuthChange(authResult.user, authResult.accessToken);
        if (onShowToast) onShowToast(`Đã liên kết Google Drive: ${authResult.user.email}`, 'success');
      } catch (err: any) {
        if (err.code !== 'auth/popup-closed-by-user') {
          if (onShowToast) onShowToast('Cần đăng nhập Google để lưu file: ' + (err.message || ''), 'error');
        }
        return;
      }
    }

    try {
      setSavingDriveLang(lang);
      const folder = await getOrCreateAppFolder(token);
      const ctx = getAudioContext();
      const rawBuffer = await decodeAudioData(state.audioBase64, ctx);
      const processedBuffer = await processAudioBuffer(rawBuffer, {
        speed: state.speed,
        pitchSemitones: state.pitch,
        paHornEffect: paHornMode,
      });

      const { blob, extension, mimeType } = encodeAudioBlob(processedBuffer, audioFormat);
      const cleanTitle = (announcementTitle || 'ThongBao_PhatThanh').replace(/[/\\?%*:|"<>]/g, '-');
      const fileName = `${cleanTitle}_${lang.toUpperCase()}_${Date.now()}.${extension}`;

      await uploadAudioToDrive({
        accessToken: token,
        fileName,
        blob,
        mimeType: mimeType || 'audio/mpeg',
        folderId: folder.id,
        description: `Thông báo phát thanh (${lang.toUpperCase()}): ${state.text.substring(0, 100)}...`,
      });

      if (onShowToast) {
        onShowToast(`Đã lưu file ${lang.toUpperCase()} lên Google Drive (${folder.name})!`, 'success');
      }
    } catch (err: any) {
      console.error('Lỗi lưu file vào Google Drive:', err);
      if (onShowToast) onShowToast('Lỗi lưu file vào Google Drive: ' + (err.message || ''), 'error');
    } finally {
      setSavingDriveLang(null);
    }
  };

  const handleDownloadSingleAudio = async (lang: LanguageCode) => {
    const state = scriptsState[lang];
    if (!state.audioBase64) return;

    try {
      const ctx = getAudioContext();
      const rawBuffer = await decodeAudioData(state.audioBase64, ctx);
      const processedBuffer = await processAudioBuffer(rawBuffer, {
        speed: state.speed,
        pitchSemitones: state.pitch,
        paHornEffect: paHornMode,
      });

      const { blob, extension } = encodeAudioBlob(processedBuffer, audioFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PA_Studio_${lang.toUpperCase()}_${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const renderLanguageCard = (langConfig: (typeof LANGUAGES_CONFIG)[0], isGrid = false) => {
    const lang = langConfig.code;
    const state = scriptsState[lang];
    const isPlaying = playingLang === lang;
    const wordCount = state.text.trim() ? state.text.trim().split(/\s+/).length : 0;
    const charCount = state.text.length;

    return (
      <div
        key={lang}
        className={`ios-card rounded-[24px] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 ${
          activeTab === lang && !isGrid
            ? 'border-amber-500/40 shadow-2xl'
            : 'border-white/[0.08]'
        }`}
      >
        <div>
          {/* Header of Card */}
          <div className="flex items-center justify-between gap-2 mb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{langConfig.flag}</span>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  {langConfig.name}
                  <span className="text-xs font-normal text-slate-400">({langConfig.nativeName})</span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {state.audioBase64 ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Audio sẵn sàng
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-medium px-2 py-0.5">Chưa tạo audio</span>
              )}

              {lang === 'vi' && (
                <button
                  type="button"
                  onClick={onAutoTranslateAll}
                  disabled={isTranslating || !state.text.trim()}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 active:scale-95 text-slate-950 font-bold text-xs rounded-full shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Dịch nội dung tiếng Việt này sang 4 ngôn ngữ còn lại (Anh, Hàn, Trung, Nga)"
                >
                  {isTranslating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Languages className="w-3.5 h-3.5" />
                  )}
                  <span>Dịch sang 4 ngôn ngữ</span>
                </button>
              )}
            </div>
          </div>

          {/* Text Area */}
          <div className="relative mb-3.5">
            <textarea
              rows={isGrid ? 5 : 6}
              value={state.text}
              onChange={(e) => onUpdateScript(lang, { text: e.target.value })}
              placeholder={`Nhập kịch bản phát thanh ${langConfig.name}...`}
              className="w-full bg-black/50 border border-white/[0.08] focus:border-amber-400/80 focus:ring-2 focus:ring-amber-500/20 rounded-2xl p-4 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-all leading-relaxed resize-y font-normal"
            />
            <div className="absolute right-3.5 bottom-3.5 text-[10px] text-slate-400 bg-black/70 px-2 py-0.5 rounded-full pointer-events-none border border-white/[0.06]">
              {wordCount} từ • {charCount} ký tự
            </div>
          </div>

          {/* Quick Translate Button on Mobile for Vietnamese */}
          {lang === 'vi' && (
            <button
              type="button"
              onClick={onAutoTranslateAll}
              disabled={isTranslating || !state.text.trim()}
              className="sm:hidden w-full mb-3 flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 active:scale-95 text-slate-950 font-bold text-xs rounded-full shadow transition-all cursor-pointer disabled:opacity-50"
            >
              {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
              <span>Dịch tự động sang Anh - Hàn - Trung - Nga</span>
            </button>
          )}

          {/* Controls: Voice, Speed, Pitch */}
          <div className="ios-card-nested p-4 rounded-2xl border border-white/[0.06] space-y-3.5 mb-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-1.5 border-b border-white/[0.06]">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Sliders className="w-3.5 h-3.5" /> Cài đặt giọng đọc & Tông nhịp
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateScript(lang, {
                    speed: 1.0,
                    pitch: 0,
                    voice: langConfig.defaultVoice,
                  })
                }
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                title="Khôi phục mặc định"
              >
                <RotateCcw className="w-3 h-3" /> Mặc định
              </button>
            </div>

            {/* Voice Select */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Chất giọng phát thanh (Gemini AI Voice)
                </label>
                <span className="text-[10px] text-amber-400/90 font-mono">
                  {langConfig.voiceOptions.length} lựa chọn
                </span>
              </div>
              <select
                value={state.voice}
                onChange={(e) => onUpdateScript(lang, { voice: e.target.value })}
                className="w-full bg-black/60 border border-white/[0.1] rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:border-amber-400 focus:outline-none cursor-pointer transition-colors"
              >
                <optgroup label="👩 Giọng Nữ (Female Voices)">
                  {langConfig.voiceOptions.filter(v => v.gender === 'Nữ').map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="👨 Giọng Nam (Male Voices)">
                  {langConfig.voiceOptions.filter(v => v.gender === 'Nam').map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              {langConfig.voiceOptions.find((v) => v.id === state.voice)?.style && (
                <p className="mt-1 text-[11px] text-slate-400 italic">
                  🎯 Phong cách: {langConfig.voiceOptions.find((v) => v.id === state.voice)?.style}
                </p>
              )}

              {state.audioBase64 && state.generatedVoice && state.generatedVoice !== state.voice && (
                <div className="mt-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between text-[11px] text-amber-300">
                  <span>💡 Đã chọn chất giọng mới (<strong>{state.voice}</strong>).</span>
                  <button
                    type="button"
                    onClick={() => onGenerateSpeechForLang(lang)}
                    disabled={state.isGenerating}
                    className="ml-2 px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] cursor-pointer whitespace-nowrap shadow active:scale-95 transition-all"
                  >
                    Tạo lại ngay
                  </button>
                </div>
              )}
            </div>

            {/* Speed & Pitch Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-medium">Tốc độ đọc (Speed)</span>
                  <span className="font-mono font-bold text-amber-400">{state.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.35"
                  step="0.05"
                  value={state.speed}
                  onChange={(e) => onUpdateScript(lang, { speed: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Chậm (0.8x)</span>
                  <span>Chuẩn (1.0x)</span>
                  <span>Nhanh (1.3x)</span>
                </div>
              </div>

              {/* Pitch Tone Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-medium">Tông giọng (Pitch)</span>
                  <span className="font-mono font-bold text-amber-400">
                    {state.pitch > 0 ? `+${state.pitch}` : state.pitch === 0 ? 'Chuẩn' : state.pitch}
                  </span>
                </div>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="1"
                  value={state.pitch}
                  onChange={(e) => onUpdateScript(lang, { pitch: parseInt(e.target.value, 10) })}
                  className="w-full"
                />
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Trầm ấm (-3)</span>
                  <span>Tự nhiên (0)</span>
                  <span>Sáng bổng (+3)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons for this card */}
        <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Play Button */}
            <button
              type="button"
              onClick={() => handlePlayAudio(lang)}
              disabled={!state.text.trim()}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 font-bold animate-pulse'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.08]'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Dừng
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Nghe thử
                </>
              )}
            </button>

            {/* Download single Audio (MP3 / WAV) */}
            {state.audioBase64 && (
              <>
                <button
                  type="button"
                  onClick={() => handleDownloadSingleAudio(lang)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium transition-all active:scale-95 cursor-pointer"
                  title={`Tải file audio ${audioFormat.toUpperCase()} cho ngôn ngữ này`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải {audioFormat.toUpperCase()}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSingleAudioToDrive(lang)}
                  disabled={savingDriveLang === lang}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/25 text-xs font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                  title="Lưu file MP3 này trực tiếp vào Google Drive"
                >
                  {savingDriveLang === lang ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-300" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span>{savingDriveLang === lang ? 'Đang lưu...' : 'Lưu Drive'}</span>
                </button>
              </>
            )}
          </div>

          {/* Generate Speech Button */}
          <button
            type="button"
            onClick={() => onGenerateSpeechForLang(lang)}
            disabled={state.isGenerating || isGeneratingAll || pacingState?.isActive || !state.text.trim()}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
              globalCooldown > 0 && !state.isGenerating
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/35'
            }`}
            title={globalCooldown > 0 ? `Đang trong thời gian giãn cách 20 giây để bảo vệ hạn ngạch 3 RPM (còn ${globalCooldown}s)` : 'Tạo file âm thanh AI cho ngôn ngữ này'}
          >
            {state.isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Đang tổng hợp...</span>
              </>
            ) : globalCooldown > 0 ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Đợi ({globalCooldown}s)</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Tạo Giọng AI</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const activeLangConfig = LANGUAGES_CONFIG.find((l) => l.code === activeTab) || LANGUAGES_CONFIG[0];

  return (
    <div className="space-y-4">
      {/* Active Pacing Card for Batch Mode (All 5 Languages) */}
      {(pacingState?.isActive && pacingState.mode === 'batch-all') && (
        <div className="ios-card rounded-2xl p-4.5 space-y-3 animate-in fade-in duration-200 border border-amber-500/30 shadow-xl">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center animate-pulse">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-amber-300">
                    Tạo Giọng 5 Thứ Tiếng: Đang Giãn Cách 20 Giây
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold">
                    {pacingState.completedCount}/5 Hoàn tất
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {pacingState.message}
                </p>
              </div>
            </div>

            {onCancelPacing && (
              <button
                type="button"
                onClick={onCancelPacing}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all active:scale-95 cursor-pointer"
              >
                Dừng / Hủy
              </button>
            )}
          </div>

          {/* 20s Delay Countdown Progress Bar */}
          {pacingState.phase === 'delaying_cooldown' && (
            <div className="space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-amber-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Đang đếm ngược 20 giây chống khóa 3 RPM:
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {pacingState.remainingSeconds}s / 20s
                </span>
              </div>
              <div className="w-full h-2 bg-white/[0.1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${Math.max(5, ((20 - pacingState.remainingSeconds) / 20) * 100)}%`,
                  }}
                />
              </div>
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
                  className={`p-2 rounded-xl text-xs font-medium border transition-all ${
                    hasAudio
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : isCurrent
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 ring-2 ring-amber-400/20 animate-pulse'
                      : isNext && pacingState.phase === 'delaying_cooldown'
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                      : 'bg-black/30 border-white/[0.06] text-slate-500'
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

      {/* Top Bar: Tabs, View Toggle, Batch Generate */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 ios-card p-2 sm:p-2.5 rounded-2xl border border-white/[0.08]">
        {/* Language Tabs (iOS Segmented Pills) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none ios-pill-tab p-1 rounded-full border border-white/[0.06]">
          {LANGUAGES_CONFIG.map((cfg) => {
            const hasAudio = !!scriptsState[cfg.code].audioBase64;
            const isTabActive = activeTab === cfg.code;
            return (
              <button
                key={cfg.code}
                type="button"
                onClick={() => setActiveTab(cfg.code)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                  isTabActive
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{cfg.flag}</span>
                <span>{cfg.name}</span>
                {hasAudio && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isTabActive ? 'bg-slate-950' : 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* View Mode & Batch Generate */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {/* View Mode Switch (iOS Segmented) */}
          <div className="flex items-center ios-pill-tab rounded-full p-0.5 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`p-1.5 rounded-full text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Xem chi tiết từng ngôn ngữ"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full text-xs font-medium transition-all active:scale-95 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Xem đối chiếu cả 5 ngôn ngữ"
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Batch Generate for All 5 Languages */}
          <button
            type="button"
            onClick={onGenerateSpeechForAll}
            disabled={isGeneratingAll || pacingState?.isActive}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-105 active:scale-95 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isGeneratingAll || (pacingState?.isActive && pacingState.mode === 'batch-all') ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {pacingState?.phase === 'delaying_cooldown'
                    ? `⏳ Đang giãn cách (${pacingState.remainingSeconds}s)...`
                    : 'Đang tạo cả 5 tiếng...'}
                </span>
              </>
            ) : globalCooldown > 0 ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Tạo Cả 5 Thứ Tiếng (Đợi {globalCooldown}s)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tạo Audio Cả 5 Thứ Tiếng</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      {viewMode === 'single' ? (
        <div>{renderLanguageCard(activeLangConfig, false)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LANGUAGES_CONFIG.map((cfg) => renderLanguageCard(cfg, true))}
        </div>
      )}
    </div>
  );
};
