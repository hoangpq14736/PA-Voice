import React, { useState, useEffect, useRef } from 'react';
import {
  LanguageCode,
  ScriptState,
  ChimeType,
  BroadcastHistoryItem,
  AudioFormat,
  PacingState,
} from './types';
import { LANGUAGES_CONFIG, PRESET_ANNOUNCEMENTS } from './utils/presets';
import { Header } from './components/Header';
import { MultiLanguageEditor } from './components/MultiLanguageEditor';
import { QuickOneClickStudio } from './components/QuickOneClickStudio';
import { SavedRecordings } from './components/SavedRecordings';
import { AiScriptGeneratorModal } from './components/AiScriptGeneratorModal';
import { HelpModal } from './components/HelpModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { getSavedApiKey, getApiHeaders } from './utils/apiKeyManager';
import { initAuth } from './services/googleDriveService';
import { User } from 'firebase/auth';
import { Sparkles, MapPin, AlertCircle, Info, BookmarkPlus } from 'lucide-react';

const INITIAL_PRESET = PRESET_ANNOUNCEMENTS[0];

const LANG_DISPLAY_NAMES: Record<LanguageCode, string> = {
  vi: 'Tiếng Việt',
  en: 'Tiếng Anh',
  ko: 'Tiếng Hàn',
  zh: 'Tiếng Trung',
  ru: 'Tiếng Nga',
};

