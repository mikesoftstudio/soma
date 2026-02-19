import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { emailService } from '../../services/email.service';
import { SendEmailPayload } from '../../types';
import { created, ok, notFound, paginate } from '../../utils/response';
import { paginationSchema } from '../../utils/schemas';
import { env } from '../../config/env';

export const emailController = {
  /**
   * POST /v1/emails
   * Send (or schedule) an email.
   */
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as SendEmailPayload;
      const userId = req.userId!;

      const toArray = Array.isArray(body.to) ? body.to : [body.to];
      const ccArray = body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : [];
      const bccArray = body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : [];
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;

      const email = await prisma.email.create({
        data: {
          from: body.from ?? `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
          to: toArray,
          cc: ccArray,
          bcc: bccArray,
          replyTo: body.replyTo,
          subject: body.subject,
          html: body.html,
          text: body.text,
          headers: body.headers ?? {},
          attachments: (body.attachments ?? []) as unknown as object[],
          tags: body.tags ?? {},
          templateId: body.templateId,
          status: scheduledAt ? 'SCHEDULED' : 'QUEUED',
          scheduledAt,
          userId,
          apiKeyId: req.apiKeyId,
        },
        select: {
          id: true, from: true, to: true, cc: true, bcc: true,
          subject: true, status: true, scheduledAt: true, createdAt: true,
        },
      });

      // Send immediately if not scheduled (fire and forget for now)
      if (!scheduledAt) {
        emailService.send(email.id).catch((err) => {
          console.error(`Failed to send email ${email.id}:`, err);
        });
      }

      created(res, email);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/emails
   * List emails for the authenticated user with pagination.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;

      const [emails, total] = await prisma.$transaction([
        prisma.email.findMany({
          where: { userId: req.userId! },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, from: true, to: true, subject: true,
            status: true, sentAt: true, createdAt: true,
          },
        }),
        prisma.email.count({ where: { userId: req.userId! } }),
      ]);

      paginate(res, emails, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/emails/:id
   * Get a single email by ID.
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = await prisma.email.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        include: { events: { orderBy: { createdAt: 'asc' } } },
      });

      if (!email) { notFound(res); return; }
      ok(res, email);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/emails/:id/events
   * Get delivery events for an email.
   */
  async getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = await prisma.email.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!email) { notFound(res); return; }

      const events = await prisma.emailEvent.findMany({
        where: { emailId: email.id },
        orderBy: { createdAt: 'asc' },
      });

      ok(res, events);
    } catch (err) {
      next(err);
    }
  },
};

