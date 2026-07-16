import { createId } from '@/lib/id';

describe('createId', () => {
  it('creates a deterministic UUIDv7 shape with sortable timestamp bytes', () => {
    const earlier = createId(1_700_000_000_000, () => 0);
    const later = createId(1_700_000_000_001, () => 0);

    expect(earlier).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(earlier < later).toBe(true);
  });
});
