import { el } from '../el';
import { en } from '../en';

/** Flatten nested message objects into dotted key paths. */
function keyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return keyPaths(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe('i18n key parity (AGENTS.md rule 12)', () => {
  it('el has exactly the same keys as en', () => {
    expect(keyPaths(el).sort()).toEqual(keyPaths(en).sort());
  });

  it('no empty translations in either locale', () => {
    const check = (obj: Record<string, unknown>, locale: string) => {
      for (const path of keyPaths(obj)) {
        const value = path
          .split('.')
          .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], obj);
        expect({ locale, path, ok: typeof value === 'string' && value.trim().length > 0 }).toEqual({
          locale,
          path,
          ok: true,
        });
      }
    };
    check(en, 'en');
    check(el, 'el');
  });

  it('interpolation placeholders match between locales', () => {
    const placeholders = (obj: Record<string, unknown>) =>
      Object.fromEntries(
        keyPaths(obj).map((path) => {
          const value = path
            .split('.')
            .reduce<unknown>((acc, k) => (acc as Record<string, unknown>)[k], obj);
          const found = typeof value === 'string' ? (value.match(/\{\{\w+\}\}/g) ?? []) : [];
          return [path, [...found].sort()];
        }),
      );
    expect(placeholders(el)).toEqual(placeholders(en));
  });
});
