import { z } from 'zod';

enum SmsCarrier {
  TWILIO = 'TWILIO',
  AWS_SNS = 'AWS_SNS',
  VONAGE = 'VONAGE',
}

// ─────────────────────────────────────────────
//  Auth & API Keys
// ─────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z
    .array(
      z.enum([
        'email:send',
        'email:read',
        'sms:send',
        'sms:read',
        'template:read',
        'template:write',
        'webhook:read',
        'webhook:write',
        'domain:read',
        'domain:write',
      ]),
    )
    .default(['email:send', 'sms:send']),
  rateLimit: z.number().int().min(1).max(100_000).default(1000),
  expiresAt: z.string().datetime().optional(),
});

// ─────────────────────────────────────────────
//  Email
// ─────────────────────────────────────────────
export const attachmentSchema = z.object({
  filename: z.string(),
  content: z.string().optional(),   // base64
  path: z.string().optional(),
  contentType: z.string().optional(),
  encoding: z.string().optional(),
});

export const sendEmailSchema = z.object({
  from: z.string().email().optional(),
  to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  replyTo: z.string().email().optional(),
  subject: z.string().min(1).max(998),
  html: z.string().optional(),
  text: z.string().optional(),
  templateId: z.string().cuid().optional(),
  templateData: z.record(z.unknown()).optional(),
  attachments: z.array(attachmentSchema).optional(),
  headers: z.record(z.string()).optional(),
  tags: z.record(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
}).refine(
  (d) => d.html || d.text || d.templateId,
  { message: 'Provide at least one of: html, text, or templateId' },
);

// ─────────────────────────────────────────────
//  SMS
// ─────────────────────────────────────────────
export const sendSmsSchema = z.object({
  to: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Must be a valid E.164 phone number'),
  body: z.string().min(1).max(160),
  carrier: z.nativeEnum(SmsCarrier),
  from: z.string().optional(),
  templateId: z.string().cuid().optional(),
  templateData: z.record(z.unknown()).optional(),
  tags: z.record(z.string()).optional(),
});

// ─────────────────────────────────────────────
//  Templates
// ─────────────────────────────────────────────
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['EMAIL', 'SMS']).default('EMAIL'),
  subject: z.string().max(998).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial().omit({ name: true });

// ─────────────────────────────────────────────
//  Webhooks
// ─────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  'email.sent',
  'email.failed',
  'email.bounced',
  'email.complained',
  'sms.sent',
  'sms.failed',
] as const;

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

export const updateWebhookSchema = createWebhookSchema.partial();

// ─────────────────────────────────────────────
//  Domains
// ─────────────────────────────────────────────
export const addDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, 'Must be a valid domain name'),
});

// ─────────────────────────────────────────────
//  Pagination
// ─────────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
