export type Clock = {
  now: () => string;
};

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
};

export function encodeJson(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}
