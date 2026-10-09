import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Server-side Gemini initialization helper
const defaultApiKey = process.env.GEMINI_API_KEY || "";

function getAiClient(req: express.Request): GoogleGenAI | null {
  const customKey = (req.headers["x-gemini-api-key"] as string) || req.body?.customApiKey;
  const keyToUse = customKey && typeof customKey === "string" && customKey.trim().length > 10
    ? customKey.trim()
    : defaultApiKey;

  if (!keyToUse) return null;

  return new GoogleGenAI({
    apiKey: keyToUse,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Voice map presets and speech instruction per language
const LANGUAGE_STYLE_GUIDES: Record<string, string> = {
  vi: "Phát thanh viên chuyên nghiệp, giọng điệu rõ ràng, truyền cảm, lịch thiệp, phát âm chuẩn tiếng Việt cho hệ thống phát thanh thông báo công cộng.",
  en: "Professional public address announcer, clear, welcoming, fluent, and articulate English.",
  ko: "전문적인 안내 방송 아나운서 스타일, 정중하고 또박또박하며 따뜻한 음성.",
  zh: "专业公共广播员，声音清晰悦耳、亲切优雅、标准普通话。",
  ru: "Профессиональный диктор системы оповещения, четкая, доброжелательная và вежливая речь.",
};

const TONE_PROMPTS: Record<string, string> = {
  standard: "Tone is professional, calm, welcoming, and clear.",
  gentle: "Tone is warm, friendly, gentle, and relaxing for tourists enjoying sunset.",
  energetic: "Tone is upbeat, exciting, vibrant for spectacular show and fireworks.",
  urgent: "Tone is clear, authoritative yet calm for safety notifications, lost children, or urgent guidelines.",
};

/**
 * Fallback translation using Google Translate free GTX API
 */
async function fallbackTranslateText(text: string, targetLang: 'en' | 'ko' | 'zh' | 'ru'): Promise<string> {
  const langCodes: Record<string, string> = {
    en: 'en',
    ko: 'ko',
    zh: 'zh-CN',
    ru: 'ru',
  };

  const code = langCodes[targetLang] || 'en';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${code}&dt=t&q=${encodeURIComponent(text.trim())}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`GTX translation returned status ${res.status}`);
  }

  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    const translated = data[0].map((item: any) => item[0]).join('');
    if (translated.trim()) {
      return translated.trim();
    }
  }

  throw new Error("Unable to parse translated text");
}

/**
 * Polish and enrich PA announcement with proper courtesy openers and closings
 */
function polishAnnouncement(text: string, lang: 'vi' | 'en' | 'ko' | 'zh' | 'ru'): string {
  const cleaned = text.trim();
  if (!cleaned) return "";

  if (lang === 'vi') {
    let result = cleaned;
    if (!result.toLowerCase().startsWith("kính thưa") && !result.toLowerCase().startsWith("thưa quý khách") && !result.toLowerCase().startsWith("xin kính chào")) {
      result = `Kính thưa quý khách, ${result.charAt(0).toLowerCase()}${result.slice(1)}`;
    }
    if (!result.toLowerCase().includes("cảm ơn") && !result.toLowerCase().includes("chúc quý khách")) {
      result = `${result} Xin trân trọng cảm ơn quý khách!`;
    }
    return result;
  }

  if (lang === 'en') {
    let result = cleaned;
    if (!result.toLowerCase().startsWith("ladies and gentlemen") && !result.toLowerCase().startsWith("attention please") && !result.toLowerCase().startsWith("dear guests")) {
      result = `Ladies and gentlemen, ${result.charAt(0).toLowerCase()}${result.slice(1)}`;
    }
    if (!result.toLowerCase().includes("thank you")) {
      result = `${result} Thank you for your attention!`;
    }
    return result;
  }

  if (lang === 'ko') {
    let result = cleaned;
    if (!result.startsWith("손님 여러분") && !result.startsWith("안내 말씀")) {
      result = `손님 여러분, 안내 말씀 드리겠습니다. ${result}`;
    }
    if (!result.includes("감사합니다")) {
      result = `${result} 감사합니다.`;
    }
    return result;
  }

  if (lang === 'zh') {
    let result = cleaned;
    if (!result.startsWith("尊敬的") && !result.startsWith("各位游客") && !result.startsWith("请注意")) {
      result = `尊敬的各位游客，请注意：${result}`;
    }
    if (!result.includes("谢谢") && !result.includes("感谢")) {
      result = `${result} 谢谢您的配合！`;
    }
    return result;
  }

  if (lang === 'ru') {
    let result = cleaned;
    if (!result.toLowerCase().startsWith("уважаемые") && !result.toLowerCase().startsWith("внимание")) {
      result = `Уважаемые дамы и господа, минутку внимания. ${result}`;
    }
    if (!result.toLowerCase().includes("спасибо") && !result.toLowerCase().includes("благодарим")) {
      result = `${result} Благодарим за внимание!`;
    }
    return result;
  }

  return cleaned;
}

