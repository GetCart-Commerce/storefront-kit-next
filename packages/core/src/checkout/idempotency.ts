import { randomBytes } from 'node:crypto';

/** 16–128 characters of `A-Z a-z 0-9 _ -`, as the enterprise Shop API requires. */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

export function isIdempotencyKey(value: unknown): value is string {
    return typeof value === 'string' && IDEMPOTENCY_KEY.test(value);
}

/** 32 random bytes in base64url: 43 characters from the allowed alphabet. */
export function newIdempotencyKey(): string {
    return randomBytes(32).toString('base64url');
}
