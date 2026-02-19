import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';

const SALT_ROUNDS = 12;

/**
 * Generates a new API key.
 * Returns the plain key (shown once to user) and its bcrypt hash for storage.
 */
export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  // Format: sk_<32 random hex chars>
  const random = crypto.randomBytes(32).toString('hex');
  const key = `${env.API_KEY_PREFIX}${random}`;
  const prefix = key.slice(0, 12); // "sk_" + first 9 chars = shown in UI
  const hash = await bcrypt.hash(key, SALT_ROUNDS);
  return { key, hash, prefix };
}

/**
 * Verifies a plain-text API key against a stored bcrypt hash.
 */
export async function verifyApiKey(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Generates a secure random secret for webhook HMAC signing.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Signs a webhook payload using HMAC-SHA256.
 * The signature is sent in `X-Soma-Signature` header.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies an incoming webhook signature.
 */
export function verifyWebhookSignature(payload: string, secret: string, signature: string): boolean {
  const expected = signWebhookPayload(payload, secret);
  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
