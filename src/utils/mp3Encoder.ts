// @ts-ignore
import lamejs from 'lamejs';

/**
 * Converts an AudioBuffer (mono or stereo) into an MP3 Blob using lamejs
 * @param audioBuffer The AudioBuffer to encode
 * @param kbps Bitrate in kbps (default 128kbps, ideal for voice PA announcements)
 */
export function encodeMp3Blob(audioBuffer: AudioBuffer, kbps = 128): Blob {
  const channels = 1; // Mono for PA loudspeaker announcements
  const sampleRate = audioBuffer.sampleRate;

  // Lamejs Mp3Encoder
  const Mp3Encoder = (lamejs as any).Mp3Encoder || (lamejs as any).default?.Mp3Encoder;
  if (!Mp3Encoder) {
    throw new Error('Không thể khởi tạo bộ mã hóa MP3');
  }

  const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  // Convert float32 (-1.0 to 1.0) to 16-bit PCM (-32768 to 32767)
  const samples = new Int16Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const blockSize = 1152; // LAME standard frame size
  for (let i = 0; i < totalSamples; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const flushedBuf = mp3encoder.flush();
  if (flushedBuf.length > 0) {
    mp3Data.push(new Uint8Array(flushedBuf));
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}
