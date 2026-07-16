import { __resetEnvCacheForTests, getEnv, requireSupabaseEnv } from '../env';

const KEYS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetEnvCacheForTests();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetEnvCacheForTests();
});

describe('env', () => {
  it('parses fine with Supabase unset (pre-M2 state)', () => {
    expect(getEnv().EXPO_PUBLIC_SUPABASE_URL).toBeUndefined();
  });

  it('requireSupabaseEnv throws a helpful error when unconfigured', () => {
    expect(() => requireSupabaseEnv()).toThrow(/Copy \.env\.example/);
  });

  it('requireSupabaseEnv returns values when configured', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    expect(requireSupabaseEnv()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('rejects a malformed URL', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'not-a-url';
    expect(() => getEnv()).toThrow();
  });
});
