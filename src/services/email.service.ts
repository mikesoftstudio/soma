import { Resend } from 'resend';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { templateService } from './template';

class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(env.RESEND_API_KEY);
  }

  /**
   * Send an email by its database ID.
   * Handles template rendering, status tracking, and error recording.
   */
  async send(emailId: string): Promise<void> {
    const email = await prisma.email.findUniqueOrThrow({ where: { id: emailId } });

    if (!['QUEUED', 'SCHEDULED'].includes(email.status)) {
      logger.warn(`Email ${emailId} is already in status ${email.status}, skipping`);
      return;
    }

    // Mark as sending
    await prisma.email.update({
      where: { id: emailId },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });

    try {
      let html = email.html ?? undefined;
      let text = email.text ?? undefined;
      let subject = email.subject;

      // Render template if linked
      if (email.templateId) {
        const template = await prisma.templateRecord.findUnique({ where: { id: email.templateId } });
        if (template) {
          const rendered = templateService.renderEmail(
            template,
            (email.tags as Record<string, unknown>) ?? {},
          );
          html = rendered.html ?? html;
          text = rendered.text ?? text;
          subject = rendered.subject ?? subject;
        }
      }

      const from = email.from ?? `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

      // Prepare email payload for Resend
      const emailPayload: any = {
        from,
        to: email.to,
        subject,
      };

      // Add CC/BCC if present
      if (email.cc.length) emailPayload.cc = email.cc;
      if (email.bcc.length) emailPayload.bcc = email.bcc;
      if (email.replyTo) emailPayload.reply_to = email.replyTo;

      // Add content - html takes precedence
      if (html) {
        emailPayload.html = html;
        if (text) emailPayload.text = text;
      } else if (text) {
        emailPayload.text = text;
      }

      // Add headers and attachments if present
      if (email.headers && Object.keys(email.headers as object).length) {
        emailPayload.headers = email.headers;
      }
      if (email.attachments && Array.isArray(email.attachments) && email.attachments.length) {
        emailPayload.attachments = email.attachments;
      }

      const { data, error } = await this.resend.emails.send(emailPayload);

      if (error) {
        throw new Error(error.message);
      }

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          messageId: data?.id ?? null,
          sentAt: new Date(),
          error: null,
        },
      });

      await prisma.emailEvent.create({
        data: { emailId, type: 'sent', data: { messageId: data?.id } },
      });

      logger.info(`Email sent via Resend`, { emailId, messageId: data?.id, to: email.to });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const maxAttempts = 3; // Default retry attempts

      const updated = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: email.attempts + 1 >= maxAttempts ? 'FAILED' : 'QUEUED',
          error: message,
        },
      });

      if (updated.status === 'FAILED') {
        await prisma.emailEvent.create({ data: { emailId, type: 'failed', data: { error: message } } });
      }

      logger.error(`Email delivery failed`, { emailId, error: message });
      throw err;
    }
  }

  /**
   * Mark an email as bounced (can be called from webhook handler).
   */
  async markBounced(messageId: string, reason?: string): Promise<void> {
    const email = await prisma.email.findFirst({ where: { messageId } });
    if (!email) return;

    await prisma.email.update({
      where: { id: email.id },
      data: { status: 'BOUNCED' },
    });

    await prisma.emailEvent.create({
      data: { emailId: email.id, type: 'bounced', data: { reason } },
    });

    logger.info(`Email marked as bounced`, { emailId: email.id, messageId, reason });
  }
}

export const emailService = new EmailService();

