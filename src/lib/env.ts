import { z } from 'zod';

/**
 * Client environment. ONLY EXPO_PUBLIC_* values may appear here (AGENTS.md
 * rule 3) — anything secret lives in Supabase Edge Function secrets.
 * Supabase vars are optional until M2 wires the backend; use
 * requireSupabaseEnv() from M2 onward so misconfiguration fails fast.
 */
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url().optional(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Lazy so importing this module never throws at bundle time. */
export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse({
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
  }
  return cached;
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const env = getEnv();
  if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase environment is not configured. Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  return { url: env.EXPO_PUBLIC_SUPABASE_URL, anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
}

/** Test-only: reset the cache. */
export function __resetEnvCacheForTests(): void {
  cached = null;
}
