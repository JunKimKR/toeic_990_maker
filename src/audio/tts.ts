/**
 * TTS provider abstraction.
 *
 *  - DeviceTtsProvider: on-device speech (expo-speech). Works offline; picks
 *    different voices/accents per speaker when the device has them, otherwise
 *    separates speakers by pitch.
 *  - RemoteTtsProvider: natural neural voices streamed from the backend
 *    (/v1/tts, which holds the provider API key). Falls back to the device
 *    provider line-by-line on any error, so audio never "just fails".
 *  - MockTtsProvider: timer-based, for tests and silent environments.
 *
 * Every line has a safety timeout, so a platform that never fires "done"
 * cannot freeze a training session.
 */
import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';
import type { Accent, ScriptLine, Speaker } from '../domain/types';

export interface PlaybackCallbacks {
  onLine?(index: number): void;
  onDone?(): void;
  onError?(e: unknown): void;
}

export interface PlayOptions {
  rate: number;
  /** pause (ms) inserted after a given line index, e.g. between a Part 2 question and its options */
  pauses?: Record<number, number>;
}

export interface TtsProvider {
  readonly id: 'device' | 'remote' | 'mock';
  play(lines: ScriptLine[], opts: PlayOptions, cb: PlaybackCallbacks): () => void;
}

const LANG: Record<Accent, string> = { us: 'en-US', gb: 'en-GB', au: 'en-AU', ca: 'en-CA' };

export function estimateLineMs(text: string, rate: number): number {
  const words = text.split(/\s+/).length;
  return (words / 2.6 / Math.max(0.5, rate)) * 1000 + 600;
}

// ---------------------------------------------------------------------------
// Device voices
// ---------------------------------------------------------------------------

interface VoicePick {
  voice?: string;
  language: string;
  pitch: number;
}

let voiceCache: Speech.Voice[] | null = null;
async function voices(): Promise<Speech.Voice[]> {
  if (voiceCache) return voiceCache;
  try {
    const all = await Speech.getAvailableVoicesAsync();
    voiceCache = all.filter((v) => v.language?.toLowerCase().startsWith('en'));
  } catch {
    voiceCache = [];
  }
  return voiceCache;
}

const isMale = (v: Speech.Voice) => /(^|[^a-z])male|#male|man\b|-iom-|-tpd-|-sfg-|daniel|alex|fred|rishi|aaron|arthur|gordon/i.test(`${v.identifier} ${v.name}`) && !/female/i.test(`${v.identifier} ${v.name}`);
const isFemale = (v: Speech.Voice) => /female|#female|woman|-tpf-|-tpc-|samantha|karen|moira|tessa|serena|catherine|martha|nicky/i.test(`${v.identifier} ${v.name}`);

export async function pickVoice(speaker: Speaker, accent: Accent | undefined): Promise<VoicePick> {
  const lang = LANG[accent ?? 'us'];
  const male = speaker === 'M' || speaker === 'M2';
  const all = await voices();
  const sameLang = all.filter((v) => v.language?.replace('_', '-').toLowerCase() === lang.toLowerCase());
  const pool = sameLang.length ? sameLang : all.filter((v) => v.language?.toLowerCase().startsWith('en-us'));
  const gendered = pool.filter(male ? isMale : isFemale);
  const pickFrom = gendered.length ? gendered : pool;
  const enhanced = pickFrom.filter((v) => String(v.quality).toLowerCase() === 'enhanced');
  const v = (enhanced.length ? enhanced : pickFrom)[speaker === 'M2' || speaker === 'W2' ? 1 : 0] ?? pickFrom[0];
  // if no gendered voice exists, separate speakers by pitch
  const pitch = gendered.length ? 1 : male ? 0.82 : 1.12;
  return { voice: v?.identifier, language: v?.language ?? lang, pitch };
}

