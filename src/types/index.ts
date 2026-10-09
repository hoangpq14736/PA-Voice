export type LanguageCode = 'vi' | 'en' | 'ko' | 'zh' | 'ru';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  defaultVoice: string;
  defaultSpeed: number;
  defaultPitch: number; // -4 to +4 semitones or 0 neutral
  voiceOptions: {
    id: string;
    name: string;
    gender: 'Nữ' | 'Nam';
    style: string;
  }[];
}

export type AudioFormat = 'mp3' | 'wav';

export interface ScriptState {
  code: LanguageCode;
  text: string;
  voice: string;
  speed: number; // 0.7 to 1.4
  pitch: number; // -4 to +4
  toneStyle: 'standard' | 'gentle' | 'energetic' | 'urgent';
  audioBlobUrl: string | null;
  audioBase64: string | null;
  audioDuration: number;
  isGenerating: boolean;
  error: string | null;
  generatedVoice?: string;
}

export type ChimeType = 'sunworld' | 'dingdong' | 'attention' | 'urgent' | 'none';

export interface AnnouncementPreset {
  id: string;
  title: string;
  category: 'show' | 'kiss_bridge' | 'cable_car' | 'cskh' | 'emergency';
  categoryLabel: string;
  location: string;
  tone: 'standard' | 'gentle' | 'energetic' | 'urgent';
  scripts: Record<LanguageCode, string>;
}

export interface BroadcastHistoryItem {
  id: string;
  title: string;
  location: string;
  timestamp: number;
  languages: LanguageCode[];
  audioBlobUrl?: string;
  duration: number;
  scripts: Record<LanguageCode, string>;
}

export interface PacingState {
  isActive: boolean;
  mode: 'one-click' | 'batch-all' | 'single' | null;
  currentLang: LanguageCode | null;
  nextLang: LanguageCode | null;
  phase: 'generating' | 'delaying_cooldown' | 'idle';
  remainingSeconds: number;
  totalSeconds: number;
  completedCount: number;
  totalCount: number;
  message: string;
}

export interface TtsRateLimitStatus {
  cooldownSeconds: number; // 0..20 remaining on global cooldown
  isPacing: boolean; // true when multi-step 20s delay is active
  currentLang?: LanguageCode;
  nextLang?: LanguageCode;
  waitingCountdown: number; // remaining seconds (0..20) of inter-language delay
  currentStepIndex: number; // e.g. 1
  totalSteps: number; // e.g. 5
  statusMessage: string;
}
