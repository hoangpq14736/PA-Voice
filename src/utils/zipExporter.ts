import JSZip from 'jszip';
import { LanguageCode, AudioFormat } from '../types';
import { encodeAudioBlob } from './audioSynthesizer';

interface PackageLanguageItem {
  code: LanguageCode;
  label: string;
  buffer: AudioBuffer;
  text: string;
}

/**
 * Packages 5 language audio files + master audio + script text into a single downloadable .ZIP
 */
export async function createAndDownloadZip(options: {
  title: string;
  items: PackageLanguageItem[];
  masterBuffer?: AudioBuffer | null;
  format?: AudioFormat;
}): Promise<void> {
  const { title, items, masterBuffer, format = 'mp3' } = options;
  const zip = new JSZip();

  // Create text file with full scripts for documentation
  let textContent = `========================================================\n`;
  textContent += `HỆ THỐNG PHÁT THANH THÔNG BÁO ĐA NGỮ (PA VOICE STUDIO)\n`;
  textContent += `Tiêu đề: ${title}\n`;
  textContent += `Thời gian xuất file: ${new Date().toLocaleString('vi-VN')}\n`;
  textContent += `Định dạng âm thanh: ${format.toUpperCase()} (Tối ưu cho hệ thống loa nén PA công cộng)\n`;
  textContent += `========================================================\n\n`;

  // Language file names map
  const langFilePrefixes: Record<LanguageCode, string> = {
    vi: '01_TiengViet_VI',
    en: '02_TiengAnh_EN',
    ko: '03_TiengHan_KO',
    zh: '04_TiengTrung_ZH',
    ru: '05_TiengNga_RU',
  };

  // Add individual language audio files
  for (const item of items) {
    const { blob, extension } = encodeAudioBlob(item.buffer, format);
    const fileName = `${langFilePrefixes[item.code] || item.code}.${extension}`;
    zip.file(fileName, blob);

    textContent += `--- [${item.label.toUpperCase()}] ---\n`;
    textContent += `${item.text}\n\n`;
  }

  // Add Master combined broadcast file if provided
  if (masterBuffer) {
    const { blob, extension } = encodeAudioBlob(masterBuffer, format);
    zip.file(`00_BanTinLienHoan_Master.${extension}`, blob);
    textContent += `--- [BẢN TIN LIÊN HOÀN 5 THỨ TIẾNG (MASTER)] ---\n`;
    textContent += `Gồm: Chuông hiệu thông báo + Tiếng Việt + Tiếng Anh + Tiếng Hàn + Tiếng Trung + Tiếng Nga\n\n`;
  }

  zip.file(`KichBan_ChiTiet.txt`, textContent);

  // Generate zip file
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Trigger download
  const cleanTitle = (title || 'PA_Voice')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30);
  const zipFileName = `PA_Voice_${cleanTitle}_${format.toUpperCase()}_5_NgonNgu.zip`;

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads individual files sequentially with a small delay
 */
export async function downloadFilesIndividually(options: {
  title: string;
  items: PackageLanguageItem[];
  format?: AudioFormat;
}): Promise<void> {
  const { items, format = 'mp3' } = options;
  const langFilePrefixes: Record<LanguageCode, string> = {
    vi: '01_TiengViet_VI',
    en: '02_TiengAnh_EN',
    ko: '03_TiengHan_KO',
    zh: '04_TiengTrung_ZH',
    ru: '05_TiengNga_RU',
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { blob, extension } = encodeAudioBlob(item.buffer, format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${langFilePrefixes[item.code] || item.code}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    // Short delay so browser doesn't block parallel downloads
    await new Promise((r) => setTimeout(r, 400));
  }
}
