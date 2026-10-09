/**
 * API Headers Manager
 * All AI interactions use secure server-side proxy routes with process.env.GEMINI_API_KEY.
 * No client-side API keys are stored or exposed.
 */

export function getSavedApiKey(): string {
  return '';
}

export function saveApiKey(_key: string): void {
  // No-op: API keys are securely managed server-side
}

export function clearApiKey(): void {
  try {
    localStorage.removeItem('custom_gemini_api_key');
  } catch {}
}

export function getApiHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
  };
}

