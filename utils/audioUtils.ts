import { Blob } from '@google/genai';

/**
 * Encodes Float32 audio data (standard Web Audio API format) into Int16 PCM (Gemini format).
 */
export function pcmToBase64(data: Float32Array): string {
  let binary = '';
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] range before converting
    const s = Math.max(-1, Math.min(1, data[i]));
    // Convert to 16-bit integer
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  // Convert Int16Array to binary string
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Create a Blob object compatible with Gemini API from raw Float32 audio data.
 */
export function createAudioBlob(data: Float32Array, sampleRate: number): Blob {
  return {
    data: pcmToBase64(data),
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
}

/**
 * Decodes base64 encoded PCM 16-bit audio data back into an AudioBuffer.
 */
export async function decodeAudioData(
  base64Data: string,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataInt16 = new Int16Array(bytes.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }

  return buffer;
}