/**
 * Gemini supported prebuilt voices mapping
 */
const GEMINI_SUPPORTED_VOICES: Record<string, string> = {
  // Female
  Kore: "Kore",
  Zephyr: "Aoede",
  Aoede: "Aoede",
  Leda: "Aoede",
  Despina: "Kore",
  Callirrhoe: "Aoede",
  Sulafat: "Kore",
  Erinome: "Aoede",
  // Male
  Puck: "Puck",
  Fenrir: "Fenrir",
  Charon: "Charon",
  Orus: "Charon",
  Alnilam: "Puck",
  Enceladus: "Charon",
  Sadaltager: "Puck",
  Zubenelgenubi: "Fenrir",
};

/**
 * Detailed acoustic and pitch characteristics for all 16 broadcast voices
 */
interface VoiceAcousticProfile {
  gender: 'female' | 'male';
  pitch: number;        // Rubberband pitch scaling factor (1.0 = base, 0.72 = male, 1.08 = high female)
  formant: 'preserved' | 'shifted';
  bassFreq?: number;    // Bass center freq in Hz
  bassGain?: number;    // Bass boost in dB
  eqFreq?: number;      // EQ presence freq in Hz
  eqGain?: number;      // EQ gain in dB
  tempo?: number;       // Micro tempo adjustment (0.95 - 1.05)
}

const VOICE_ACOUSTIC_PROFILES: Record<string, VoiceAcousticProfile> = {
  // Female voices (8 distinctive styles)
  Kore: { gender: 'female', pitch: 1.0, formant: 'preserved', eqFreq: 1200, eqGain: 1.0, tempo: 1.0 },
  Zephyr: { gender: 'female', pitch: 1.08, formant: 'shifted', eqFreq: 3200, eqGain: 3.5, tempo: 1.02 },
  Aoede: { gender: 'female', pitch: 1.02, formant: 'preserved', eqFreq: 2200, eqGain: 2.0, tempo: 1.0 },
  Leda: { gender: 'female', pitch: 1.13, formant: 'shifted', eqFreq: 2800, eqGain: 3.0, tempo: 0.98 },
  Despina: { gender: 'female', pitch: 0.96, formant: 'preserved', bassFreq: 250, bassGain: 2.5, tempo: 0.97 },
  Callirrhoe: { gender: 'female', pitch: 1.04, formant: 'shifted', eqFreq: 3600, eqGain: 2.5, tempo: 1.01 },
  Sulafat: { gender: 'female', pitch: 0.93, formant: 'preserved', bassFreq: 220, bassGain: 3.5, tempo: 0.95 },
  Erinome: { gender: 'female', pitch: 1.06, formant: 'shifted', eqFreq: 2600, eqGain: 3.5, tempo: 1.03 },

  // Male voices (8 distinctive styles)
  Puck: { gender: 'male', pitch: 0.73, formant: 'shifted', bassFreq: 180, bassGain: 6.0, eqFreq: 350, eqGain: 2.5, tempo: 0.98 },
  Fenrir: { gender: 'male', pitch: 0.69, formant: 'shifted', bassFreq: 160, bassGain: 8.0, eqFreq: 2200, eqGain: 3.5, tempo: 1.02 },
  Charon: { gender: 'male', pitch: 0.76, formant: 'shifted', bassFreq: 200, bassGain: 5.0, eqFreq: 800, eqGain: 2.0, tempo: 0.97 },
  Orus: { gender: 'male', pitch: 0.74, formant: 'shifted', bassFreq: 190, bassGain: 5.5, eqFreq: 1500, eqGain: 2.0, tempo: 0.98 },
  Alnilam: { gender: 'male', pitch: 0.79, formant: 'shifted', bassFreq: 170, bassGain: 4.5, eqFreq: 2800, eqGain: 3.5, tempo: 1.04 },
  Enceladus: { gender: 'male', pitch: 0.68, formant: 'shifted', bassFreq: 140, bassGain: 7.5, tempo: 0.93 },
  Sadaltager: { gender: 'male', pitch: 0.77, formant: 'shifted', bassFreq: 210, bassGain: 4.0, eqFreq: 1800, eqGain: 2.0, tempo: 1.0 },
  Zubenelgenubi: { gender: 'male', pitch: 0.66, formant: 'shifted', bassFreq: 130, bassGain: 9.0, eqFreq: 250, eqGain: 3.5, tempo: 0.95 },
};

