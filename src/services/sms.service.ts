import { Twilio } from 'twilio';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { templateService } from './template';

/**
 * SMS Service
 *
 * Delivers SMS messages via Twilio API.
 * Supports international delivery and delivery tracking.
 */
class SmsService {
  private twilio: Twilio;

  constructor() {
    this.twilio = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  /**
   * Send an SMS by its database ID.
   */
  async send(smsId: string): Promise<void> {
    const sms = await prisma.sms.findUniqueOrThrow({ where: { id: smsId } });

    if (sms.status !== 'QUEUED') {
      logger.warn(`SMS ${smsId} already in status ${sms.status}, skipping`);
      return;
    }

    await prisma.sms.update({
      where: { id: smsId },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });

    try {
      let body = sms.body;

      // Render template if provided
      if (sms.templateId) {
        const template = await prisma.templateRecord.findUnique({ where: { id: sms.templateId } });
        if (template) {
          body = templateService.renderSms(template, (sms.tags as Record<string, unknown>) ?? {});
        }
      }

      // Send via Twilio
      const message = await this.twilio.messages.create({
        from: env.TWILIO_PHONE_NUMBER,
        to: sms.to,
        body,
      });

      await prisma.sms.update({
        where: { id: smsId },
        data: {
          status: 'SENT',
          messageId: message.sid,
          sentAt: new Date(),
          error: null,
        },
      });

      logger.info('SMS sent via Twilio', {
        smsId,
        to: sms.to,
        messageSid: message.sid,
        status: message.status,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const maxAttempts = 3; // Default retry attempts

      await prisma.sms.update({
        where: { id: smsId },
        data: {
          status: sms.attempts + 1 >= maxAttempts ? 'FAILED' : 'QUEUED',
          error: message,
        },
      });

      logger.error('SMS delivery failed', { smsId, error: message });
      throw err;
    }
  }
}

export const smsService = new SmsService();

