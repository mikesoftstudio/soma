import { Request } from 'express';

// ─────────────────────────────────────────────
//  SMS Carrier
// ─────────────────────────────────────────────
export enum SmsCarrier {
  VERIZON = 'VERIZON',
  AT_T = 'AT_T',
  T_MOBILE = 'T_MOBILE',
  SPRINT = 'SPRINT',
}

// ─────────────────────────────────────────────
//  Augment Express Request
// ─────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      apiKeyId?: string;
      apiKeyPermissions?: string[];
    }
  }
}

// ─────────────────────────────────────────────
//  Pagination
// ─────────────────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─────────────────────────────────────────────
//  Email Payloads
// ─────────────────────────────────────────────
export interface Attachment {
  filename: string;
  content?: string;   // base64
  path?: string;
  contentType?: string;
  encoding?: string;
}

export interface SendEmailPayload {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: Attachment[];
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  scheduledAt?: string; // ISO date
}

// ─────────────────────────────────────────────
//  SMS Payloads
// ─────────────────────────────────────────────
export interface SendSmsPayload {
  to: string;           // E.164: +12125551234
  body: string;
  carrier?: SmsCarrier; // deprecated: not needed with Twilio
  from?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  tags?: Record<string, string>;
}

// ─────────────────────────────────────────────
//  Queue Jobs
// ─────────────────────────────────────────────
export interface EmailJobData {
  emailId: string;
}

export interface SmsJobData {
  smsId: string;
}

export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
}

// ─────────────────────────────────────────────
//  API Response helpers
// ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─────────────────────────────────────────────
//  SMTP events
// ─────────────────────────────────────────────
export interface InboundEmail {
  from: string;
  to: string[];
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  raw: string;
}
