import type { z } from 'zod';

export type RepositoryErrorCode = 'constraint' | 'database' | 'not_found' | 'validation';

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly entity: string;

  constructor(code: RepositoryErrorCode, entity: string, options?: { cause?: unknown }) {
    super('The requested local data operation could not be completed.');
    this.name = 'RepositoryError';
    this.code = code;
    this.entity = entity;
    this.cause = options?.cause;
  }
}

export function parseRecord<T>(schema: z.ZodType<T>, row: unknown, entity: string): T {
  const result = schema.safeParse(row);
  if (!result.success) {
    throw new RepositoryError('validation', entity, { cause: result.error });
  }
  return result.data;
}

export function mapRepositoryError(error: unknown, entity: string): RepositoryError {
  if (error instanceof RepositoryError) return error;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const code: RepositoryErrorCode =
    message.includes('constraint') || message.includes('unique') ? 'constraint' : 'database';
  return new RepositoryError(code, entity, { cause: error });
}

export function assertChanged(changes: number, entity: string): void {
  if (changes === 0) throw new RepositoryError('not_found', entity);
}