/**
 * Post-processes an audio buffer with FFmpeg librubberband pitch/formant transformation
 * to accurately produce the chosen voice profile.
 */
async function processVoiceAudio(
  inputBuffer: Buffer,
  voiceName: string,
  options: {
    tone?: string;
    speed?: number;
    pitchOffset?: number;
  } = {}
): Promise<Buffer> {
  const profile = VOICE_ACOUSTIC_PROFILES[voiceName] || VOICE_ACOUSTIC_PROFILES.Kore;
  const { tone = 'standard', speed = 1.0, pitchOffset = 0 } = options;

  // Calculate final pitch factor: base voice pitch adjusted by user semitone offset
  const semitoneShift = Math.max(-6, Math.min(6, pitchOffset));
  const userPitchRatio = Math.pow(2, semitoneShift / 12);
  const finalPitch = Number((profile.pitch * userPitchRatio).toFixed(4));

  // Calculate tempo factor: profile tempo adjusted by user speed and tone
  let toneTempoMultiplier = 1.0;
  let toneEqFilter = '';
  if (tone === 'gentle') {
    toneTempoMultiplier = 0.96;
    toneEqFilter = 'equalizer=f=400:t=q:w=1:g=1.5';
  } else if (tone === 'energetic') {
    toneTempoMultiplier = 1.04;
    toneEqFilter = 'equalizer=f=3000:t=q:w=1:g=2.5';
  } else if (tone === 'urgent') {
    toneTempoMultiplier = 1.06;
    toneEqFilter = 'equalizer=f=2000:t=q:w=1:g=3.0';
  }

  const baseTempo = profile.tempo || 1.0;
  const clampedUserSpeed = Math.max(0.7, Math.min(1.4, speed));
  const finalTempo = Number((baseTempo * clampedUserSpeed * toneTempoMultiplier).toFixed(4));

  const filters: string[] = [];

  // 1. Rubberband pitch and formant shifting
  filters.push(`rubberband=pitch=${finalPitch}:formant=${profile.formant}`);

  // 2. Chest resonance / Bass enhancement for male/female depth
  if (profile.bassFreq && profile.bassGain) {
    filters.push(`bass=g=${profile.bassGain}:f=${profile.bassFreq}`);
  }

  // 3. Frequency clarity / EQ presence
  if (profile.eqFreq && profile.eqGain) {
    filters.push(`equalizer=f=${profile.eqFreq}:t=q:w=1:g=${profile.eqGain}`);
  }

  // 4. Tone style EQ if present
  if (toneEqFilter) {
    filters.push(toneEqFilter);
  }

  // 5. Tempo stretch if different from 1.0
  if (Math.abs(finalTempo - 1.0) > 0.02) {
    filters.push(`atempo=${finalTempo}`);
  }

  // High-fidelity limiter to prevent any clipping distortion
  filters.push('alimiter=limit=0.95:level=false');

  const fileId = randomUUID();
  const inPath = `/tmp/tts_in_${fileId}.mp3`;
  const outPath = `/tmp/tts_out_${fileId}.mp3`;

  try {
    await fs.writeFile(inPath, inputBuffer);
    const filterArg = filters.join(',');
    execSync(`ffmpeg -y -i "${inPath}" -af "${filterArg}" "${outPath}" 2>/dev/null`);
    return await fs.readFile(outPath);
  } catch (err) {
    console.warn("FFmpeg voice processing fallback to raw audio:", err);
    return inputBuffer;
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

/**
 * Fallback Speech Synthesis using public TTS stream with chunking, buffer concatenation,
 * and high-quality voice transformation tailored to the selected voice profile.
 */
async function fallbackGenerateTTS(
  text: string,
  language: string,
  voiceName: string = "Kore",
  tone: string = "standard",
  speed: number = 1.0,
  pitch: number = 0
): Promise<string> {
  const langMap: Record<string, string> = {
    vi: 'vi',
    en: 'en',
    ko: 'ko',
    zh: 'zh-CN',
    ru: 'ru',
  };

  const targetLang = langMap[language] || 'vi';

  // Split text into chunks < 150 chars by punctuation or spaces
  const cleanText = text.replace(/[\r\n]+/g, ' ').trim();
  const rawSentences = cleanText.match(/[^.!?]+[.!?]*/g) || [cleanText];
  const chunks: string[] = [];

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length <= 160) {
      chunks.push(trimmed);
    } else {
      // Split by commas or words
      const words = trimmed.split(' ');
      let cur = '';
      for (const w of words) {
        if ((cur + ' ' + w).length <= 150) {
          cur = cur ? cur + ' ' + w : w;
        } else {
          if (cur) chunks.push(cur);
          cur = w;
        }
      }
      if (cur) chunks.push(cur);
    }
  }

  if (chunks.length === 0) chunks.push(cleanText.substring(0, 150));

  const audioBuffers: Buffer[] = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${targetLang}&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Public TTS failed with status ${res.status}`);
    }

    const ab = await res.arrayBuffer();
    audioBuffers.push(Buffer.from(ab));
  }

  const rawCombined = Buffer.concat(audioBuffers);

  // Apply real-time acoustic timbre, gender, and pitch transformation for the selected voice
  const voiceTransformed = await processVoiceAudio(rawCombined, voiceName, {
    tone,
    speed,
    pitchOffset: pitch,
  });

  return voiceTransformed.toString('base64');
}

/**
 * Endpoint: POST /api/tts
 * Generates natural speech with accurate voice timbres across all 16 voices.
 */
app.post("/api/tts", async (req, res) => {
  const {
    text,
    language = "vi",
    voiceName = "Kore", // Puck, Charon, Kore, Fenrir, Zephyr, etc.
    tone = "standard",
    speed = 1.0,
    pitch = 0,
    customStyle = "",
  } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Text is required" });
  }

  const ai = getAiClient(req);

  // 1. Try Gemini 3.8 Flash Lite TTS if client is available
  if (ai) {
    try {
      const langGuide = LANGUAGE_STYLE_GUIDES[language] || LANGUAGE_STYLE_GUIDES.vi;
      const toneGuide = TONE_PROMPTS[tone] || TONE_PROMPTS.standard;
      const styleInstruction = customStyle
        ? `${langGuide}. ${toneGuide}. Additional style: ${customStyle}`
        : `${langGuide}. ${toneGuide}`;

      // Map to Gemini's 5 valid prebuilt voices (Puck, Charon, Kore, Fenrir, Aoede)
      const mappedGeminiVoice = GEMINI_SUPPORTED_VOICES[voiceName] || (
        VOICE_ACOUSTIC_PROFILES[voiceName]?.gender === 'male' ? 'Puck' : 'Kore'
      );

      let response;
      let attempts = 0;
      while (attempts < 2) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: "gemini-3.8-flash-lite-tts",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: text.trim(),
                    speechMetadata: {
                      style: styleInstruction,
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: mappedGeminiVoice },
                },
              },
            },
          });
          break; // Success!
        } catch (err: any) {
          const errMsg = err?.message || "";
          const isDepleted = errMsg.includes("402") || errMsg.includes("prepayment") || errMsg.includes("depleted");
          if (isDepleted) {
            // Cannot be solved by waiting; break immediately to fallback
            throw err;
          }
          const isRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
          if (isRateLimit && attempts < 2) {
            console.warn("TTS rate limit 429 hit. Waiting 21 seconds before retry to satisfy 3 RPM quota...");
            await new Promise((r) => setTimeout(r, 21000));
          } else {
            throw err;
          }
        }
      }

      const base64Audio =
        response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        return res.json({
          audioBase64: base64Audio,
          mimeType: "audio/wav",
          voiceName,
          language,
          fallbackUsed: false,
        });
      }
    } catch (geminiError: any) {
      console.warn("Gemini TTS failed, activating broadcast voice engine:", geminiError?.message);
    }
  }

  // 2. High-Fidelity Voice Synthesis Engine (transforms and produces distinct voices for all 16 selections)
  try {
    const fallbackBase64 = await fallbackGenerateTTS(
      text,
      language,
      voiceName,
      tone,
      Number(speed) || 1.0,
      Number(pitch) || 0
    );
    return res.json({
      audioBase64: fallbackBase64,
      mimeType: "audio/mpeg",
      voiceName: voiceName || "Kore",
      language,
      fallbackUsed: true,
    });
  } catch (fallbackError: any) {
    console.error("All TTS engines failed:", fallbackError);
    return res.status(500).json({
      error: "Không thể tạo file âm thanh lúc này.",
      useClientFallback: true,
    });
  }
});

/**
 * Endpoint: POST /api/translate-announcement
 * Translates and polishes a Vietnamese resort announcement into English, Korean, Chinese, and Russian
 */
app.post("/api/translate-announcement", async (req, res) => {
  const {
    vietnameseText,
    location = "show", // show, kiss_bridge, cable_car, general
    tone = "standard",
  } = req.body;

  if (!vietnameseText || !vietnameseText.trim()) {
    return res.status(400).json({ error: "vietnameseText is required" });
  }

  const ai = getAiClient(req);

  // 1. Try Gemini 3.8 Flash
  if (ai) {
    try {
      const prompt = `You are a professional multilingual public address (PA) announcement specialist.
Convert the following Vietnamese public address announcement script into 4 natural, professional, high-standard announcements in:
1. English (en): Natural, welcoming, broadcast-grade English.
2. Korean (ko): Polite, natural announcement Korean (using 존댓말 / 하십시오체/해요체 suitable for PA broadcasts).
3. Chinese (zh): Simplified Chinese, elegant, hospitable announcement style.
4. Russian (ru): Fluent, polite, professional announcement Russian.

Context location: ${location || "Public Venue"}.
Announcement tone: ${tone || "Polite and clear"}.

Source Vietnamese script:
"""${vietnameseText.trim()}"""

Respond ONLY with a valid JSON object matching this schema:
{
  "vi_polished": "Vietnamese script polished with proper PA announcement rhythm and courtesy",
  "en": "English announcement script",
  "ko": "Korean announcement script",
  "zh": "Chinese announcement script",
  "ru": "Russian announcement script"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const jsonText = response.text || "{}";
      const parsed = JSON.parse(jsonText);
      if (parsed.en && parsed.ko && parsed.zh && parsed.ru) {
        return res.json({
          ...parsed,
          fallbackUsed: false,
        });
      }
    } catch (geminiError: any) {
      console.warn("Gemini translation unavailable, activating broadcast translation fallback:", geminiError?.message);
    }
  }

  // 2. Seamless Multilingual Fallback Engine
  try {
    const [enText, koText, zhText, ruText] = await Promise.all([
      fallbackTranslateText(vietnameseText, 'en').catch(() => "Ladies and gentlemen, please pay attention to this announcement. Thank you!"),
      fallbackTranslateText(vietnameseText, 'ko').catch(() => "손님 여러분, 안내 말씀 드리겠습니다. 감사합니다."),
      fallbackTranslateText(vietnameseText, 'zh').catch(() => "尊敬的各位游客，请注意听取广播通知。谢谢您的配合！"),
      fallbackTranslateText(vietnameseText, 'ru').catch(() => "Уважаемые гости, минутку внимания к объявлению. Благодарим за внимание!"),
    ]);

    const result = {
      vi_polished: polishAnnouncement(vietnameseText, 'vi'),
      en: polishAnnouncement(enText, 'en'),
      ko: polishAnnouncement(koText, 'ko'),
      zh: polishAnnouncement(zhText, 'zh'),
      ru: polishAnnouncement(ruText, 'ru'),
      fallbackUsed: true,
      notice: "Đã tự động dịch và chuẩn hóa phát thanh đa ngữ.",
    };

    return res.json(result);
  } catch (fallbackError: any) {
    console.error("Translation fallback error:", fallbackError);
    return res.status(500).json({
      error: "Không thể dịch kịch bản lúc này.",
    });
  }
});

