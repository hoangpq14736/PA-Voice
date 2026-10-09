/**
 * Safe Firebase configuration loader.
 * Loads from local config file if present in the runtime environment,
 * or falls back to VITE_ environment variables.
 * Does not expose raw secrets in source control.
 */

// Dynamically check for local config file without breaking build if gitignored/missing
const localConfigFiles = import.meta.glob('/firebase-applet-config.json', { eager: true }) as Record<string, any>;
const localFile = localConfigFiles['/firebase-applet-config.json']?.default || localConfigFiles['/firebase-applet-config.json'];

export interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket?: string;
  messagingSenderId?: string;
  oAuthClientId?: string;
}

export function getSafeFirebaseConfig(): FirebaseAppConfig {
  if (localFile && localFile.apiKey && !localFile.apiKey.startsWith('YOUR_')) {
    return {
      projectId: localFile.projectId || '',
      appId: localFile.appId || '',
      apiKey: localFile.apiKey || '',
      authDomain: localFile.authDomain || `${localFile.projectId}.firebaseapp.com`,
      storageBucket: localFile.storageBucket,
      messagingSenderId: localFile.messagingSenderId,
      oAuthClientId: localFile.oAuthClientId,
    };
  }

  return {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0673549544',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:824911374395:web:271df3617a4b70baeb941e',
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0673549544.firebaseapp.com',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0673549544.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '824911374395',
  };
}
