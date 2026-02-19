// Soma — Environment configuration with validation
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Security
  JWT_SECRET: z.string().min(32),
  API_KEY_PREFIX: z.string().default('sk_'),

  // Database
  DATABASE_URL: z.string().url(),

  // Resend (Email)
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_NAME: z.string().default('Soma'),
  RESEND_FROM_EMAIL: z.string().email(),

  // Twilio (SMS)
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Logs
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_DIR: z.string().default('logs'),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error('❌  Invalid environment variables:\n', _parsed.error.format());
  process.exit(1);
}

export const env = _parsed.data;
export type Env = typeof env;

