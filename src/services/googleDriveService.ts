import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import { getSafeFirebaseConfig } from './firebaseConfig';

// Google Drive file scope (least privilege: only access files created/opened by this app)
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const firebaseConfig = getSafeFirebaseConfig();
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  size?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

// Auth state listener - in-memory token cache only
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không thể nhận Access Token từ Google Auth. Vui lòng thử lại.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignOut = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Ensures or retrieves the dedicated folder for PA Voice Studio in the user's Drive
 */
export async function getOrCreateAppFolder(
  accessToken: string,
  folderName = 'PA Voice Studio - File MP3'
): Promise<DriveFolderInfo> {
  const query = encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error(`Lỗi tìm thư mục Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existing = searchData.files[0];
    return {
      id: existing.id,
      name: existing.name,
      webViewLink: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
    };
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Thư mục chứa các file âm thanh thông báo phát thanh MP3 từ PA Voice Studio',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Lỗi tạo thư mục Google Drive: ${errText}`);
  }

  const created = await createRes.json();
  return {
    id: created.id,
    name: created.name,
    webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
}

/**
 * Uploads an audio blob (MP3 / WAV) to Google Drive using multipart upload
 */
export async function uploadAudioToDrive(params: {
  accessToken: string;
  fileName: string;
  blob: Blob;
  mimeType?: string;
  folderId?: string;
  description?: string;
}): Promise<DriveFileInfo> {
  const {
    accessToken,
    fileName,
    blob,
    mimeType = 'audio/mpeg',
    folderId,
    description,
  } = params;

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: mimeType,
    description: description || 'File thông báo phát thanh MP3 tạo bởi PA Voice Studio',
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '---------PAVoiceStudioBoundary' + Math.random().toString(36).substring(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;
  const mediaHeaderPart = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;

  const metadataBlob = new Blob([metadataPart], { type: 'text/plain' });
  const mediaHeaderBlob = new Blob([mediaHeaderPart], { type: 'text/plain' });
  const closeBlob = new Blob([closeDelimiter], { type: 'text/plain' });

  const multipartBlob = new Blob([metadataBlob, mediaHeaderBlob, blob, closeBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadUrl =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size,createdTime';

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Tải lên Google Drive thất bại: ${errorData}`);
  }

  return await res.json();
}

/**
 * Lists audio files saved in the app folder
 */
export async function listAppDriveFiles(
  accessToken: string,
  folderId?: string
): Promise<DriveFileInfo[]> {
  let query = 'trashed = false and mimeType != "application/vnd.google-apps.folder"';
  if (folderId) {
    query += ` and '${folderId}' in parents`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,webViewLink,webContentLink,createdTime,size)&orderBy=createdTime desc&pageSize=50`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Không thể lấy danh sách file Drive: ${errorData}`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Permanently deletes or removes a file from Google Drive.
 * MANDATORY: Always require explicit user confirmation prior to calling this method!
 */
export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errorData = await res.text();
    throw new Error(`Xóa file Drive thất bại: ${errorData}`);
  }
}
