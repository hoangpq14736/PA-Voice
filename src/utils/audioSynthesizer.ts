import { ChimeType, LanguageCode, AudioFormat } from '../types';
import { encodeMp3Blob } from './mp3Encoder';

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

/**
 * Synthesizes a crystal clear musical chime / jingle for resort PA
 */
export async function createChimeAudioBuffer(
  type: ChimeType,
  sampleRate = 44100
): Promise<AudioBuffer | null> {
  if (type === 'none') return null;

  interface Note {
    freq: number;
    start: number;
    duration: number;
    gain: number;
  }

  let notes: Note[] = [];
  let totalDuration = 2.0;

  if (type === 'sunworld') {
    // Elegant Sun World 4-note bell: F5 (698.46Hz), C6 (1046.5Hz), A5 (880Hz), C6 (1046.5Hz)
    totalDuration = 2.8;
    notes = [
      { freq: 698.46, start: 0.0, duration: 1.2, gain: 0.4 },
      { freq: 880.0, start: 0.35, duration: 1.2, gain: 0.45 },
      { freq: 1046.5, start: 0.7, duration: 1.4, gain: 0.5 },
      { freq: 1396.9, start: 1.15, duration: 1.6, gain: 0.45 },
    ];
  } else if (type === 'dingdong') {
    // Classic 2-tone resort/airport ding-dong: Eb5 (622.25Hz) -> Bb4 (466.16Hz)
    totalDuration = 2.2;
    notes = [
      { freq: 622.25, start: 0.0, duration: 1.1, gain: 0.5 },
      { freq: 466.16, start: 0.6, duration: 1.5, gain: 0.55 },
    ];
  } else if (type === 'attention') {
    // 3-tone attention chime: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
    totalDuration = 2.4;
    notes = [
      { freq: 523.25, start: 0.0, duration: 0.9, gain: 0.45 },
      { freq: 659.25, start: 0.4, duration: 0.9, gain: 0.45 },
      { freq: 783.99, start: 0.8, duration: 1.5, gain: 0.5 },
    ];
  } else if (type === 'urgent') {
    // 2-tone alert chime (A5, D6)
    totalDuration = 1.8;
    notes = [
      { freq: 880.0, start: 0.0, duration: 0.5, gain: 0.6 },
      { freq: 1174.66, start: 0.45, duration: 0.5, gain: 0.6 },
      { freq: 880.0, start: 0.9, duration: 0.8, gain: 0.6 },
    ];
  }

  const offlineCtx = new OfflineAudioContext(1, Math.ceil(sampleRate * totalDuration), sampleRate);

  notes.forEach((n) => {
    // Fundamental oscillator (sine)
    const osc = offlineCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(n.freq, n.start);

    // Harmonic overtone for bell shimmer
    const oscHarmonic = offlineCtx.createOscillator();
    oscHarmonic.type = 'sine';
    oscHarmonic.frequency.setValueAtTime(n.freq * 2.756, n.start);

    const gainNode = offlineCtx.createGain();
    gainNode.gain.setValueAtTime(0.0001, n.start);
    gainNode.gain.linearRampToValueAtTime(n.gain, n.start + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, n.start + n.duration);

    const harmonicGain = offlineCtx.createGain();
    harmonicGain.gain.setValueAtTime(0.0001, n.start);
    harmonicGain.gain.linearRampToValueAtTime(n.gain * 0.25, n.start + 0.015);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, n.start + n.duration * 0.6);

    osc.connect(gainNode);
    oscHarmonic.connect(harmonicGain);
    gainNode.connect(offlineCtx.destination);
    harmonicGain.connect(offlineCtx.destination);

    osc.start(n.start);
    osc.stop(n.start + n.duration);
    oscHarmonic.start(n.start);
    oscHarmonic.stop(n.start + n.duration);
  });

  return await offlineCtx.startRendering();
}

/**
 * Decode Base64 or ArrayBuffer into an AudioBuffer
 */
