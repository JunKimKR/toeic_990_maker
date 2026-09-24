/**
 * LLM provider abstraction. The generator and the critic both go through
 * `LlmProvider.json()`, so providers can be swapped via LLM_PROVIDER without
 * touching the pipeline. API keys live only in the server environment.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

export interface LlmProvider {
  readonly name: string;
  /** Returns JSON matching `schema` (validated), or throws. */
  json<T>(opts: { system: string; user: string; schema: z.ZodType<T>; jsonSchema: Record<string, unknown>; effort?: 'low' | 'medium' | 'high' }): Promise<T>;
}

export class LlmRefusalError extends Error {}

export class AnthropicProvider implements LlmProvider {
  readonly name: string;
  private client: Anthropic;
  constructor(
    private model = process.env.ANTHROPIC_MODEL || 'claude-opus-5',
    private useFallbacks = process.env.ANTHROPIC_FALLBACKS !== 'off',
  ) {
    this.client = new Anthropic(); // reads ANTHROPIC_API_KEY from the server env
    this.name = `anthropic:${model}`;
  }

  async json<T>(opts: { system: string; user: string; schema: z.ZodType<T>; jsonSchema: Record<string, unknown>; effort?: 'low' | 'medium' | 'high' }): Promise<T> {
    const stream = this.client.beta.messages.stream({
      model: this.model,
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: opts.user }],
      output_config: { effort: opts.effort ?? 'high', format: { type: 'json_schema', schema: opts.jsonSchema } },
      ...(this.useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new LlmRefusalError(msg.stop_details?.category ?? 'refused');
    if (msg.stop_reason === 'max_tokens') throw new Error('LLM output truncated');
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return opts.schema.parse(JSON.parse(text));
  }
}

/** Deterministic stand-in used by tests (no network, no cost). */
export class ScriptedProvider implements LlmProvider {
  readonly name = 'scripted';
  constructor(private responder: (system: string, user: string) => unknown) {}
  async json<T>(opts: { system: string; user: string; schema: z.ZodType<T> }): Promise<T> {
    return opts.schema.parse(this.responder(opts.system, opts.user));
  }
}

export function createProvider(): LlmProvider | null {
  const which = process.env.LLM_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : '');
  if (which === 'anthropic') return new AnthropicProvider();
  return null;
}