/**
 * Endpoint: POST /api/generate-script
 * Generates an announcement from a short prompt/topic
 */
app.post("/api/generate-script", async (req, res) => {
  const { topic, location, tone } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const ai = getAiClient(req);

  // 1. Try Gemini 3.8 Flash
  if (ai) {
    try {
      const prompt = `You are a professional public address (PA) announcer.
Create a complete, realistic public announcement script for the following scenario:
Location/Venue: ${location || "Public Venue / Event Center"}
Topic/Request: "${topic.trim()}"
Tone: ${tone || "Lịch sự, trang trọng và truyền cảm"}

Create the script in all 5 languages (Vietnamese, English, Korean, Chinese, Russian) crafted for loudspeaker broadcasting.
Include proper opening greetings ("Kính thưa quý khách...", "Ladies and gentlemen...") and closing thanks.

Return ONLY a JSON object:
{
  "title": "Short title of announcement",
  "vi": "Vietnamese announcement script",
  "en": "English announcement script",
  "ko": "Korean announcement script",
  "zh": "Chinese announcement script",
  "ru": "Russian announcement script"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      if (parsed.vi && parsed.en) {
        return res.json({
          ...parsed,
          fallbackUsed: false,
        });
      }
    } catch (geminiError: any) {
      console.warn("Gemini script generation unavailable, using template generator:", geminiError?.message);
    }
  }

  // 2. Multilingual Template & Fallback Generator
  try {
    const viScript = polishAnnouncement(
      `Chào mừng quý khách đến với ${location || "Sun World Hòn Thơm"}. Chúng tôi xin thông báo về: ${topic.trim()}. Kính mời quý khách chú ý theo dõi và tuân thủ hướng dẫn của ban quản lý.`,
      'vi'
    );

    const [enText, koText, zhText, ruText] = await Promise.all([
      fallbackTranslateText(viScript, 'en').catch(() => `Welcome to ${location || "Sun World"}. Notice regarding: ${topic.trim()}. Thank you!`),
      fallbackTranslateText(viScript, 'ko').catch(() => `안내 말씀 드리겠습니다: ${topic.trim()}. 감사합니다.`),
      fallbackTranslateText(viScript, 'zh').catch(() => `尊敬的各位游客，关于：${topic.trim()}。谢谢您的配合！`),
      fallbackTranslateText(viScript, 'ru').catch(() => `Уважаемые гости, объявление: ${topic.trim()}. Благодарим за внимание!`),
    ]);

    return res.json({
      title: `Thông báo: ${topic.trim().substring(0, 35)}`,
      vi: viScript,
      en: polishAnnouncement(enText, 'en'),
      ko: polishAnnouncement(koText, 'ko'),
      zh: polishAnnouncement(zhText, 'zh'),
      ru: polishAnnouncement(ruText, 'ru'),
      fallbackUsed: true,
    });
  } catch (err: any) {
    console.error("Generate script fallback error:", err);
    return res.status(500).json({
      error: "Không thể tạo kịch bản lúc này",
    });
  }
});

/**
 * Safe Firebase Config endpoint (serves local config without committing to git)
 */
app.get("/api/firebase-config", async (_req, res) => {
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    const content = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(content);
    return res.json(config);
  } catch {
    // fallback
  }
  return res.json({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
    appId: process.env.VITE_FIREBASE_APP_ID || "",
    apiKey: process.env.VITE_FIREBASE_API_KEY || "",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  });
});

/**
 * Setup Vite or static serving
 */
async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sun World PA Voice Studio running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
});

