import { redact } from '../logger';

describe('redact', () => {
  it('redacts email addresses', () => {
    expect(redact('user someone@example.com failed')).toBe('user [redacted-email] failed');
  });

  it('redacts JWT-shaped tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc-DEF_123';
    expect(redact(`token ${jwt} rejected`)).toBe('token [redacted-token] rejected');
  });

  it('leaves ordinary text alone', () => {
    expect(redact('synced 3 diary entries')).toBe('synced 3 diary entries');
  });
});
