import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { smsService } from '../../services/sms.service';
import { SendSmsPayload } from '../../types';
import { created, ok, notFound, paginate } from '../../utils/response';
import { paginationSchema } from '../../utils/schemas';

export const smsController = {
  /**
   * POST /v1/sms
   * Send an SMS via Twilio.
   */
  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body as SendSmsPayload;
      const userId = req.userId!;

      // Normalise to E.164
      const to = body.to.startsWith('+') ? body.to : `+${body.to}`;

      const sms = await prisma.sms.create({
        data: {
          to,
          from: body.from,
          body: body.body,
          templateId: body.templateId,
          tags: body.tags ?? {},
          userId,
          apiKeyId: req.apiKeyId,
        },
        select: {
          id: true, to: true, body: true,
          status: true, createdAt: true,
        },
      });

      // Send immediately (fire and forget)
      smsService.send(sms.id).catch((err) => {
        console.error(`Failed to send SMS ${sms.id}:`, err);
      });

      created(res, sms);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/sms
   * List SMS messages.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;

      const [messages, total] = await prisma.$transaction([
        prisma.sms.findMany({
          where: { userId: req.userId! },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, to: true, status: true,
            sentAt: true, createdAt: true,
          },
        }),
        prisma.sms.count({ where: { userId: req.userId! } }),
      ]);

      paginate(res, messages, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/sms/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sms = await prisma.sms.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!sms) { notFound(res); return; }
      ok(res, sms);
    } catch (err) {
      next(err);
    }
  },
};

