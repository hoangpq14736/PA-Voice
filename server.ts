import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
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
  ru: "Профессиональный диктор системы оповещения, четкая, доброжелательная и вежливая речь.",
};

const TONE_PROMPTS: Record<string, string> = {
  standard: "Tone is professional, calm, welcoming, and clear.",
  gentle: "Tone is warm, friendly, gentle, and relaxing for tourists enjoying sunset.",
  energetic: "Tone is upbeat, exciting, vibrant for spectacular show and fireworks.",
  urgent: "Tone is clear, authoritative yet calm for safety notifications, lost children, or urgent guidelines.",
};

/**
 * Endpoint: POST /api/tts
 * Generates natural speech using gemini-3.8-flash-lite-tts
 */
app.post("/api/tts", async (req, res) => {
  try {
    const {
      text,
      language = "vi",
      voiceName = "Kore", // Puck, Charon, Kore, Fenrir, Zephyr
      tone = "standard",
      customStyle = "",
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    const ai = getAiClient(req);
    if (!ai) {
      return res.status(503).json({
        error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key trong phần Cài đặt API hoặc cấu hình máy chủ.",
        useClientFallback: true,
      });
    }

    const langGuide = LANGUAGE_STYLE_GUIDES[language] || LANGUAGE_STYLE_GUIDES.vi;
    const toneGuide = TONE_PROMPTS[tone] || TONE_PROMPTS.standard;
    const styleInstruction = customStyle
      ? `${langGuide}. ${toneGuide}. Additional style: ${customStyle}`
      : `${langGuide}. ${toneGuide}`;

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
                prebuiltVoiceConfig: { voiceName: voiceName || "Kore" },
              },
            },
          },
        });
        break; // Success!
      } catch (err: any) {
        const errMsg = err?.message || "";
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

    if (!base64Audio) {
      return res.status(500).json({
        error: "Không nhận được dữ liệu âm thanh từ mô hình.",
        useClientFallback: true,
      });
    }

    // Default Unary format is audio/wav (24kHz, 16-bit mono WAV)
    return res.json({
      audioBase64: base64Audio,
      mimeType: "audio/wav",
      voiceName,
      language,
    });
  } catch (error: any) {
    console.error("TTS Generation error:", error);
    const errMsg = error?.message || "";
    const isRateLimit = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
    const userMessage = isRateLimit
      ? "Tài khoản đang bị giới hạn 3 RPM (lượt/phút). Hệ thống đã tự kích hoạt chế độ giãn cách 20 giây."
      : (error?.message || "Không thể tạo file âm thanh");

    return res.status(isRateLimit ? 429 : 500).json({
      error: userMessage,
      isRateLimit,
      retryAfter: 20,
      useClientFallback: true,
    });
  }
});

/**
 * Endpoint: POST /api/translate-announcement
 * Translates and polishes a Vietnamese resort announcement into English, Korean, Chinese, and Russian
 */
app.post("/api/translate-announcement", async (req, res) => {
  try {
    const {
      vietnameseText,
      location = "show", // show, kiss_bridge, cable_car, general
      tone = "standard",
    } = req.body;

    if (!vietnameseText || !vietnameseText.trim()) {
      return res.status(400).json({ error: "vietnameseText is required" });
    }

    const ai = getAiClient(req);
    if (!ai) {
      return res.status(503).json({
        error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key trong phần Cài đặt API hoặc cấu hình máy chủ.",
      });
    }

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
    return res.json(parsed);
  } catch (error: any) {
    console.error("Translation error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to translate announcement",
    });
  }
});

/**
 * Endpoint: POST /api/generate-script
 * Generates an announcement from a short prompt/topic
 */
app.post("/api/generate-script", async (req, res) => {
  try {
    const { topic, location, tone } = req.body;

    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const ai = getAiClient(req);
    if (!ai) {
      return res.status(503).json({
        error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key trong phần Cài đặt API hoặc cấu hình máy chủ.",
      });
    }

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
    return res.json(parsed);
  } catch (error: any) {
    console.error("Generate script error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to generate announcement script",
    });
  }
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
