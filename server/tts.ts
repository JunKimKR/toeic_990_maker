/**
 * Server-side neural TTS provider abstraction. The app requests
 * GET /v1/tts?voice=M-us&rate=1&text=... and plays the returned audio/mpeg.
 * Provider keys stay on the server. Results are cached in memory (LRU).
 */
export interface ServerTts {
  readonly name: string;
  synth(text: string, voice: string, rate: number): Promise<ArrayBuffer>;
}

// voice = "<speaker>-<accent>", speaker in M/W/M2/W2, accent in us/gb/au/ca
const OPENAI_VOICES: Record<string, string> = { M: 'onyx', M2: 'echo', W: 'nova', W2: 'shimmer' };

export class OpenAiTts implements ServerTts {
  readonly name = 'openai';
  constructor(private key = process.env.OPENAI_API_KEY ?? '', private model = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts') {}
  async synth(text: string, voice: string, rate: number): Promise<ArrayBuffer> {
    const [spk, accent] = voice.split('-');
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        voice: OPENAI_VOICES[spk] ?? 'alloy',
        input: text,
        speed: Math.min(1.5, Math.max(0.7, rate)),
        instructions: `Speak naturally like a business professional with a ${({ us: 'North American', ca: 'Canadian', gb: 'British', au: 'Australian' } as Record<string, string>)[accent] ?? 'North American'} accent.`,
        response_format: 'mp3',
      }),
    });
    if (!r.ok) throw new Error(`tts ${r.status}`);
    return r.arrayBuffer();
  }
}

export class ElevenLabsTts implements ServerTts {
  readonly name = 'elevenlabs';
  constructor(private key = process.env.ELEVENLABS_API_KEY ?? '') {}
  async synth(text: string, voice: string): Promise<ArrayBuffer> {
    const ids = JSON.parse(process.env.ELEVENLABS_VOICE_IDS ?? '{}') as Record<string, string>;
    const id = ids[voice] ?? ids[voice.split('-')[0]];
    if (!id) throw new Error(`no ElevenLabs voice id for ${voice}`);
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: 'POST',
      headers: { 'xi-api-key': this.key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2' }),
    });
    if (!r.ok) throw new Error(`tts ${r.status}`);
    return r.arrayBuffer();
  }
}

export function createTtsProvider(): ServerTts | null {
  const which = process.env.TTS_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : '');
  if (which === 'openai') return new OpenAiTts();
  if (which === 'elevenlabs') return new ElevenLabsTts();
  return null;
}

export class LruCache<V> {
  private m = new Map<string, V>();
  constructor(private max = 500) {}
  get(k: string): V | undefined {
    const v = this.m.get(k);
    if (v !== undefined) {
      this.m.delete(k);
      this.m.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.m.set(k, v);
    if (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string);
  }
}