export class DeviceTtsProvider implements TtsProvider {
  readonly id = 'device' as const;
  play(lines: ScriptLine[], opts: PlayOptions, cb: PlaybackCallbacks): () => void {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let i = 0;
    const next = async () => {
      if (timer) clearTimeout(timer);
      if (stopped) return;
      if (i >= lines.length) {
        cb.onDone?.();
        return;
      }
      const idx = i++;
      const line = lines[idx];
      cb.onLine?.(idx);
      let advanced = false;
      const go = () => {
        if (advanced || stopped) return;
        advanced = true;
        if (timer) clearTimeout(timer);
        const pause = opts.pauses?.[idx] ?? 380;
        timer = setTimeout(next, pause);
      };
      try {
        const v = await pickVoice(line.speaker, line.accent);
        if (stopped) return;
        Speech.speak(line.text, { language: v.language, voice: v.voice, pitch: v.pitch, rate: opts.rate, onDone: go, onStopped: () => undefined, onError: go });
      } catch (e) {
        cb.onError?.(e);
      }
      // safety net: some engines never report completion
      timer = setTimeout(go, estimateLineMs(line.text, opts.rate) * 1.8 + 2500);
    };
    next();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      Speech.stop().catch(() => undefined);
    };
  }
}

// ---------------------------------------------------------------------------
// Remote neural TTS via backend
// ---------------------------------------------------------------------------

export class RemoteTtsProvider implements TtsProvider {
  readonly id = 'remote' as const;
  constructor(
    private baseUrl: string,
    private fallback: TtsProvider = new DeviceTtsProvider(),
  ) {}

  private url(line: ScriptLine, rate: number) {
    const voice = `${line.speaker}-${line.accent ?? 'us'}`;
    return `${this.baseUrl.replace(/\/$/, '')}/v1/tts?voice=${encodeURIComponent(voice)}&rate=${rate}&text=${encodeURIComponent(line.text)}`;
  }

  play(lines: ScriptLine[], opts: PlayOptions, cb: PlaybackCallbacks): () => void {
    let stopped = false;
    let i = 0;
    let stopFallback: (() => void) | null = null;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      try {
        player?.remove();
      } catch {
        /* ignore */
      }
      player = null;
    };
    const next = () => {
      cleanup();
      if (stopped) return;
      if (i >= lines.length) {
        cb.onDone?.();
        return;
      }
      const idx = i++;
      const line = lines[idx];
      cb.onLine?.(idx);
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        timer = setTimeout(next, opts.pauses?.[idx] ?? 300);
      };
      const fallbackLine = () => {
        if (done) return;
        done = true;
        cleanup();
        stopFallback = this.fallback.play([line], opts, { onDone: () => timer = setTimeout(next, opts.pauses?.[idx] ?? 300), onError: cb.onError });
      };
      try {
        player = createAudioPlayer({ uri: this.url(line, opts.rate) });
        player.addListener('playbackStatusUpdate', (st) => {
          if (st.didJustFinish) go();
        });
        player.play();
        // if the stream does not start/finish in time, use the device voice for this line
        timer = setTimeout(() => (player?.playing ? (timer = setTimeout(go, estimateLineMs(line.text, opts.rate) * 1.5)) : fallbackLine()), 4000);
      } catch {
        fallbackLine();
      }
    };
    next();
    return () => {
      stopped = true;
      cleanup();
      stopFallback?.();
    };
  }
}

// ---------------------------------------------------------------------------

export class MockTtsProvider implements TtsProvider {
  readonly id = 'mock' as const;
  constructor(private speed = 1) {}
  play(lines: ScriptLine[], opts: PlayOptions, cb: PlaybackCallbacks): () => void {
    let stopped = false;
    let t: ReturnType<typeof setTimeout> | null = null;
    let i = 0;
    const next = () => {
      if (stopped) return;
      if (i >= lines.length) return cb.onDone?.();
      const idx = i++;
      cb.onLine?.(idx);
      t = setTimeout(next, (estimateLineMs(lines[idx].text, opts.rate) * this.speed) / 10);
    };
    next();
    return () => {
      stopped = true;
      if (t) clearTimeout(t);
    };
  }
}

export function createTts(kind: 'device' | 'remote' | 'mock', apiBaseUrl: string): TtsProvider {
  if (kind === 'mock') return new MockTtsProvider();
  if (kind === 'remote' && apiBaseUrl) return new RemoteTtsProvider(apiBaseUrl);
  return new DeviceTtsProvider();
}
