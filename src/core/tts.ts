/**
 * tts.ts — Client-side text-to-speech for ADHD-Sage.
 *
 * Ported from /root/ADHD-Sage/src/server/routes/tts.ts (edge-tts / ElevenLabs)
 * to the browser Web Speech API (SpeechSynthesis) so the Coming-home UI can
 * speak without a server. Personas mirror the server route's voices.
 */

export interface TTSVoice {
  voice: string;   // preferred voiceURI fragment (e.g. 'en-US-AvaNeural')
  pitch: number;   // 0–2 (1 = default)
  rate: number;    // 0.1–10 (1 = default)
  accent: string;
}

export const PERSONAS: Record<string, TTSVoice> = {
  mama: { voice: 'en-US-AvaNeural', pitch: 1.1, rate: 1.14, accent: 'West Coast American' },
  adhd: { voice: 'en-US-AvaNeural', pitch: 1.1, rate: 1.14, accent: 'West Coast American' },
  seven: { voice: 'en-US-MichelleNeural', pitch: 0.98, rate: 1.02, accent: 'Midwest American' },
  spiral: { voice: 'en-US-ChristopherNeural', pitch: 0.96, rate: 0.98, accent: 'Neutral American' },
};

export const MAX_CHARS = 1500;

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(voiceFragment: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find(v => v.voiceURI.includes(voiceFragment)) ||
    voices.find(v => v.lang.startsWith('en-US')) ||
    voices[0] ||
    null
  );
}

/** Speak text with the given persona. Cancels any ongoing utterance first. */
export function speak(text: string, personaKey: string = 'mama'): void {
  if (!isSpeechSupported()) return;
  const p = PERSONAS[personaKey.toLowerCase()] || PERSONAS.mama;
  const synth = window.speechSynthesis;

  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text.slice(0, MAX_CHARS));
  const voice = pickVoice(p.voice);
  if (voice) utterance.voice = voice;
  utterance.pitch = p.pitch;
  utterance.rate = p.rate;
  utterance.lang = voice?.lang || 'en-US';
  synth.speak(utterance);
}

/** Stop any ongoing speech. */
export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

/** Whether speech is currently in progress. */
export function isSpeaking(): boolean {
  return isSpeechSupported() && window.speechSynthesis.speaking;
}
