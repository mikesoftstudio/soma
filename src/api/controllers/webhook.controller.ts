import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { generateWebhookSecret } from '../../utils/apikey';
import { ok, created, noContent, notFound, paginate } from '../../utils/response';
import { paginationSchema } from '../../utils/schemas';

export const webhookController = {
  /**
   * POST /v1/webhooks
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, url, events } = req.body;
      const secret = generateWebhookSecret();

      const webhook = await prisma.webhook.create({
        data: { name, url, events, secret, userId: req.userId! },
        select: {
          id: true, name: true, url: true, events: true,
          secret: true, isActive: true, createdAt: true,
        },
      });

      created(res, {
        ...webhook,
        note: 'Save the secret — use it to verify X-Soma-Signature on incoming deliveries.',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/webhooks
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const skip = (page - 1) * limit;

      const [webhooks, total] = await prisma.$transaction([
        prisma.webhook.findMany({
          where: { userId: req.userId! },
          skip, take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, url: true, events: true,
            isActive: true, createdAt: true,
          },
        }),
        prisma.webhook.count({ where: { userId: req.userId! } }),
      ]);

      paginate(res, webhooks, total, page, limit);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /v1/webhooks/:id
   */
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.id, userId: req.userId! },
        select: {
          id: true, name: true, url: true, events: true,
          isActive: true, createdAt: true,
          deliveries: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true, event: true, statusCode: true,
              success: true, attempts: true, createdAt: true,
            },
          },
        },
      });
      if (!webhook) { notFound(res); return; }
      ok(res, webhook);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /v1/webhooks/:id
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const existing = await prisma.webhook.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!existing) { notFound(res); return; }

      const updated = await prisma.webhook.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name ?? existing.name,
          url: req.body.url ?? existing.url,
          events: req.body.events ?? existing.events,
          isActive: req.body.isActive ?? existing.isActive,
        },
        select: {
          id: true, name: true, url: true, events: true, isActive: true, updatedAt: true,
        },
      });

      ok(res, updated);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /v1/webhooks/:id
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const existing = await prisma.webhook.findFirst({
        where: { id: req.params.id, userId: req.userId! },
      });
      if (!existing) { notFound(res); return; }

      await prisma.webhook.delete({ where: { id: req.params.id } });
      noContent(res);
    } catch (err) {
      next(err);
    }
  },
};