export default function App() {
  // Global & PA Audio States
  const [selectedChime, setSelectedChime] = useState<ChimeType>('sunworld');
  const [paHornMode, setPaHornMode] = useState<boolean>(false);
  const [announcementTitle, setAnnouncementTitle] = useState<string>(INITIAL_PRESET.title);
  const [audioFormat, setAudioFormat] = useState<AudioFormat>('mp3');

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isGoogleDriveModalOpen, setIsGoogleDriveModalOpen] = useState<boolean>(false);
  const [hasCustomApiKey, setHasCustomApiKey] = useState<boolean>(() => !!getSavedApiKey());

  // Google Drive Authentication (In-Memory token cache)
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);

  // 3 RPM Rate Limit Protection & 20s Delay Cooldown States
  const [globalCooldown, setGlobalCooldown] = useState<number>(0);
  const [pacingState, setPacingState] = useState<PacingState>({
    isActive: false,
    mode: null,
    currentLang: null,
    nextLang: null,
    phase: 'idle',
    remainingSeconds: 0,
    totalSeconds: 20,
    completedCount: 0,
    totalCount: 5,
    message: '',
  });
  const abortPacingRef = useRef<boolean>(false);

  // Loading states
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [isProcessingOneClick, setIsProcessingOneClick] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Initialize scripts for all 5 languages
  const [scriptsState, setScriptsState] = useState<Record<LanguageCode, ScriptState>>(() => {
    const initial: Record<string, ScriptState> = {};
    LANGUAGES_CONFIG.forEach((lang) => {
      initial[lang.code] = {
        code: lang.code,
        text: INITIAL_PRESET.scripts[lang.code] || '',
        voice: lang.defaultVoice,
        speed: lang.defaultSpeed,
        pitch: lang.defaultPitch,
        toneStyle: INITIAL_PRESET.tone,
        audioBlobUrl: null,
        audioBase64: null,
        audioDuration: 0,
        isGenerating: false,
        error: null,
      };
    });
    return initial as Record<LanguageCode, ScriptState>;
  });

  // Saved broadcasts from LocalStorage
  const [savedItems, setSavedItems] = useState<BroadcastHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem('sunworld_pa_saved');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleUpdateScript = (lang: LanguageCode, partial: Partial<ScriptState>) => {
    setScriptsState((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        ...partial,
        // If text changes, reset existing audio
        ...(partial.text !== undefined && partial.text !== prev[lang].text
          ? { audioBase64: null, audioBlobUrl: null }
          : {}),
      },
    }));
  };

  // 1-second interval to decrement globalCooldown
  useEffect(() => {
    if (globalCooldown <= 0) return;
    const interval = setInterval(() => {
      setGlobalCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [globalCooldown]);

  // Listen to Google Drive auth state (in-memory token caching)
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        if (token) setDriveAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setDriveAccessToken(null);
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  const startGlobalCooldown = (seconds = 20) => {
    setGlobalCooldown(seconds);
  };

  const delayWithCountdown = async (
    seconds: number,
    onTick: (remaining: number) => void
  ): Promise<boolean> => {
    for (let s = seconds; s > 0; s--) {
      if (abortPacingRef.current) return false;
      onTick(s);
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (abortPacingRef.current) return false;
    onTick(0);
    return true;
  };

  const handleCancelPacing = () => {
    abortPacingRef.current = true;
    setPacingState({
      isActive: false,
      mode: null,
      currentLang: null,
      nextLang: null,
      phase: 'idle',
      remainingSeconds: 0,
      totalSeconds: 20,
      completedCount: 0,
      totalCount: 5,
      message: '',
    });
    setIsProcessingOneClick(false);
    setIsGeneratingAll(false);
    showToast('Đã dừng tiến trình theo yêu cầu.', 'info');
  };

  // AI Auto-translate from Vietnamese to 4 other languages
  const handleAutoTranslateAll = async () => {
    const viText = scriptsState.vi.text.trim();
    if (!viText) {
      showToast('Vui lòng nhập kịch bản Tiếng Việt trước khi dịch', 'error');
      return;
    }

    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate-announcement', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          vietnameseText: viText,
          location: 'Khu vực khán đài & Sảnh công cộng',
          tone: scriptsState.vi.toneStyle,
        }),
      });

      if (!res.ok) {
        throw new Error('Dịch kịch bản không thành công');
      }

      const data = await res.json();

      setScriptsState((prev) => ({
        ...prev,
        en: { ...prev.en, text: data.en || prev.en.text, audioBase64: null },
        ko: { ...prev.ko, text: data.ko || prev.ko.text, audioBase64: null },
        zh: { ...prev.zh, text: data.zh || prev.zh.text, audioBase64: null },
        ru: { ...prev.ru, text: data.ru || prev.ru.text, audioBase64: null },
      }));

      showToast('Đã dịch và tối ưu hóa phát thanh thành công sang 4 ngôn ngữ!', 'success');
    } catch (err: any) {
      console.error('Translation error:', err);
      showToast('Không thể kết nối dịch tự động. Vui lòng kiểm tra kết nối mạng.', 'error');
    } finally {
      setIsTranslating(false);
    }
  };

  // 1-Click Master Flow: Translate to 4 foreign languages + Generate all 5 Audio files with 20s inter-language delay
  const handleExecuteOneClickFlow = async () => {
    const viText = scriptsState.vi.text.trim();
    if (!viText) {
      showToast('Vui lòng nhập kịch bản Tiếng Việt trước khi chạy 1-chạm', 'error');
      return;
    }

    abortPacingRef.current = false;
    setIsProcessingOneClick(true);

    // If there is any ongoing global cooldown, wait for it first
    if (globalCooldown > 0) {
      setPacingState({
        isActive: true,
        mode: 'one-click',
        currentLang: null,
        nextLang: 'vi',
        phase: 'delaying_cooldown',
        remainingSeconds: globalCooldown,
        totalSeconds: 20,
        completedCount: 0,
        totalCount: 5,
        message: `Đang chờ hồi hạn ngạch 3 RPM (${globalCooldown}s) trước khi bắt đầu...`,
      });

      const ok = await delayWithCountdown(globalCooldown, (rem) => {
        setPacingState((prev) => ({
          ...prev,
          remainingSeconds: rem,
          message: `Đang chờ hồi hạn ngạch 3 RPM (${rem}s) trước khi bắt đầu...`,
        }));
      });

      if (!ok) {
        setIsProcessingOneClick(false);
        return;
      }
    }

    showToast('Bước 1/2: Đang tự động dịch sang 4 ngôn ngữ (Chỉ 1 lượt API)...', 'info');
    setPacingState({
      isActive: true,
      mode: 'one-click',
      currentLang: 'vi',
      nextLang: null,
      phase: 'generating',
      remainingSeconds: 0,
      totalSeconds: 20,
      completedCount: 0,
      totalCount: 5,
      message: 'Bước 1/2: Đang tự động dịch sang 4 ngôn ngữ (1 lượt gọi duy nhất)...',
    });

    try {
      // 1. Single API call to translate Vietnamese to English, Korean, Chinese, Russian
      const resTrans = await fetch('/api/translate-announcement', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          vietnameseText: viText,
          location: 'Khu vực khán đài & Sảnh công cộng',
          tone: scriptsState.vi.toneStyle,
        }),
      });

      if (!resTrans.ok) {
        throw new Error('Dịch kịch bản không thành công');
      }

      const transData = await resTrans.json();
      const updatedScripts: Record<LanguageCode, ScriptState> = {
        ...scriptsState,
        en: { ...scriptsState.en, text: transData.en || scriptsState.en.text, audioBase64: null },
        ko: { ...scriptsState.ko, text: transData.ko || scriptsState.ko.text, audioBase64: null },
        zh: { ...scriptsState.zh, text: transData.zh || scriptsState.zh.text, audioBase64: null },
        ru: { ...scriptsState.ru, text: transData.ru || scriptsState.ru.text, audioBase64: null },
      };
      setScriptsState(updatedScripts);

      showToast('Bước 2/2: Đang tạo giọng nói AI cho 5 ngôn ngữ...', 'info');

      // 2. TTS Generation for all 5 languages (adaptive pacing: 20s if Gemini 3 RPM quota applies, 1s if fallback)
      const langs: LanguageCode[] = ['vi', 'en', 'ko', 'zh', 'ru'];
      let count = 0;
      let isFallbackActive = false;

      for (let i = 0; i < langs.length; i++) {
        if (abortPacingRef.current) break;

        const lang = langs[i];
        const scriptObj = updatedScripts[lang];
        if (!scriptObj.text.trim()) continue;

        // If this is NOT the first language, delay with live visual countdown
        if (i > 0) {
          const delaySec = isFallbackActive ? 1 : 20;
          setPacingState({
            isActive: true,
            mode: 'one-click',
            currentLang: langs[i - 1],
            nextLang: lang,
            phase: 'delaying_cooldown',
            remainingSeconds: delaySec,
            totalSeconds: delaySec,
            completedCount: count,
            totalCount: 5,
            message: isFallbackActive
              ? `Đang chuyển sang tạo ${LANG_DISPLAY_NAMES[lang]}...`
              : `Đang giãn cách 20s (Giới hạn 3 RPM) trước khi tạo ${LANG_DISPLAY_NAMES[lang]}...`,
          });

          const delayed = await delayWithCountdown(delaySec, (rem) => {
            setPacingState((prev) => ({
              ...prev,
              remainingSeconds: rem,
              message: isFallbackActive
                ? `Đang chuyển sang tạo ${LANG_DISPLAY_NAMES[lang]}...`
                : `Đang giãn cách 20s (Giới hạn 3 RPM) trước khi tạo ${LANG_DISPLAY_NAMES[lang]}... (còn ${rem}s)`,
            }));
          });

          if (!delayed) {
            showToast('Đã dừng quy trình 1-chạm theo yêu cầu.', 'info');
            break;
          }
        }

        // Generate speech for current language
        setPacingState({
          isActive: true,
          mode: 'one-click',
          currentLang: lang,
          nextLang: null,
          phase: 'generating',
          remainingSeconds: 0,
          totalSeconds: 20,
          completedCount: count,
          totalCount: 5,
          message: `Đang tổng hợp giọng nói AI cho ${LANG_DISPLAY_NAMES[lang]} (${count + 1}/5)...`,
        });

        handleUpdateScript(lang, { isGenerating: true });
        try {
          const resTts = await fetch('/api/tts', {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              text: scriptObj.text,
              language: lang,
              voiceName: scriptObj.voice,
              tone: scriptObj.toneStyle,
              speed: scriptObj.speed,
              pitch: scriptObj.pitch,
            }),
          });
          const ttsData = await resTts.json();
          if (resTts.ok && ttsData.audioBase64) {
            if (ttsData.fallbackUsed) {
              isFallbackActive = true;
            }
            handleUpdateScript(lang, {
              audioBase64: ttsData.audioBase64,
              generatedVoice: scriptObj.voice,
              isGenerating: false,
            });
            count++;
            if (!ttsData.fallbackUsed) {
              startGlobalCooldown(20);
            }
          } else {
            handleUpdateScript(lang, { isGenerating: false });
            showToast(`Lỗi tạo giọng ${LANG_DISPLAY_NAMES[lang]}: ${ttsData.error || 'Thử lại sau'}`, 'error');
          }
        } catch {
          handleUpdateScript(lang, { isGenerating: false });
        }
      }

      setPacingState({
        isActive: false,
        mode: null,
        currentLang: null,
        nextLang: null,
        phase: 'idle',
        remainingSeconds: 0,
        totalSeconds: 20,
        completedCount: count,
        totalCount: 5,
        message: '',
      });

      if (count > 0) {
        showToast(`🎉 Hoàn tất! Đã tạo thành công ${count}/5 file audio ${audioFormat.toUpperCase()}! Hãy bấm "Tải trọn bộ 5 file ZIP" hoặc lưu vào Google Drive!`, 'success');
      }
    } catch (err: any) {
      console.error('One-click flow error:', err);
      showToast(err.message || 'Có lỗi xảy ra trong quá trình 1-chạm', 'error');
      setPacingState((prev) => ({ ...prev, isActive: false, mode: null, phase: 'idle' }));
    } finally {
      setIsProcessingOneClick(false);
    }
  };

  // Single language TTS generation via Gemini 3.8 Flash Lite TTS with adaptive cooldown
  const handleGenerateSpeechForLang = async (lang: LanguageCode) => {
    const script = scriptsState[lang];
    if (!script.text.trim()) {
      showToast('Nội dung phát thanh đang trống', 'error');
      return;
    }

    // If cooldown is active, wait out the remaining seconds
    if (globalCooldown > 0) {
      showToast(`Đang chờ ${globalCooldown}s giãn cách hạn mức 3 RPM trước khi tạo giọng...`, 'info');
      handleUpdateScript(lang, { isGenerating: true });
      const ok = await delayWithCountdown(globalCooldown, () => {});
      if (!ok) {
        handleUpdateScript(lang, { isGenerating: false });
        return;
      }
    }

    handleUpdateScript(lang, { isGenerating: true, error: null });

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          text: script.text,
          language: lang,
          voiceName: script.voice,
          tone: script.toneStyle,
          speed: script.speed,
          pitch: script.pitch,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Lỗi khi tạo file giọng nói');
      }

      handleUpdateScript(lang, {
        audioBase64: data.audioBase64,
        generatedVoice: script.voice,
        isGenerating: false,
      });

      if (!data.fallbackUsed) {
        startGlobalCooldown(20);
        showToast(`Tạo thành công giọng đọc ${LANG_DISPLAY_NAMES[lang]}! Bắt đầu giãn cách 20s.`, 'success');
      } else {
        showToast(`Tạo thành công giọng đọc ${LANG_DISPLAY_NAMES[lang]}!`, 'success');
      }
    } catch (err: any) {
      console.error('TTS error:', err);
      handleUpdateScript(lang, {
        isGenerating: false,
        error: err.message,
      });
      showToast(`Không thể tạo giọng ${LANG_DISPLAY_NAMES[lang]}: ${err.message}`, 'error');
    }
  };

  // Generate speech for all 5 languages sequentially with adaptive delay
  const handleGenerateSpeechForAll = async () => {
    abortPacingRef.current = false;
    setIsGeneratingAll(true);

    if (globalCooldown > 0) {
      setPacingState({
        isActive: true,
        mode: 'batch-all',
        currentLang: null,
        nextLang: 'vi',
        phase: 'delaying_cooldown',
        remainingSeconds: globalCooldown,
        totalSeconds: 20,
        completedCount: 0,
        totalCount: 5,
        message: `Đang chờ hồi hạn ngạch 3 RPM (${globalCooldown}s) trước khi bắt đầu...`,
      });
      const ok = await delayWithCountdown(globalCooldown, (rem) => {
        setPacingState((prev) => ({
          ...prev,
          remainingSeconds: rem,
          message: `Đang chờ hồi hạn ngạch 3 RPM (${rem}s) trước khi bắt đầu...`,
        }));
      });
      if (!ok) {
        setIsGeneratingAll(false);
        return;
      }
    }

    const langs: LanguageCode[] = ['vi', 'en', 'ko', 'zh', 'ru'];
    let successCount = 0;
    let isFallbackActive = false;

    for (let i = 0; i < langs.length; i++) {
      if (abortPacingRef.current) break;

      const lang = langs[i];
      const script = scriptsState[lang];
      if (!script.text.trim()) continue;

      if (i > 0) {
        const delaySec = isFallbackActive ? 1 : 20;
        setPacingState({
          isActive: true,
          mode: 'batch-all',
          currentLang: langs[i - 1],
          nextLang: lang,
          phase: 'delaying_cooldown',
          remainingSeconds: delaySec,
          totalSeconds: delaySec,
          completedCount: successCount,
          totalCount: 5,
          message: isFallbackActive
            ? `Đang chuyển sang tạo ${LANG_DISPLAY_NAMES[lang]}...`
            : `Đang giãn cách 20s (Giới hạn 3 RPM) trước khi tạo ${LANG_DISPLAY_NAMES[lang]}...`,
        });

        const delayed = await delayWithCountdown(delaySec, (rem) => {
          setPacingState((prev) => ({
            ...prev,
            remainingSeconds: rem,
            message: isFallbackActive
              ? `Đang chuyển sang tạo ${LANG_DISPLAY_NAMES[lang]}...`
              : `Đang giãn cách 20s (Giới hạn 3 RPM) trước khi tạo ${LANG_DISPLAY_NAMES[lang]}... (còn ${rem}s)`,
          }));
        });

        if (!delayed) {
          showToast('Đã dừng tiến trình tạo âm thanh.', 'info');
          break;
        }
      }

      setPacingState({
        isActive: true,
        mode: 'batch-all',
        currentLang: lang,
        nextLang: null,
        phase: 'generating',
        remainingSeconds: 0,
        totalSeconds: 20,
        completedCount: successCount,
        totalCount: 5,
        message: `Đang tổng hợp giọng nói AI cho ${LANG_DISPLAY_NAMES[lang]} (${i + 1}/5)...`,
      });

      handleUpdateScript(lang, { isGenerating: true });
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            text: script.text,
            language: lang,
            voiceName: script.voice,
            tone: script.toneStyle,
            speed: script.speed,
            pitch: script.pitch,
          }),
        });

        const data = await res.json();
        if (res.ok && data.audioBase64) {
          if (data.fallbackUsed) {
            isFallbackActive = true;
          }
          handleUpdateScript(lang, {
            audioBase64: data.audioBase64,
            generatedVoice: script.voice,
            isGenerating: false,
          });
          successCount++;
          if (!data.fallbackUsed) {
            startGlobalCooldown(20);
          }
        } else {
          handleUpdateScript(lang, { isGenerating: false });
        }
      } catch {
        handleUpdateScript(lang, { isGenerating: false });
      }
    }

    setPacingState({
      isActive: false,
      mode: null,
      currentLang: null,
      nextLang: null,
      phase: 'idle',
      remainingSeconds: 0,
      totalSeconds: 20,
      completedCount: successCount,
      totalCount: 5,
      message: '',
    });

    setIsGeneratingAll(false);
    showToast(`Đã hoàn tất tạo giọng nói cho ${successCount}/5 ngôn ngữ!`, 'success');
  };

  // AI Script Modal apply
  const handleApplyAiScripts = (scripts: Record<LanguageCode, string>, title: string) => {
    setAnnouncementTitle(title);

    setScriptsState((prev) => {
      const updated = { ...prev };
      LANGUAGES_CONFIG.forEach((lang) => {
        updated[lang.code] = {
          ...updated[lang.code],
          text: scripts[lang.code] || '',
          audioBase64: null,
          audioBlobUrl: null,
        };
      });
      return updated;
    });

    showToast(`Đã áp dụng kịch bản AI: ${title}`, 'success');
  };

  // Save to Local History
  const handleSaveBroadcast = (title: string, duration: number) => {
    const newItem: BroadcastHistoryItem = {
      id: `save_${Date.now()}`,
      title: title || 'Thông báo phát thanh',
      location: 'Trạm phát thanh công cộng',
      timestamp: Date.now(),
      languages: ['vi', 'en', 'ko', 'zh', 'ru'],
      duration,
      scripts: {
        vi: scriptsState.vi.text,
        en: scriptsState.en.text,
        ko: scriptsState.ko.text,
        zh: scriptsState.zh.text,
        ru: scriptsState.ru.text,
      },
    };

    const updated = [newItem, ...savedItems.slice(0, 19)];
    setSavedItems(updated);
    try {
      localStorage.setItem('sunworld_pa_saved', JSON.stringify(updated));
    } catch {}

    showToast('Đã lưu kịch bản vào Thư viện Ca Trực!', 'success');
  };

  const handleLoadSavedItem = (item: BroadcastHistoryItem) => {
    setAnnouncementTitle(item.title);

    setScriptsState((prev) => {
      const updated = { ...prev };
      LANGUAGES_CONFIG.forEach((lang) => {
        updated[lang.code] = {
          ...updated[lang.code],
          text: item.scripts[lang.code] || '',
          audioBase64: null,
        };
      });
      return updated;
    });

    showToast(`Đã mở lại kịch bản: ${item.title}`, 'info');
  };

  const handleDeleteSavedItem = (id: string) => {
    const updated = savedItems.filter((i) => i.id !== id);
    setSavedItems(updated);
    try {
      localStorage.setItem('sunworld_pa_saved', JSON.stringify(updated));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* App Header */}
      <Header
        paHornMode={paHornMode}
        onTogglePaHornMode={() => setPaHornMode(!paHornMode)}
        onOpenAiGenerator={() => setIsAiModalOpen(true)}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        selectedChime={selectedChime}
        onChangeChime={(chime) => setSelectedChime(chime)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        hasCustomApiKey={hasCustomApiKey}
        globalCooldown={globalCooldown}
        onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
        isDriveConnected={!!currentUser}
        userEmail={currentUser?.email}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
          <div
            className={`flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
                : 'bg-slate-900/90 text-amber-300 border-amber-500/40'
            } p-3 rounded-xl border`}
          >
            {toastMessage.type === 'success' ? (
              <span className="text-emerald-400">✓</span>
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <Info className="w-4 h-4 text-amber-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Quick 1-Click Studio: Nhập tiếng Việt ➔ Tự dịch ➔ 1 nút tải 5 file audio (Ít API nhất) */}
        <QuickOneClickStudio
          scriptsState={scriptsState}
          onUpdateVietnameseText={(text) => handleUpdateScript('vi', { text })}
          onUpdateScript={handleUpdateScript}
          onExecuteOneClickFlow={handleExecuteOneClickFlow}
          isProcessingOneClick={isProcessingOneClick}
          onAutoTranslateOnly={handleAutoTranslateAll}
          isTranslating={isTranslating}
          onGenerateAudioOnly={handleGenerateSpeechForAll}
          isGeneratingAudio={isGeneratingAll}
          audioFormat={audioFormat}
          onChangeAudioFormat={setAudioFormat}
          announcementTitle={announcementTitle}
          masterBuffer={null}
          paHornMode={paHornMode}
          pacingState={pacingState}
          globalCooldown={globalCooldown}
          onCancelPacing={handleCancelPacing}
          currentUser={currentUser}
          accessToken={driveAccessToken}
          onAuthChange={(user, token) => {
            setCurrentUser(user);
            setDriveAccessToken(token);
          }}
          onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
          onShowToast={showToast}
        />

        {/* 2. Multi-Language Script Editor & Voice Tuner */}
        <MultiLanguageEditor
          scriptsState={scriptsState}
          onUpdateScript={handleUpdateScript}
          onAutoTranslateAll={handleAutoTranslateAll}
          isTranslating={isTranslating}
          onGenerateSpeechForLang={handleGenerateSpeechForLang}
          onGenerateSpeechForAll={handleGenerateSpeechForAll}
          isGeneratingAll={isGeneratingAll}
          paHornMode={paHornMode}
          audioFormat={audioFormat}
          globalCooldown={globalCooldown}
          pacingState={pacingState}
          onCancelPacing={handleCancelPacing}
          currentUser={currentUser}
          accessToken={driveAccessToken}
          onAuthChange={(user, token) => {
            setCurrentUser(user);
            setDriveAccessToken(token);
          }}
          onShowToast={showToast}
          onOpenGoogleDriveModal={() => setIsGoogleDriveModalOpen(true)}
          announcementTitle={announcementTitle}
        />

        {/* 3. Shift Saved History */}
        <SavedRecordings
          savedItems={savedItems}
          onLoadItem={handleLoadSavedItem}
          onDeleteItem={handleDeleteSavedItem}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">PA VOICE STUDIO</span>
            <span>•</span>
            <span>Hệ thống chuyển đổi kịch bản thông báo đa ngữ tự nhiên</span>
          </div>
          <p>
            Tích hợp Gemini AI TTS • Tương thích mọi hệ thống âm thanh thông báo và loa nén công cộng
          </p>
        </div>
      </footer>

      {/* Modals */}
      <AiScriptGeneratorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyScripts={handleApplyAiScripts}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyChanged={(hasKey) => setHasCustomApiKey(hasKey)}
      />

      <GoogleDriveModal
        isOpen={isGoogleDriveModalOpen}
        onClose={() => setIsGoogleDriveModalOpen(false)}
        currentUser={currentUser}
        accessToken={driveAccessToken}
        onAuthChange={(user, token) => {
          setCurrentUser(user);
          setDriveAccessToken(token);
        }}
        onShowToast={showToast}
      />
    </div>
  );
}