export async function decodeAudioData(
  audioBytesOrBase64: ArrayBuffer | string,
  ctx?: AudioContext
): Promise<AudioBuffer> {
  const audioCtx = ctx || getAudioContext();
  let arrayBuffer: ArrayBuffer;

  if (typeof audioBytesOrBase64 === 'string') {
    const binary = atob(audioBytesOrBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  } else {
    arrayBuffer = audioBytesOrBase64;
  }

  // Clone buffer to avoid detached buffer issues in WebKit/Chromium
  const bufferCopy = arrayBuffer.slice(0);
  return await audioCtx.decodeAudioData(bufferCopy);
}

/**
 * Apply Speed, Tone (EQ Pitch effect), and Outdoor PA Loudspeaker Horn simulation
 */
export async function processAudioBuffer(
  inputBuffer: AudioBuffer,
  options: {
    speed?: number; // 0.7 to 1.4
    pitchSemitones?: number; // -4 to +4
    paHornEffect?: boolean; // Outdoor PA speaker acoustics
    volume?: number; // 0.0 to 1.5
  }
): Promise<AudioBuffer> {
  const {
    speed = 1.0,
    pitchSemitones = 0,
    paHornEffect = false,
    volume = 1.0,
  } = options;

  const targetSampleRate = inputBuffer.sampleRate;
  // Playback rate factor affects total duration: duration = original / speed
  const rateFactor = Math.max(0.6, Math.min(1.6, speed));
  const newDuration = inputBuffer.duration / rateFactor;
  const totalLength = Math.max(1, Math.ceil(newDuration * targetSampleRate));

  const offlineCtx = new OfflineAudioContext(1, totalLength, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;
  source.playbackRate.setValueAtTime(rateFactor, 0);

  let lastNode: AudioNode = source;

  // Master Gain Node
  const gainNode = offlineCtx.createGain();
  gainNode.gain.setValueAtTime(volume, 0);

  // Pitch tone shaping via Multi-band Filter
  if (pitchSemitones !== 0) {
    const toneFilter = offlineCtx.createBiquadFilter();
    if (pitchSemitones > 0) {
      // Brighter, higher, clearer
      toneFilter.type = 'highshelf';
      toneFilter.frequency.setValueAtTime(2500, 0);
      toneFilter.gain.setValueAtTime(Math.min(9, pitchSemitones * 2.2), 0);
    } else {
      // Deeper, warmer, more bass
      toneFilter.type = 'lowshelf';
      toneFilter.frequency.setValueAtTime(320, 0);
      toneFilter.gain.setValueAtTime(Math.min(9, Math.abs(pitchSemitones) * 2.5), 0);
    }
    lastNode.connect(toneFilter);
    lastNode = toneFilter;
  }

  // PA Loudspeaker simulation (horn speaker acoustics: bandpass 300Hz-4200Hz + midrange boost)
  if (paHornEffect) {
    const hp = offlineCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(320, 0);
    hp.Q.setValueAtTime(1.0, 0);

    const lp = offlineCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, 0);
    lp.Q.setValueAtTime(1.0, 0);

    const midBoost = offlineCtx.createBiquadFilter();
    midBoost.type = 'peaking';
    midBoost.frequency.setValueAtTime(1800, 0);
    midBoost.Q.setValueAtTime(1.5, 0);
    midBoost.gain.setValueAtTime(5.0, 0);

    lastNode.connect(hp);
    hp.connect(lp);
    lp.connect(midBoost);
    lastNode = midBoost;
  }

  lastNode.connect(gainNode);
  gainNode.connect(offlineCtx.destination);

  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * Concatenates multiple AudioBuffers with a configurable pause gap
 */
export function concatenateAudioBuffers(
  buffers: (AudioBuffer | null)[],
  gapSeconds = 1.2,
  sampleRate = 44100
): AudioBuffer | null {
  const validBuffers = buffers.filter((b): b is AudioBuffer => b !== null && b.duration > 0);
  if (validBuffers.length === 0) return null;

  const gapSamples = Math.floor(gapSeconds * sampleRate);
  let totalSamples = 0;

  validBuffers.forEach((buf, idx) => {
    // Length in target sample rate
    const bufSamples = Math.floor(buf.duration * sampleRate);
    totalSamples += bufSamples;
    if (idx < validBuffers.length - 1) {
      totalSamples += gapSamples;
    }
  });

  const audioCtx = getAudioContext();
  const output = audioCtx.createBuffer(1, totalSamples, sampleRate);
  const outputChannel = output.getChannelData(0);

  let currentOffset = 0;

  validBuffers.forEach((buf, idx) => {
    const inputChannel = buf.getChannelData(0);
    const bufDuration = buf.duration;
    const targetLength = Math.floor(bufDuration * sampleRate);

    // Resample if necessary
    for (let i = 0; i < targetLength && currentOffset + i < totalSamples; i++) {
      const srcIndex = Math.floor((i / targetLength) * inputChannel.length);
      outputChannel[currentOffset + i] = inputChannel[Math.min(srcIndex, inputChannel.length - 1)];
    }

    currentOffset += targetLength;
    if (idx < validBuffers.length - 1) {
      currentOffset += gapSamples;
    }
  });

  return output;
}

/**
 * Encode an AudioBuffer into standard 16-bit PCM WAV Blob
 */
export function encodeWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const numSamples = channelData.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // chunkSize
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // audioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bitsPerSample

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio samples (clamped between -1 and 1)
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Encodes AudioBuffer into chosen format ('mp3' or 'wav')
 */
export function encodeAudioBlob(audioBuffer: AudioBuffer, format: AudioFormat = 'mp3'): { blob: Blob; extension: string; mimeType: string } {
  if (format === 'mp3') {
    return {
      blob: encodeMp3Blob(audioBuffer, 128),
      extension: 'mp3',
      mimeType: 'audio/mp3',
    };
  }
  return {
    blob: encodeWavBlob(audioBuffer),
    extension: 'wav',
    mimeType: 'audio/wav',
  };
}

/**
 * Fallback Web Speech API speech synthesis
 */
export async function fallbackSpeak(
  text: string,
  lang: LanguageCode,
  rate = 1.0,
  pitch = 1.0
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      return reject(new Error('Trình duyệt không hỗ trợ Web Speech API'));
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    const langTags: Record<LanguageCode, string> = {
      vi: 'vi-VN',
      en: 'en-US',
      ko: 'ko-KR',
      zh: 'zh-CN',
      ru: 'ru-RU',
    };

    utterance.lang = langTags[lang] || 'vi-VN';
    utterance.rate = Math.max(0.6, Math.min(1.5, rate));
    utterance.pitch = Math.max(0.6, Math.min(1.4, pitch));

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(new Error(`Lỗi phát giọng: ${e.error}`));

    window.speechSynthesis.speak(utterance);
  });
}
